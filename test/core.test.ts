import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { linkOnPage, mentionsGameSlug } from '../src/directories/check.ts';
import type { Directory } from '../src/directories/types.ts';
import { linkRelation, normalizeUrl, slugify } from '../src/games.ts';
import { buildPitch, prepareSubmission } from '../src/prepare.ts';
import { findGame, setStatus, StateFileError, Store } from '../src/store.ts';

describe('normalizeUrl', () => {
	it('treats spellings of the same link as one game', () => {
		assert.equal(normalizeUrl('https://www.Foo.com/'), 'foo.com');
		assert.equal(normalizeUrl('http://foo.com/?utm_source=x&ref=y'), 'foo.com');
		assert.equal(normalizeUrl('https://foo.com/play//daily/'), 'foo.com/play/daily');
		assert.equal(normalizeUrl('https://foo.com/?b=2&a=1'), 'foo.com?a=1&b=2');
	});
});

describe('linkRelation', () => {
	it('matches a deeper or shorter page of the same game', () => {
		assert.equal(linkRelation('https://www.globle-game.com/', 'https://globle-game.com/game'), 'same');
		assert.equal(linkRelation('https://foo.com/play/daily', 'https://foo.com/play/'), 'same');
		assert.equal(linkRelation('https://foo.com/play', 'https://foo.com/play/daily'), 'same');
	});
	it('only half-matches when the directory lists the bare domain', () => {
		assert.equal(linkRelation('https://foo.com/play', 'https://foo.com'), 'related');
	});
	it('keeps two games on one host apart', () => {
		assert.equal(linkRelation('https://wordnerd.co/23words', 'https://wordnerd.co/other'), 'none');
		assert.equal(linkRelation('https://foo.com/play', 'https://foo.com/player'), 'none');
		assert.equal(linkRelation('https://foo.com', 'https://bar.com'), 'none');
	});
});

describe('slugify', () => {
	it('drops accents and punctuation', () => {
		assert.equal(slugify('Pokémon Cry-dle!'), 'pokemon-cry-dle');
	});
});

describe('linkOnPage', () => {
	it('finds the game, with or without www, escaped or not', () => {
		assert.equal(linkOnPage('<a href="https://www.globle-game.com/">', 'https://globle-game.com'), 'same');
		assert.equal(linkOnPage('{"url":"https:\\/\\/globle-game.com\\/game?utm_source=x"}', 'https://www.globle-game.com/'), 'same');
		assert.equal(linkOnPage('"externalHost":"globle-game.com"', 'https://globle-game.com'), 'same');
		assert.equal(linkOnPage('favicon?url=https://globle-game.com&size=64', 'https://globle-game.com'), 'same');
	});
	it('does not match a longer host that ends the same way', () => {
		assert.equal(linkOnPage('https://wordle.com', 'https://dle.com'), 'none');
		assert.equal(linkOnPage('https://dle.com.evil.net', 'https://dle.com'), 'none');
	});
	it('does not count another game on the same site', () => {
		assert.equal(linkOnPage('https://www.nytimes.com/games/wordle/index.html', 'https://www.nytimes.com/games/not-a-game'), 'none');
		assert.equal(linkOnPage('https://someone.github.io/other-game', 'https://someone.github.io/my-game'), 'none');
		assert.equal(linkOnPage('https://someone.github.io/my-game/', 'https://someone.github.io/my-game'), 'same');
	});
	it('only half-counts a link to the bare domain', () => {
		assert.equal(linkOnPage('<a href="https://www.nytimes.com">', 'https://www.nytimes.com/games/connections'), 'related');
	});
});

describe('mentionsGameSlug', () => {
	it('matches a path segment named after the game', () => {
		assert.ok(mentionsGameSlug('<loc>https://dir.example/games/pokedle</loc>', 'Pokedle'));
		assert.ok(!mentionsGameSlug('<loc>https://dir.example/games/pokedle-unlimited</loc>', 'Pokedle'));
	});
	it('ignores names too short to mean anything', () => {
		assert.ok(!mentionsGameSlug('/abc/', 'ABC'));
	});
});

const profile = { name: 'Testdle', url: 'https://testdle.example.com/', tagline: 'Guess the test.', languages: ['en', 'fr'] };

function directory(overrides: Partial<Directory>): Directory {
	return {
		id: 'example',
		name: 'Example',
		url: 'https://example.com',
		submitUrl: 'https://example.com/submit',
		method: 'form',
		account: false,
		cost: 'free',
		captcha: false,
		about: 'An example.',
		fields: [
			{ source: 'name', label: 'Game name', required: true },
			{ source: 'contactEmail', label: 'Email', required: true },
			{ source: 'tagline', label: 'Short description', required: false, maxLength: 5 }
		],
		steps: [],
		verified: '2026-11-24',
		...overrides
	};
}

describe('prepareSubmission', () => {
	it('fills fields from the profile and names what is missing', () => {
		const prepared = prepareSubmission(directory({}), profile);
		assert.deepEqual(prepared.missing, ['Email']);
		assert.equal(prepared.fields[0]?.value, 'Testdle');
		assert.deepEqual(prepared.fields[2]?.tooLong, { maxLength: 5, length: 'Guess the test.'.length });
	});
	it('prefills a GitHub issue', () => {
		const prepared = prepareSubmission(directory({ method: 'github_issue', github: { repo: 'someone/list', labels: ['game'] } }), profile);
		const link = new URL(prepared.links[0]!.url);
		assert.equal(link.pathname, '/someone/list/issues/new');
		assert.equal(link.searchParams.get('title'), 'Add Testdle');
		assert.equal(link.searchParams.get('labels'), 'game');
		assert.ok(link.searchParams.get('body')?.includes('https://testdle.example.com/'));
	});
	it('prefills issue-form fields by id instead of a body', () => {
		const prepared = prepareSubmission(
			directory({ method: 'github_issue', github: { repo: 'someone/list', template: 'add.yml', fieldIds: { name: 'game-name', url: 'game-url' } } }),
			profile
		);
		const link = new URL(prepared.links[0]!.url);
		assert.equal(link.searchParams.get('template'), 'add.yml');
		assert.equal(link.searchParams.get('game-name'), 'Testdle');
		assert.equal(link.searchParams.get('body'), null);
	});
	it('writes an email with spaces, not plus signs', () => {
		const prepared = prepareSubmission(directory({ method: 'email', email: 'list@example.com' }), profile);
		assert.ok(prepared.links[0]!.url.startsWith('mailto:list@example.com?subject=Game%20suggestion%3A%20Testdle'));
	});
	it('puts the languages in the pitch', () => {
		assert.match(buildPitch(profile), /Languages: en, fr/);
	});
});

describe('Store', () => {
	it('remembers across instances and keeps a history', () => {
		const folder = mkdtempSync(join(tmpdir(), 'dle-submit-test-'));
		try {
			const path = join(folder, 'nested', 'state.json');
			new Store(path).update((state) => {
				state.games['testdle.example.com'] = { profile, createdAt: 'x', updatedAt: 'x', submissions: {} };
			});
			new Store(path).update((state) => {
				const { record } = findGame(state, 'Testdle');
				setStatus(record, 'example', 'prepared', {}, '2026-11-24T00:00:00Z');
				setStatus(record, 'example', 'submitted', { reference: 'https://example.com/issue/1' }, '2026-11-24T01:00:00Z');
			});
			const record = new Store(path).read().games['testdle.example.com'];
			assert.equal(record?.submissions.example?.status, 'submitted');
			assert.equal(record?.submissions.example?.reference, 'https://example.com/issue/1');
			assert.equal(record?.submissions.example?.history.length, 2);
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	});
	it('finds a game by any spelling of its link', () => {
		const state = { version: 1 as const, games: { 'testdle.example.com': { profile, createdAt: 'x', updatedAt: 'x', submissions: {} } } };
		assert.equal(findGame(state, 'http://www.testdle.example.com/').key, 'testdle.example.com');
		assert.equal(findGame(state, 'testdle.example.com').key, 'testdle.example.com');
		assert.throws(() => findGame(state, 'Other'), /Saved games: Testdle/);
	});
	it('refuses to overwrite a file it cannot read', () => {
		const folder = mkdtempSync(join(tmpdir(), 'dle-submit-test-'));
		try {
			const path = join(folder, 'state.json');
			writeFileSync(path, '{ broken');
			assert.throws(() => new Store(path).update(() => undefined), StateFileError);
			assert.equal(readFileSync(path, 'utf8'), '{ broken');
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	});
});

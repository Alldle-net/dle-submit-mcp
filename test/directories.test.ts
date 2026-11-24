import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { withTable } from '../scripts/readme.ts';
import { DIRECTORIES, findDirectory } from '../src/directories/index.ts';

/**
 * The order is set by hand: a change to it has to be deliberate, so it is pinned
 * here rather than left to whoever adds the next directory.
 */
const ORDER = [
	'alldle',
	'dle-arena',
	'dailydles',
	'dailies-games',
	'the-dles',
	'dailydle',
	'daily-game-list',
	'adory-vo',
	'the-word-finder',
	'relaydle',
	'listdle',
	'wordleweb',
	'seekdle',
	'awesome-wordle',
	'dlegames-org',
	'playlin',
	'dle-games',
	'dles-gg',
	'alldle-games',
	'dlehunt',
	'wordles-of-the-world',
	'dlelist',
	'goldles',
	'sportsdle',
	'dles-io',
	'wordleverse'
];

describe('the directory list', () => {
	it('starts with Alldle', () => {
		assert.equal(DIRECTORIES[0]?.id, 'alldle');
	});

	it('keeps the order set by hand', () => {
		assert.deepEqual(
			DIRECTORIES.map((directory) => directory.id),
			ORDER,
			'The order changed. If that was deliberate, update ORDER here.'
		);
	});

	it('has unique, lowercase ids', () => {
		const ids = DIRECTORIES.map((directory) => directory.id);
		assert.equal(new Set(ids).size, ids.length);
		for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
		assert.equal(findDirectory('ALLDLE').id, 'alldle');
	});

	it('only sends automatically where no account or captcha stands in the way', () => {
		for (const directory of DIRECTORIES) {
			if (!directory.autoSubmit) continue;
			assert.ok(!directory.account, `${directory.id} needs an account`);
			assert.ok(!directory.captcha, `${directory.id} has a captcha`);
		}
	});

	it('gives every directory a way in', () => {
		for (const directory of DIRECTORIES) {
			assert.match(directory.url, /^https:\/\//, directory.id);
			assert.match(directory.submitUrl, /^(https:\/\/|mailto:)/, directory.id);
			assert.ok(directory.steps.length > 0 || directory.autoSubmit, `${directory.id} has no steps`);
			if (directory.method === 'github_issue' || directory.method === 'github_pr') assert.ok(directory.github, `${directory.id} needs its repo`);
			if (directory.method === 'gitlab_issue') assert.ok(directory.gitlab, `${directory.id} needs its project`);
			if (directory.method === 'email') assert.ok(directory.email, `${directory.id} needs its address`);
			assert.match(directory.verified, /^\d{4}-\d{2}-\d{2}$/, directory.id);
		}
	});

	it('matches the README table', () => {
		const readme = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8');
		assert.equal(withTable(readme), readme, 'README.md is out of date: run npm run readme');
	});
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DIRECTORIES, findDirectory } from '../src/directories/index.ts';
import type { SubmitContext } from '../src/directories/types.ts';
import type { GameProfile } from '../src/games.ts';

interface Sent {
	url: string;
	method: string;
	body: Record<string, unknown>;
	headers: Headers;
}

/** A network that records what was sent and answers with a canned response. */
function fakeNetwork(status: number, answer: unknown): { fetcher: typeof fetch; sent: Sent[] } {
	const sent: Sent[] = [];
	const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
		sent.push({
			url: String(input),
			method: init?.method ?? 'GET',
			body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
			headers: new Headers(init?.headers)
		});
		return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } });
	}) as typeof fetch;
	return { fetcher, sent };
}

const full: GameProfile = {
	name: 'Riverdle',
	url: 'https://riverdle.example.com/',
	tagline: 'Guess the river from its outline.',
	description: 'A new river every day. Each wrong guess tells you how far away it is and in which direction.',
	category: 'Geography',
	languages: ['en', 'fr'],
	creatorName: 'Sam',
	contactEmail: 'sam@example.com'
};

async function send(id: string, status: number, answer: unknown, profile: GameProfile = full, extra: Partial<SubmitContext> = {}) {
	const network = fakeNetwork(status, answer);
	const directory = findDirectory(id);
	assert.ok(directory.autoSubmit, `${id} sends automatically`);
	const outcome = await directory.autoSubmit({ profile, fetcher: network.fetcher, ...extra });
	return { outcome, sent: network.sent };
}

describe('automatic submissions', () => {
	it('are the ones expected, and every one identifies itself', async () => {
		const automatic = DIRECTORIES.filter((directory) => directory.autoSubmit).map((directory) => directory.id);
		assert.deepEqual(automatic, ['alldle', 'dle-arena', 'dailydles', 'dailies-games', 'dailydle', 'playlin']);
		const { sent } = await send('playlin', 200, { success: true });
		assert.match(sent[0]!.headers.get('user-agent') ?? '', /^dle-submit-mcp\//);
	});

	it('Alldle: sends the name and link, and reads "already listed"', async () => {
		const first = await send('alldle', 200, { success: true, data: { id: 'x' } });
		assert.equal(first.sent[0]!.url, 'https://api.alldle.net/games/submit');
		assert.deepEqual(first.sent[0]!.body, { name: 'Riverdle', url: 'https://riverdle.example.com/' });
		assert.equal(first.outcome.outcome, 'submitted');
		const again = await send('alldle', 200, { success: true, data: { listed: { slug: 'riverdle' } } });
		assert.equal(again.outcome.outcome, 'listed');
		assert.equal(again.outcome.reference, 'https://www.alldle.net/game/riverdle');
		const refused = await send('alldle', 400, { success: false, error: [{ message: 'URL must use HTTPS' }] });
		assert.equal(refused.outcome.outcome, 'failed');
		assert.match(refused.outcome.detail, /URL must use HTTPS/);
	});

	it('Playlin: needs an email and leaves the decoy field empty', async () => {
		const { outcome, sent } = await send('playlin', 201, { success: true });
		assert.equal(outcome.outcome, 'submitted');
		assert.equal(sent[0]!.url, 'https://api.playlin.io/v1/submissions/game');
		assert.equal(sent[0]!.body.website, '');
		assert.equal(sent[0]!.body.submitterEmail, 'sam@example.com');
		assert.equal(sent[0]!.body.form, 'submit');
		const { outcome: noEmail, sent: none } = await send('playlin', 200, {}, { ...full, contactEmail: undefined });
		assert.equal(noEmail.outcome, 'failed');
		assert.equal(none.length, 0, 'nothing is sent without an email');
	});

	it('DLE Arena: maps the category, checks lengths, reads its statuses', async () => {
		const { outcome, sent } = await send('dle-arena', 200, { code: 0, data: { status: 'created' } });
		assert.equal(outcome.outcome, 'submitted');
		assert.equal(sent[0]!.body.category, 'geography');
		assert.equal(sent[0]!.body.company, '');
		const listed = await send('dle-arena', 200, { code: 0, data: { status: 'already_listed' } });
		assert.equal(listed.outcome.outcome, 'listed');
		const short = await send('dle-arena', 200, {}, { ...full, description: 'Too short.' });
		assert.equal(short.outcome.outcome, 'failed');
		assert.equal(short.sent.length, 0);
		const unknownTheme = await send('dle-arena', 200, {}, { ...full, category: 'Miscellany', name: 'Geography quiz', tagline: 'Something odd every day.' });
		assert.equal(unknownTheme.outcome.outcome, 'failed');
		assert.match(unknownTheme.outcome.detail, /category set to one of: word, geography/);
		const chosen = await send('dle-arena', 200, { code: 0, data: { status: 'created' } }, { ...full, category: 'Miscellany' }, { category: 'trivia' });
		assert.equal(chosen.sent[0]!.body.category, 'trivia');
	});

	it('Dailydles: sends only the keys its schema allows', async () => {
		const { outcome, sent } = await send('dailydles', 200, { ok: true });
		assert.equal(outcome.outcome, 'submitted');
		assert.deepEqual(Object.keys(sent[0]!.body).sort(), ['category', 'email', 'name', 'notes', 'tagline', 'url', 'website']);
		assert.equal(sent[0]!.body.category, 'geography');
		assert.equal(sent[0]!.body.website, '');
		const refused = await send('dailydles', 422, { error: 'url' });
		assert.equal(refused.outcome.outcome, 'failed');
	});

	it('Dailies.games: sends a guest game submission', async () => {
		const { outcome, sent } = await send('dailies-games', 200, { message: 'Submitted.' });
		assert.equal(outcome.outcome, 'submitted');
		assert.equal(sent[0]!.body.submissionType, 'game');
		assert.equal(sent[0]!.body.gameUrl, 'https://riverdle.example.com/');
	});

	it('Dailydle: submits as the creator and needs code 0', async () => {
		const { outcome, sent } = await send('dailydle', 200, { code: 0, data: { id: 1 } });
		assert.equal(outcome.outcome, 'submitted');
		assert.equal(sent[0]!.body.submitterRelationship, 'creator');
		assert.equal(sent[0]!.body.language, 'en');
		const refused = await send('dailydle', 200, { code: 1, message: 'Already submitted' });
		assert.equal(refused.outcome.outcome, 'failed');
		assert.match(refused.outcome.detail, /Already submitted/);
	});

	it('turns a network failure into a reason, not a crash', async () => {
		const fetcher = (async () => {
			throw new TypeError('fetch failed');
		}) as typeof fetch;
		const outcome = await findDirectory('dailydles').autoSubmit!({ profile: full, fetcher });
		assert.equal(outcome.outcome, 'failed');
		assert.match(outcome.detail, /Could not reach Dailydles/);
	});
});

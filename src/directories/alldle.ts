import { sameGame } from '../games.ts';
import { describeError, request } from '../http.ts';
import type { CheckOutcome, Directory, SubmitContext, SubmitOutcome } from './types.ts';

const API = 'https://api.alldle.net';
const SITE = 'https://www.alldle.net';

interface SubmitResponse {
	success?: boolean;
	message?: string;
	data?: { listed?: { slug?: string; name?: string } };
	error?: Array<{ message?: string }> | string;
}

interface SearchResponse {
	data?: { games?: Array<{ slug?: string; name?: string }> };
}

interface GameResponse {
	data?: { url?: string; slug?: string; status?: string };
}

function errorText(body: SubmitResponse | undefined, status: number): string {
	if (Array.isArray(body?.error)) {
		const messages = body.error.map((issue) => issue.message).filter((message): message is string => Boolean(message));
		if (messages.length > 0) return messages.join('; ');
	}
	if (typeof body?.error === 'string') return body.error;
	return body?.message ?? `HTTP ${status}`;
}

function parseJson<T>(text: string): T | undefined {
	try {
		return JSON.parse(text) as T;
	} catch {
		return undefined;
	}
}

async function submit({ profile, fetcher }: SubmitContext): Promise<SubmitOutcome> {
	if (!profile.url.startsWith('https://')) {
		return { outcome: 'failed', detail: 'Alldle only lists games served over https://. Save the game with its https link.' };
	}
	try {
		const response = await request(
			`${API}/games/submit`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ name: profile.name, url: profile.url })
			},
			{ fetcher }
		);
		const body = parseJson<SubmitResponse>(response.text);
		if (!response.ok || body?.success !== true) {
			return { outcome: 'failed', detail: `Alldle refused it: ${errorText(body, response.status)}.` };
		}
		const listed = body.data?.listed;
		if (listed?.slug) {
			return { outcome: 'listed', detail: 'Alldle already lists this game.', reference: `${SITE}/game/${listed.slug}` };
		}
		return { outcome: 'submitted', detail: 'Sent to Alldle. A person reviews it before it appears.' };
	} catch (error) {
		return { outcome: 'failed', detail: `Could not reach Alldle: ${describeError(error)}.` };
	}
}

/** Searches by name, then compares each match's link with the game's. */
async function check({ profile, fetcher }: SubmitContext): Promise<CheckOutcome> {
	try {
		const search = await request(`${API}/search?q=${encodeURIComponent(profile.name)}`, { headers: { accept: 'application/json' } }, { fetcher });
		if (!search.ok) return { found: 'unknown', detail: `Alldle's search answered HTTP ${search.status}.` };
		const games = parseJson<SearchResponse>(search.text)?.data?.games ?? [];
		for (const game of games.slice(0, 5)) {
			if (!game.slug) continue;
			const detail = await request(`${API}/games/${encodeURIComponent(game.slug)}`, { headers: { accept: 'application/json' } }, { fetcher });
			const url = parseJson<GameResponse>(detail.text)?.data?.url;
			if (url && sameGame(profile.url, url)) {
				return { found: 'yes', detail: `Listed on Alldle as "${game.name ?? game.slug}".`, reference: `${SITE}/game/${game.slug}` };
			}
		}
		return { found: 'no', detail: 'Not listed on Alldle yet.' };
	} catch (error) {
		return { found: 'unknown', detail: `Could not reach Alldle: ${describeError(error)}.` };
	}
}

export const alldle: Directory = {
	id: 'alldle',
	name: 'Alldle',
	url: SITE,
	submitUrl: `${SITE}/submit`,
	method: 'api',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Directory of daily games with a page per game, categories, universes and player profiles.',
	fields: [
		{ source: 'name', label: 'Name', required: true, maxLength: 100 },
		{ source: 'url', label: 'Link to the game', required: true, note: 'Must start with https://' }
	],
	steps: [
		'Call submit with directory "alldle": it is sent directly, no account needed.',
		`Or paste the name and link into ${SITE}/submit.`
	],
	tips: ['Duplicates and re-hosts are caught at review: submit the original link.'],
	autoSubmit: submit,
	check,
	afterListing: [
		`Claim the game on ${SITE}/creator to edit its page and see who plays it and whether they come back.`,
		'Alldle has its own MCP server for managing a listed game from an assistant: https://api.alldle.net/mcp'
	],
	verified: '2026-11-24'
};

import { randomUUID } from 'node:crypto';
import { sameGame } from '../games.ts';
import { describeError, request } from '../http.ts';
import type { CheckOutcome, Directory, SubmitContext, SubmitOutcome } from './types.ts';

const API = 'https://api.playlin.io';

interface SearchResponse {
	data?: { results?: Array<{ slug?: string; title?: string; url?: string }> };
}

function parseJson<T>(text: string): T | undefined {
	try {
		return JSON.parse(text) as T;
	} catch {
		return undefined;
	}
}

/** What the maker would type in the comments box: the game in a sentence or two. */
function comments(context: SubmitContext): string {
	const { profile } = context;
	return [profile.tagline, profile.description, profile.languages?.length ? `Languages: ${profile.languages.join(', ')}.` : undefined]
		.filter(Boolean)
		.join('\n\n')
		.slice(0, 1500);
}

/**
 * The same request playlin.io/submit/ sends: JSON to its public API, no account,
 * no captcha. "website" is the form's honeypot and stays empty, as it does for a
 * person.
 */
async function submit(context: SubmitContext): Promise<SubmitOutcome> {
	const { profile, fetcher } = context;
	if (!profile.contactEmail) {
		return { outcome: 'failed', detail: 'Playlin requires a contact email. Add contactEmail with save_game, then submit again.' };
	}
	try {
		const response = await request(
			`${API}/v1/submissions/game`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({
					gameUrl: profile.url,
					gameName: profile.name,
					creatorName: profile.creatorName ?? '',
					studio: '',
					submitterName: profile.creatorName ?? '',
					submitterEmail: profile.contactEmail,
					comments: comments(context),
					moreGames: '',
					subscribe: false,
					website: '',
					deviceUuid: `device_${randomUUID()}`,
					form: 'submit'
				})
			},
			{ fetcher }
		);
		if (response.ok) return { outcome: 'submitted', detail: 'Sent to Playlin. They review submissions by hand.' };
		const body = parseJson<{ message?: string; error?: string }>(response.text);
		const reason = body?.message ?? body?.error ?? `HTTP ${response.status}`;
		return { outcome: 'failed', detail: `Playlin refused it: ${String(reason).slice(0, 200)}.` };
	} catch (error) {
		return { outcome: 'failed', detail: `Could not reach Playlin: ${describeError(error)}.` };
	}
}

/** Playlin's search matches names, not links, so each result's link is compared. */
async function check({ profile, fetcher }: SubmitContext): Promise<CheckOutcome> {
	try {
		const response = await request(`${API}/v1/search/?q=${encodeURIComponent(profile.name)}`, { headers: { accept: 'application/json' } }, { fetcher });
		if (!response.ok) return { found: 'unknown', detail: `Playlin's search answered HTTP ${response.status}.` };
		const results = parseJson<SearchResponse>(response.text)?.data?.results ?? [];
		const exact = results.find((result) => result.url && sameGame(profile.url, result.url));
		if (exact) {
			return { found: 'yes', detail: `Listed on Playlin as "${exact.title ?? exact.slug}".`, reference: exact.slug ? `https://playlin.io/game/${exact.slug}/` : 'https://playlin.io' };
		}
		const sameName = results.find((result) => result.title?.trim().toLowerCase() === profile.name.trim().toLowerCase());
		if (sameName) {
			return {
				found: 'maybe',
				detail: `Playlin lists a "${sameName.title}" at ${sameName.url ?? 'another link'}. Check whether it is this game under an old link.`,
				reference: sameName.slug ? `https://playlin.io/game/${sameName.slug}/` : 'https://playlin.io'
			};
		}
		return { found: 'no', detail: 'Not found on Playlin.' };
	} catch (error) {
		return { found: 'unknown', detail: `Could not reach Playlin: ${describeError(error)}.` };
	}
}

export const playlin: Directory = {
	id: 'playlin',
	name: 'Playlin',
	url: 'https://playlin.io',
	submitUrl: 'https://playlin.io/submit/',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Directory of daily games with collections, a weekly chart, awards and maker interviews.',
	fields: [
		{ source: 'url', label: 'Game URL', required: true },
		{ source: 'name', label: 'Game name', required: true },
		{ source: 'creatorName', label: 'Creator name', required: false },
		{ source: 'contactEmail', label: 'Your email', required: true },
		{ source: 'description', label: 'Comments', required: false }
	],
	steps: ['Call submit with directory "playlin": it is sent from here (a contact email is required).', 'Or fill the form at https://playlin.io/submit/.'],
	tips: ['Several games by the same maker can go in one submission: the form has a "more games" box.'],
	autoSubmit: submit,
	check,
	verified: '2026-11-24'
};

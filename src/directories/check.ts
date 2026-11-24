import { hostOf, linkRelation, slugify, type LinkRelation } from '../games.ts';
import { describeError, request } from '../http.ts';
import type { CheckOutcome, SubmitContext } from './types.ts';

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const RANK: Record<LinkRelation, number> = { same: 2, related: 1, none: 0 };

/**
 * How the best link to the game's host on a page relates to the game: every
 * address on that host is compared, path included, so a list that links
 * nytimes.com/games/wordle does not count as listing another NYT game. A bare
 * mention of the host ("globle-game.com" as text) counts as its home page.
 */
export function linkOnPage(text: string, gameUrl: string): LinkRelation {
	const host = hostOf(gameUrl);
	const page = text.replace(/\\\//g, '/');
	// The host must stand alone: "dle.com" is neither "wordle.com" nor "dle.com.example.net".
	const hostPattern = `(?:www\\.)?${escapeRegExp(host)}(?![a-z0-9-]|\\.[a-z0-9])`;
	let best: LinkRelation = 'none';
	for (const match of page.matchAll(new RegExp(`(?:https?:)?//${hostPattern}((?:[/?#][^\\s"'<>()\\[\\]\\\\&]*)?)`, 'gi'))) {
		const relation = linkRelation(gameUrl, `https://${host}${match[1] ?? ''}`);
		if (RANK[relation] > RANK[best]) best = relation;
		if (best === 'same') return best;
	}
	for (const match of page.matchAll(new RegExp(`(^|[^a-z0-9./-])${hostPattern}`, 'gi'))) {
		if (match.index === undefined) continue;
		const relation = linkRelation(gameUrl, `https://${host}/`);
		if (RANK[relation] > RANK[best]) best = relation;
		if (best === 'same') return best;
	}
	return best;
}

/** Whether one of the page's own paths is named after the game: /games/pokedle. */
export function mentionsGameSlug(text: string, gameName: string): boolean {
	const slug = slugify(gameName);
	if (slug.length < 4) return false;
	const pattern = new RegExp(`/${escapeRegExp(slug)}(?:/|"|'|<|\\?|#|\\s|$)`, 'i');
	return pattern.test(text);
}

/**
 * Looks for the game on one public page (a list, a sitemap, a data file). A link
 * to the game counts as listed; a page named after it only as a maybe, since two
 * games can share a name.
 */
export async function lookOnPage(context: SubmitContext, pageUrl: string, label: string = pageUrl): Promise<CheckOutcome> {
	try {
		const page = await request(pageUrl, { headers: { accept: 'text/html,application/xml,application/json,*/*' } }, { fetcher: context.fetcher });
		if (!page.ok) return { found: 'unknown', detail: `${label} answered HTTP ${page.status}.` };
		const relation = linkOnPage(page.text, context.profile.url);
		if (relation === 'same') {
			return { found: 'yes', detail: `${label} links to the game.`, reference: pageUrl };
		}
		if (relation === 'related') {
			return {
				found: 'maybe',
				detail: `${label} links to ${hostOf(context.profile.url)}, but not to this game's page. Check whether it lists this game.`,
				reference: pageUrl
			};
		}
		if (mentionsGameSlug(page.text, context.profile.name)) {
			return {
				found: 'maybe',
				detail: `${label} has a page named after "${context.profile.name}". Open it to check it is this game.`,
				reference: pageUrl
			};
		}
		return { found: 'no', detail: `Not found on ${label}.` };
	} catch (error) {
		return { found: 'unknown', detail: `Could not read ${label}: ${describeError(error)}.` };
	}
}

/** Tries pages in order and keeps the most certain answer. */
export async function lookOnPages(context: SubmitContext, pages: ReadonlyArray<{ url: string; label?: string }>): Promise<CheckOutcome> {
	let best: CheckOutcome | undefined;
	const rank: Record<CheckOutcome['found'], number> = { yes: 3, maybe: 2, no: 1, unknown: 0 };
	for (const page of pages) {
		const outcome = await lookOnPage(context, page.url, page.label);
		if (outcome.found === 'yes') return outcome;
		if (!best || rank[outcome.found] > rank[best.found]) best = outcome;
	}
	return best ?? { found: 'unknown', detail: 'No page to look on.' };
}

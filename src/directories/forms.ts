import { pickCategory, type Theme } from '../categories.ts';
import { describeError, request } from '../http.ts';
import { lookOnPage } from './check.ts';
import type { Directory, SubmitContext, SubmitOutcome } from './types.ts';

/*
 * Directories whose public submission form sends one JSON request, with no
 * account, no captcha and nothing that tries to tell people from scripts. This
 * server sends the same request the form does. A decoy field ("honeypot") stays
 * empty, as it does for a person.
 */

interface PostResult {
	ok: boolean;
	status: number;
	body: unknown;
}

async function postJson(context: SubmitContext, url: string, payload: unknown): Promise<PostResult> {
	const response = await request(
		url,
		{ method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) },
		{ fetcher: context.fetcher }
	);
	let body: unknown;
	try {
		body = JSON.parse(response.text);
	} catch {
		body = undefined;
	}
	return { ok: response.ok, status: response.status, body };
}

/** The reason a directory gave, kept short: it is shown to the assistant as is. */
function reasonOf(result: PostResult): string {
	const body = result.body as { error?: unknown; message?: unknown; msg?: unknown } | undefined;
	const reason = body?.error ?? body?.message ?? body?.msg;
	const text = typeof reason === 'string' ? reason : reason ? JSON.stringify(reason) : `HTTP ${result.status}`;
	return text.replace(/[\p{C}]+/gu, ' ').slice(0, 200);
}

function failed(name: string, error: unknown): SubmitOutcome {
	return { outcome: 'failed', detail: `Could not reach ${name}: ${describeError(error)}.` };
}

function needs(name: string, what: string): SubmitOutcome {
	return { outcome: 'failed', detail: `${name} requires ${what}. Add it with save_game, then submit again.` };
}

function categoryNeeded(name: string, choices: readonly string[]): SubmitOutcome {
	return {
		outcome: 'failed',
		detail: `Could not tell which ${name} category fits. Call submit for this directory alone with category set to one of: ${choices.join(', ')}.`
	};
}

function shortDescription(context: SubmitContext): string | undefined {
	return context.profile.description ?? context.profile.tagline;
}

// DLE Arena ------------------------------------------------------------------

const ARENA_CATEGORIES = ['word', 'geography', 'trivia', 'logic', 'media'] as const;
const ARENA_MAPPING: Partial<Record<Theme, string>> = {
	words: 'word',
	geography: 'geography',
	'math-logic': 'logic',
	music: 'media',
	'movies-tv': 'media',
	gaming: 'media',
	anime: 'media',
	trivia: 'trivia',
	history: 'trivia',
	'science-nature': 'trivia',
	food: 'trivia',
	sports: 'trivia',
	pictures: 'trivia'
};

async function submitDleArena(context: SubmitContext): Promise<SubmitOutcome> {
	const { profile } = context;
	if (!profile.contactEmail) return needs('DLE Arena', 'a contact email');
	const tagline = profile.tagline ?? '';
	if (tagline.length < 10) return needs('DLE Arena', 'a tagline of at least 10 characters');
	const description = profile.description ?? '';
	if (description.length < 40) return needs('DLE Arena', 'a description of at least 40 characters');
	const category = pickCategory(profile, ARENA_CATEGORIES, ARENA_MAPPING, context.category);
	if (!category) return categoryNeeded('DLE Arena', ARENA_CATEGORIES);
	try {
		const result = await postJson(context, 'https://dlearena.com/api/submissions', {
			name: profile.name,
			url: profile.url,
			category,
			tagline: tagline.slice(0, 140),
			description: description.slice(0, 1500),
			howToPlay: '',
			email: profile.contactEmail,
			company: ''
		});
		const body = result.body as { code?: number; data?: { status?: string } } | undefined;
		if (!result.ok || body?.code !== 0) return { outcome: 'failed', detail: `DLE Arena refused it: ${reasonOf(result)}.` };
		const status = body.data?.status;
		if (status === 'already_listed') return { outcome: 'listed', detail: 'DLE Arena already lists this game.', reference: 'https://dlearena.com' };
		if (status === 'already_submitted') return { outcome: 'submitted', detail: 'DLE Arena already had this game in its review queue.' };
		return { outcome: 'submitted', detail: 'Sent to DLE Arena. They play every submission and email the result.' };
	} catch (error) {
		return failed('DLE Arena', error);
	}
}

export const dleArena: Directory = {
	id: 'dle-arena',
	name: 'DLE Arena',
	url: 'https://dlearena.com',
	submitUrl: 'https://dlearena.com/submit-a-game/',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Reviewed directory with a guide page per game.',
	fields: [
		{ source: 'name', label: 'Game name', required: true },
		{ source: 'url', label: 'Link', required: true },
		{ source: 'category', label: 'Category', required: true, note: 'word, geography, trivia, logic or media.' },
		{ source: 'contactEmail', label: 'Email', required: true },
		{ source: 'tagline', label: 'One-line description', required: true, maxLength: 140, note: 'At least 10 characters.' },
		{ source: 'description', label: 'What is your game?', required: true, maxLength: 1500, note: 'At least 40 characters.' }
	],
	steps: ['Call submit with directory "dle-arena": it is sent from here.', 'Or fill the form at https://dlearena.com/submit-a-game/.'],
	tips: ['Listing is free while the site launches; a fee is announced for later.'],
	autoSubmit: submitDleArena,
	check: (context) => lookOnPage(context, 'https://dlearena.com/games/sitemap.xml', 'DLE Arena\'s sitemap'),
	verified: '2026-11-24'
};

// Dailydles ------------------------------------------------------------------

const DAILYDLES_CATEGORIES = [
	'words',
	'geography',
	'food',
	'movies-tv',
	'music',
	'gaming',
	'anime',
	'sports',
	'science-nature',
	'math-logic',
	'trivia',
	'history',
	'pictures',
	'misc'
] as const;

async function submitDailydles(context: SubmitContext): Promise<SubmitOutcome> {
	const { profile } = context;
	if (!profile.url.startsWith('https://')) return needs('Dailydles', 'an https:// link');
	const identity = Object.fromEntries(DAILYDLES_CATEGORIES.map((category) => [category, category])) as Partial<Record<Theme, string>>;
	const category = pickCategory(profile, DAILYDLES_CATEGORIES, identity, context.category, 'misc') ?? 'misc';
	try {
		const result = await postJson(context, 'https://su4skekh3wcgmh33llbpzg7xxa0edwrg.lambda-url.eu-west-2.on.aws/', {
			url: profile.url.slice(0, 300),
			name: profile.name.slice(0, 60),
			category,
			tagline: (profile.tagline ?? '').slice(0, 120),
			email: profile.contactEmail ?? '',
			notes: (profile.description ?? '').slice(0, 500),
			website: ''
		});
		if (!result.ok) return { outcome: 'failed', detail: `Dailydles refused it: ${reasonOf(result)}.` };
		return { outcome: 'submitted', detail: 'Sent to Dailydles. Someone plays every game before it goes live.' };
	} catch (error) {
		return failed('Dailydles', error);
	}
}

export const dailydles: Directory = {
	id: 'dailydles',
	name: 'Dailydles',
	url: 'https://dailydles.com',
	submitUrl: 'https://dailydles.com/submit',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Hand-checked list of daily games, each one played before it goes live.',
	fields: [
		{ source: 'url', label: 'Link', required: true, maxLength: 300 },
		{ source: 'name', label: 'Name', required: true, maxLength: 60 },
		{ source: 'category', label: 'Category', required: true },
		{ source: 'tagline', label: 'One line pitch', required: false, maxLength: 120 },
		{ source: 'contactEmail', label: 'Email', required: false },
		{ source: 'description', label: 'Notes', required: false, maxLength: 500 }
	],
	steps: ['Call submit with directory "dailydles": it is sent from here.', 'Or fill the form at https://dailydles.com/submit.'],
	tips: ['Their rules: free, plays in a browser, a real daily puzzle, no account wall.'],
	autoSubmit: submitDailydles,
	check: (context) => lookOnPage(context, 'https://dailydles.com/catalog.json', 'Dailydles\' catalogue'),
	verified: '2026-11-24'
};

// Dailies.games --------------------------------------------------------------

async function submitDailiesGames(context: SubmitContext): Promise<SubmitOutcome> {
	const { profile } = context;
	try {
		const result = await postJson(context, 'https://dailies.games/api/submit', {
			submissionType: 'game',
			gameName: profile.name,
			gameUrl: profile.url,
			category: 'Submitted game',
			message: '',
			email: '',
			submittedBy: 'Anonymous',
			submittedByRole: 'guest',
			provider: 'local',
			twitchId: '',
			twitchLogin: '',
			discordId: '',
			discordUsername: '',
			avatarUrl: ''
		});
		if (!result.ok) return { outcome: 'failed', detail: `Dailies.games refused it: ${reasonOf(result)}.` };
		return { outcome: 'submitted', detail: 'Sent to Dailies.games. Games are screened before they show up.' };
	} catch (error) {
		return failed('Dailies.games', error);
	}
}

export const dailiesGames: Directory = {
	id: 'dailies-games',
	name: 'Dailies.games',
	url: 'https://dailies.games',
	submitUrl: 'https://dailies.games/submit',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'List of daily games with community votes.',
	fields: [
		{ source: 'name', label: 'Game name', required: true },
		{ source: 'url', label: 'Game link', required: true }
	],
	steps: ['Call submit with directory "dailies-games": it is sent from here.', 'Or fill the form at https://dailies.games/submit.'],
	autoSubmit: submitDailiesGames,
	check: (context) => lookOnPage(context, 'https://dailies.games/sitemap.xml', 'Dailies.games\' sitemap'),
	verified: '2026-11-24'
};

// Dailydle -------------------------------------------------------------------

function languageCode(context: SubmitContext): string {
	const first = context.profile.languages?.[0]?.trim().toLowerCase();
	return first && /^[a-z]{2}$/.test(first) ? first : 'en';
}

async function submitDailydle(context: SubmitContext): Promise<SubmitOutcome> {
	const { profile } = context;
	if (!profile.contactEmail) return needs('Dailydle', 'a contact email from the game\'s maker');
	const why = [shortDescription(context), profile.category ? `Category: ${profile.category}.` : undefined].filter(Boolean).join('\n\n');
	try {
		const result = await postJson(context, 'https://www.dailydle.org/api/games/submissions', {
			url: profile.url,
			title: profile.name,
			categorySuggestion: '',
			language: languageCode(context),
			thumbnailUrl: profile.imageUrl ?? '',
			submitterName: profile.creatorName ?? '',
			submitterEmail: profile.contactEmail,
			whyInteresting: why.slice(0, 1000),
			submitterRelationship: 'creator',
			sourceUrlClaim: 'unknown',
			embedPermissionClaim: 'unknown',
			playModeSuggestion: 'unknown',
			requiresLoginSuggestion: 'unknown',
			hasArchiveSuggestion: 'unknown'
		});
		const body = result.body as { code?: number } | undefined;
		if (!result.ok || body?.code !== 0) return { outcome: 'failed', detail: `Dailydle refused it: ${reasonOf(result)}.` };
		return { outcome: 'submitted', detail: 'Sent to Dailydle, in its free review queue.' };
	} catch (error) {
		return failed('Dailydle', error);
	}
}

export const dailydle: Directory = {
	id: 'dailydle',
	name: 'Dailydle',
	url: 'https://www.dailydle.org',
	submitUrl: 'https://www.dailydle.org/submit',
	method: 'form',
	account: false,
	cost: 'free_or_paid',
	captcha: false,
	about: 'Directory of daily games by category, with listing criteria and creator pages.',
	fields: [
		{ source: 'url', label: 'Game URL', required: true },
		{ source: 'name', label: 'Title', required: true },
		{ source: 'languages', label: 'Language', required: false },
		{ source: 'creatorName', label: 'Your name', required: false },
		{ source: 'contactEmail', label: 'Email', required: true, note: 'Required when you are the creator.' },
		{ source: 'description', label: 'Why add it', required: false }
	],
	steps: ['Call submit with directory "dailydle": it is sent from here as the game\'s creator.', 'Or fill the form at https://www.dailydle.org/submit.'],
	tips: ['Free queue. Paid options exist (priority review, launch boost); they are offered after submitting and are not needed to be listed.'],
	autoSubmit: submitDailydle,
	check: (context) => lookOnPage(context, 'https://www.dailydle.org/sitemap.xml', 'Dailydle\'s sitemap'),
	verified: '2026-11-24'
};

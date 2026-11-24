import { z } from 'zod';

const HTTP_LINK = /^https?:\/\//i;

/**
 * What a maker tells us about their game once, so every directory's form can be
 * filled from it. Only the name and the link are required: most directories ask
 * for little more, and the rest is offered when a directory wants it.
 */
export const gameProfileSchema = z.object({
	name: z.string().trim().min(1).max(100).describe('The game\'s name, as players know it.'),
	url: z
		.string()
		.trim()
		.url()
		.regex(HTTP_LINK, 'Must start with http:// or https://')
		.describe('The page where the game is played, starting with https://.'),
	tagline: z
		.string()
		.trim()
		.max(140)
		.optional()
		.describe('One line that says what you guess, under 140 characters. "Guess the Pokémon from its cry."'),
	description: z
		.string()
		.trim()
		.max(1000)
		.optional()
		.describe('Two to four sentences: what you guess, the clues you get, how often there is a new puzzle.'),
	category: z
		.string()
		.trim()
		.max(60)
		.optional()
		.describe('The main theme, in plain words: words, geography, music, movies, TV, sports, video games, anime, trivia, maths, logic, history, science, food, art...'),
	tags: z.array(z.string().trim().min(1).max(40)).max(15).optional().describe('A few extra keywords, e.g. the franchise.'),
	languages: z
		.array(z.string().trim().min(2).max(20))
		.max(30)
		.optional()
		.describe('Languages the game can be played in, as codes or names: ["en", "fr"].'),
	cadence: z
		.enum(['daily', 'unlimited', 'both'])
		.optional()
		.describe('daily: one puzzle a day for everyone. unlimited: play as much as you like. both: a daily puzzle plus a free mode.'),
	creatorName: z.string().trim().max(80).optional().describe('Your name or handle, as it should be credited.'),
	contactEmail: z
		.string()
		.trim()
		.email()
		.optional()
		.describe('Where directories can reach you. Some forms require one.'),
	imageUrl: z
		.string()
		.trim()
		.url()
		.regex(HTTP_LINK, 'Must start with http:// or https://')
		.optional()
		.describe('A public link to a logo or screenshot, for directories that show one.'),
	launchDate: z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}(-\d{2})?$/)
		.optional()
		.describe('When the game came out: YYYY-MM-DD or YYYY-MM.'),
	socials: z
		.object({
			twitter: z.string().trim().url().regex(HTTP_LINK).optional(),
			bluesky: z.string().trim().url().regex(HTTP_LINK).optional(),
			discord: z.string().trim().url().regex(HTTP_LINK).optional(),
			reddit: z.string().trim().url().regex(HTTP_LINK).optional(),
			github: z.string().trim().url().regex(HTTP_LINK).optional(),
			instagram: z.string().trim().url().regex(HTTP_LINK).optional(),
			tiktok: z.string().trim().url().regex(HTTP_LINK).optional()
		})
		.optional()
		.describe('Links to the game\'s own social accounts, if any.')
});

export type GameProfile = z.infer<typeof gameProfileSchema>;
export type ProfileField = keyof GameProfile;

/** Parameters that only say where a click came from, never which page it is. */
const TRACKING_PARAMS: ReadonlySet<string> = new Set(['ref', 'ref_src', 'source', 'fbclid', 'gclid', 'mc_cid', 'mc_eid']);

/**
 * A game's identity in memory: its link without scheme, "www.", trailing slash or
 * tracking parameters. https://www.foo.com/?utm_source=x and http://foo.com are
 * the same game.
 */
export function normalizeUrl(input: string): string {
	const parsed = new URL(input.trim());
	const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
	const pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
	const params = [...parsed.searchParams.entries()]
		.filter(([key]) => !key.toLowerCase().startsWith('utm_') && !TRACKING_PARAMS.has(key.toLowerCase()))
		.sort(([a], [b]) => a.localeCompare(b));
	const search = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
	return `${hostname}${pathname}${search}`;
}

export type LinkRelation = 'same' | 'related' | 'none';

function hostPart(url: URL): string {
	return url.hostname.toLowerCase().replace(/^www\./, '');
}

function pathPart(url: URL): string {
	return url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * How a link a directory lists relates to the game's own link.
 *
 * - same: the same host, and one path inside the other. Directories often list a
 *   deeper page (globle-game.com/game) or a shorter one (/play for /play/daily).
 * - related: the directory lists only the bare domain, while the game lives at a
 *   path on it. Could be this game, could be another game on the same site.
 * - none: a different host, or a different game on the same host (site.com/a
 *   and site.com/b).
 */
export function linkRelation(gameUrl: string, listedUrl: string): LinkRelation {
	let game: URL;
	let listed: URL;
	try {
		game = new URL(gameUrl.trim());
		listed = new URL(listedUrl.trim());
	} catch {
		return 'none';
	}
	if (hostPart(game) !== hostPart(listed)) return 'none';
	const [gamePath, listedPath] = [pathPart(game), pathPart(listed)];
	if (gamePath === listedPath || gamePath === '') return 'same';
	if (listedPath === '') return 'related';
	if (gamePath.startsWith(`${listedPath}/`) || listedPath.startsWith(`${gamePath}/`)) return 'same';
	return 'none';
}

/** Whether a listed link is this game for sure. */
export function sameGame(gameUrl: string, listedUrl: string): boolean {
	return linkRelation(gameUrl, listedUrl) === 'same';
}

/** The game's host without "www.", which is how most directories' pages mention it. */
export function hostOf(input: string): string {
	return new URL(input.trim()).hostname.toLowerCase().replace(/^www\./, '');
}

/** "Pokémon Cry-dle!" becomes "pokemon-cry-dle". */
export function slugify(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Profile fields worth filling before going through directories, with why. */
export const RECOMMENDED_FIELDS: ReadonlyArray<{ field: ProfileField; why: string }> = [
	{ field: 'tagline', why: 'most forms ask for a short description' },
	{ field: 'description', why: 'several forms ask for a longer one' },
	{ field: 'category', why: 'nearly every directory files games by theme' },
	{ field: 'languages', why: 'multilingual lists and filters use it' },
	{ field: 'contactEmail', why: 'some forms require one to reach you' },
	{ field: 'creatorName', why: 'directories with creator credits show it' }
];

export function missingRecommended(profile: GameProfile): Array<{ field: ProfileField; why: string }> {
	return RECOMMENDED_FIELDS.filter(({ field }) => {
		const value = profile[field];
		return value === undefined || (Array.isArray(value) && value.length === 0);
	});
}

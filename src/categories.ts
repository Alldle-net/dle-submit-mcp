import type { GameProfile } from './games.ts';

/**
 * Themes most directories file games under. A maker writes their category in
 * their own words ("guess the footballer", "Pokémon"); each directory has its own
 * list. This is the step in between.
 */
export const THEMES = [
	'anime',
	'gaming',
	'music',
	'movies-tv',
	'sports',
	'geography',
	'food',
	'history',
	'science-nature',
	'math-logic',
	'pictures',
	'words',
	'trivia'
] as const;
export type Theme = (typeof THEMES)[number];

/** Checked in this order, so "anime quiz" is anime before it is trivia. */
const KEYWORDS: ReadonlyArray<[Theme, RegExp]> = [
	['anime', /\b(anime|manga|one piece|naruto|dragon ball|jujutsu|demon slayer|digimon)\b/i],
	[
		'gaming',
		/\b(video ?games?|gaming|pok[eé]mon|nintendo|zelda|minecraft|fortnite|valorant|league of legends|dota|overwatch|genshin|playstation|xbox|esports?|hollow knight|stardew|isaac|palworld|brawl stars|clash royale|terraria|elden ring|skyrim)\b/i
	],
	['music', /\b(music|songs?|singers?|artists?|albums?|bands?|lyrics|heardle|k-?pop)\b/i],
	['movies-tv', /\b(movies?|films?|cinema|tv|television|series|tv shows?|actors?|actress|netflix|disney|marvel|star wars|simpsons|sitcom|cartoons?)\b/i],
	[
		'sports',
		/\b(sports?|football|soccer|nba|basketball|nfl|f1|formula ?1|tennis|hockey|nhl|baseball|mlb|cricket|golf|rugby|cycling|olympics?|athletes?|footballers?|wrestling|ufc|mma|boxing)\b/i
	],
	['geography', /\b(geo|geography|countr(y|ies)|maps?|flags?|cit(y|ies)|capitals?|globe|borders?|rivers?)\b/i],
	['food', /\b(food|recipes?|cooking|dish(es)?|cuisine|drinks?|wine|cheese|fruit)\b/i],
	['history', /\b(history|historical|presidents?|kings?|queens?|wars?|empires?)\b/i],
	['science-nature', /\b(science|nature|animals?|plants?|birds?|trees?|space|planets?|chemistry|elements?|biology|dinosaurs?|insects?)\b/i],
	['math-logic', /\b(math(s|ematics)?|numbers?|logic|equations?|sudoku|arithmetic|nerdle|puzzles? of logic)\b/i],
	['pictures', /\b(pictures?|images?|photos?|art|paintings?|colou?rs?|logos?|visual|emoji)\b/i],
	['words', /\b(words?|letters?|wordle|vocabulary|anagrams?|spelling|crosswords?|connections)\b/i],
	['trivia', /\b(trivia|quiz|knowledge|general knowledge)\b/i]
];

/**
 * The game's theme, from its category, then its tags. The name and tagline are
 * left out: too many words in them mean something else.
 */
export function themeOf(profile: GameProfile): Theme | undefined {
	const sources = [profile.category, profile.tags?.join(' ')];
	for (const source of sources) {
		if (!source) continue;
		const exact = THEMES.find((theme) => theme === source.trim().toLowerCase());
		if (exact) return exact;
		for (const [theme, pattern] of KEYWORDS) if (pattern.test(source)) return theme;
	}
	return undefined;
}

/**
 * A directory's own category for the game: an explicit choice wins if it is on
 * the directory's list, then the theme's mapping, then the directory's catch-all.
 */
export function pickCategory(
	profile: GameProfile,
	choices: readonly string[],
	mapping: Partial<Record<Theme, string>>,
	explicit?: string,
	fallback?: string
): string | undefined {
	if (explicit) {
		const match = choices.find((choice) => choice.toLowerCase() === explicit.trim().toLowerCase());
		if (match) return match;
	}
	if (profile.category) {
		const direct = choices.find((choice) => choice.toLowerCase() === profile.category!.trim().toLowerCase());
		if (direct) return direct;
	}
	const theme = themeOf(profile);
	return (theme && mapping[theme]) ?? fallback;
}

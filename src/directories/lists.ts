import { lookOnPage, lookOnPages } from './check.ts';
import type { Directory } from './types.ts';

/*
 * Directories this server cannot send to on its own: a captcha, an account, a
 * GitHub issue, an email, or a form that tries to tell people from scripts. Each
 * one is prepared (fields, prefilled links) for the maker or their assistant's
 * browser to send.
 */

export const listdle: Directory = {
	id: 'listdle',
	name: 'Listdle',
	url: 'https://listdle.com',
	submitUrl: 'https://listdle.com/submit',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Directory with creator profiles, ratings, a game of the day and lists made by players.',
	fields: [
		{ source: 'url', label: 'URL', required: true },
		{ source: 'name', label: 'Title', required: true, maxLength: 40 },
		{
			source: 'category',
			label: 'Category',
			required: true,
			note: 'One of: word, sports, music, movies, games, geography, math, trivia, color, price, mystery, history, logic, spatial, estimation, memory, board, other.'
		},
		{ source: 'description', label: 'Description', required: false, maxLength: 500 },
		{ source: 'contactEmail', label: 'Email', required: false }
	],
	steps: [
		'Open https://listdle.com/submit and paste the link: it fills in the title from the page.',
		'Pick the category, add the description and email, and tick "I made this game".'
	],
	tips: [
		'Games are added within about a week, after someone plays them. They must be free, daily, and playable without logging in.',
		'A paid sponsored slot exists (https://listdle.com/sponsor); listing itself is free.'
	],
	check: (context) =>
		lookOnPages(context, [
			{ url: 'https://listdle.com/', label: 'Listdle\'s home page' },
			{ url: 'https://listdle.com/sitemap.xml', label: 'Listdle\'s sitemap' }
		]),
	verified: '2026-11-24'
};

export const dlesGg: Directory = {
	id: 'dles-gg',
	name: 'DLES.gg',
	url: 'https://dles.gg',
	submitUrl: 'https://dles.gg/submit-game',
	method: 'form',
	account: false,
	cost: 'free_or_paid',
	captcha: true,
	about: 'Directory with reviews, a ritual builder, a newsletter and a graveyard of games that stopped.',
	fields: [
		{ source: 'url', label: 'URL', required: true, note: 'Must start with https://' },
		{ source: 'name', label: 'Name', required: true },
		{ source: 'description', label: 'Description', required: true },
		{
			source: 'category',
			label: 'Category',
			required: true,
			note: 'One of: Colors, Food, Geography, Guessing, History, Misc, Movies and Series, Music, Nature, Numbers and Logic, Sports, Tabletop Games, Transport, Trivia, Video Games, Visual, Words.'
		},
		{ source: 'contactEmail', label: 'Email', required: false }
	],
	steps: ['Open https://dles.gg/submit-game, choose "I made it" (maker), fill in the fields and pass the captcha.'],
	tips: [
		'Free review by hand. An optional paid express review (£9.99) promises a verdict within 24 hours; it does not guarantee a listing.',
		'Their rules: daily, in the browser, free, no account, no gambling, not a thin wrapper around another game.'
	],
	check: (context) => lookOnPage(context, 'https://dles.gg/', 'DLES.gg\'s home page'),
	verified: '2026-11-24'
};

export const dlesIo: Directory = {
	id: 'dles-io',
	name: 'dles.io',
	url: 'https://dles.io',
	submitUrl: 'https://dles.io/submit-game',
	method: 'form',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'Large directory of daily games.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'URL', required: true },
		{ source: 'description', label: 'Description', required: false }
	],
	steps: [
		'Sign in or create an account at https://dles.io/users/register (email, or Discord).',
		'Then open https://dles.io/submit-game and fill in the form.'
	],
	tips: [
		'The form only shows after signing in, so its exact fields were not checked: have the name, link and description ready.',
		'Same-name copies of popular games and "Unlimited" clones are refused.',
		'Their contact form has a "Claiming game ownership" option for a game that is already listed.'
	],
	check: (context) =>
		lookOnPages(context, [
			{ url: `https://dles.io/all-games?search=${encodeURIComponent(context.profile.name)}`, label: 'dles.io\'s search' },
			{ url: 'https://dles.io/sitemap.xml', label: 'dles.io\'s sitemap' }
		]),
	verified: '2026-11-24'
};

export const dailyGameList: Directory = {
	id: 'daily-game-list',
	name: 'Daily Game List',
	url: 'https://dailygamelist.com',
	submitUrl: 'https://dailygamelist.com/contact',
	method: 'contact',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Short list of daily games, each one checked by hand.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'Official address', required: true }
	],
	steps: ['Write to them through https://dailygamelist.com/contact with the text above.'],
	tips: ['Send the game\'s official address: the list checks it is free in a browser with a shared puzzle on a schedule.'],
	check: (context) => lookOnPage(context, 'https://dailygamelist.com/', 'Daily Game List\'s home page'),
	verified: '2026-11-24'
};

export const adoryVo: Directory = {
	id: 'adory-vo',
	name: 'Adory Vo\'s dailies',
	url: 'https://adoryvo.github.io/lists/dailies.html',
	submitUrl: 'https://github.com/AdoryVo/lists/issues',
	method: 'github_issue',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'Hand-written list of daily games, with curated sub-lists.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'Link', required: true },
		{ source: 'tagline', label: 'Description', required: false }
	],
	github: { repo: 'AdoryVo/lists', title: (profile) => `Daily suggestion: ${profile.name}` },
	email: 'business@adoryvo.com',
	steps: [
		'Open the prefilled GitHub issue (needs a GitHub account) and submit it.',
		'Without a GitHub account, email business@adoryvo.com with the same text.'
	],
	tips: ['Suggestions pile up and are merged in batches: expect a wait.', 'For a site with several small games, the list links the site, not each game.'],
	entry: (profile) => `- [${profile.name}](${profile.url})${profile.tagline ? ` - ${profile.tagline}` : ''}`,
	check: (context) => lookOnPage(context, 'https://raw.githubusercontent.com/AdoryVo/lists/main/dailies.md', 'Adory Vo\'s list'),
	verified: '2026-11-24'
};

export const relaydle: Directory = {
	id: 'relaydle',
	name: 'relaydle',
	url: 'https://relaydle.com',
	submitUrl: 'https://relaydle.com/submit',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Multilingual directory (English, French, Spanish, German, Portuguese, Italian) with cross-promotion between games.',
	fields: [{ source: 'url', label: 'Game URL', required: true }],
	steps: [
		'Open https://relaydle.com/submit and paste the link: it reads the page, then asks you to confirm themes and languages.',
		'Check what it read against the saved languages and category, then send.'
	],
	verified: '2026-11-24'
};

export const seekdle: Directory = {
	id: 'seekdle',
	name: 'Seekdle',
	url: 'https://seekdle.com',
	submitUrl: 'https://seekdle.com/submit/',
	method: 'email',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Large list of daily games by category, with an optional badge for listed games.',
	scope: 'English, family-friendly games only',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'URL', required: true },
		{ source: 'category', label: 'Category', required: true },
		{ source: 'tagline', label: 'One-line description', required: true },
		{ source: 'creatorName', label: 'Your relationship to the game', required: false, note: 'Say you made it.' }
	],
	email: 'hello@seekdle.com',
	steps: ['Send the email above (the link opens it already written), and say you are the game\'s maker.'],
	check: (context) => lookOnPage(context, 'https://seekdle.com/dle-games-list/', 'Seekdle\'s list'),
	verified: '2026-11-24'
};

export const wordleWeb: Directory = {
	id: 'wordleweb',
	name: 'WordleWeb',
	url: 'https://github.com/rarelygoeshere/WordleWeb',
	submitUrl: 'https://github.com/rarelygoeshere/WordleWeb',
	method: 'github_pr',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'List of Wordle-like games kept in a GitHub README, newest first.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'Link', required: true },
		{ source: 'description', label: 'Description', required: true }
	],
	github: { repo: 'rarelygoeshere/WordleWeb', title: (profile) => `Add ${profile.name}` },
	steps: [
		'Fork the repository and add the entry below near the top of README.md, after the introduction, as the newest entries are.',
		'Open a pull request titled "Add <game name>".'
	],
	tips: ['Pull requests are merged regularly.'],
	entry: (profile) => `# [${profile.name}](${profile.url})\n- [${profile.name}](${profile.url}) ${profile.description ?? profile.tagline ?? ''}`.trimEnd(),
	check: (context) => lookOnPage(context, 'https://raw.githubusercontent.com/rarelygoeshere/WordleWeb/main/README.md', 'WordleWeb\'s README'),
	verified: '2026-11-24'
};

export const awesomeWordle: Directory = {
	id: 'awesome-wordle',
	name: 'awesome-wordle',
	url: 'https://github.com/andycyca/awesome-wordle',
	submitUrl: 'https://github.com/andycyca/awesome-wordle',
	method: 'github_pr',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'Awesome-list of Wordle variants, grouped by kind.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'Link', required: true },
		{ source: 'category', label: 'Theme (the text before the colon)', required: true }
	],
	github: { repo: 'andycyca/awesome-wordle', title: (profile) => `Add ${profile.name}` },
	steps: ['Fork the repository, add the entry below to README.md in the section that fits, in alphabetical order, and open a pull request.'],
	tips: ['Pull requests are merged in batches.'],
	entry: (profile) => `-   ${profile.category ?? 'Theme'}: [${profile.name}](${profile.url})`,
	check: (context) => lookOnPage(context, 'https://raw.githubusercontent.com/andycyca/awesome-wordle/main/README.md', 'awesome-wordle\'s README'),
	verified: '2026-11-24'
};

export const dlegamesOrg: Directory = {
	id: 'dlegames-org',
	name: 'dlegames.org',
	url: 'https://dlegames.org',
	submitUrl: 'https://dlegames.org/submit',
	method: 'form',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'Directory with a page per game and guides.',
	fields: [
		{ source: 'name', label: 'Name', required: true, maxLength: 120 },
		{ source: 'url', label: 'URL', required: true },
		{
			source: 'category',
			label: 'Category',
			required: false,
			note: 'Word, Geography, History, Science & Nature, Music, TV, Movies, Gaming, Sports, Math, Logic, Color, Visual, Estimation, Board & Card, Quiz & Trivia, Higher or Lower, Other.'
		},
		{ source: 'description', label: 'Description', required: true, maxLength: 1000 }
	],
	steps: ['Sign in with Google at https://dlegames.org/submit, then fill in the form.'],
	tips: ['Up to 10 submissions a day per account.'],
	check: (context) => lookOnPage(context, 'https://dlegames.org/sitemap.xml', 'dlegames.org\'s sitemap'),
	verified: '2026-11-24'
};

export const dleGames: Directory = {
	id: 'dle-games',
	name: 'dle.games (formerly LikeWordle)',
	url: 'https://dle.games',
	submitUrl: 'https://dle.games/submit',
	method: 'form',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'App-style directory of daily games; likewordle.com now redirects here.',
	fields: [
		{ source: 'name', label: 'Title', required: true },
		{ source: 'url', label: 'Game URL', required: true },
		{ source: 'description', label: 'Description', required: false },
		{ source: 'category', label: 'Category', required: false },
		{ source: 'tags', label: 'Tags', required: false },
		{ source: 'imageUrl', label: 'Game image', required: true, note: 'An image file to upload: png, jpeg, webp or svg.' }
	],
	steps: [
		'Register at https://dle.games/register and apply to become an author (it asks for a short attestation, then an admin approves it).',
		'Once approved, add the game from the authors dashboard and submit it for review.'
	],
	check: (context) => lookOnPage(context, 'https://dle.games/sitemap.xml', 'dle.games\' sitemap'),
	verified: '2026-11-24'
};

export const alldleGames: Directory = {
	id: 'alldle-games',
	name: 'AllDle Games (alldle.games)',
	url: 'https://alldle.games',
	submitUrl: 'https://alldle.games/submit',
	method: 'form',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'Directory of daily games. A separate site from alldle.net.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'URL', required: true }
	],
	steps: ['Sign in with Google at https://alldle.games/submit, then fill in the form.'],
	tips: ['The form only shows after signing in, so its exact fields were not checked.'],
	check: (context) => lookOnPage(context, 'https://alldle.games/sitemap.xml', 'alldle.games\' sitemap'),
	verified: '2026-11-24'
};

export const dleHunt: Directory = {
	id: 'dlehunt',
	name: 'Dle Hunt',
	url: 'https://dlehunt.com',
	submitUrl: 'https://dlehunt.com/submit',
	method: 'form',
	account: true,
	cost: 'free_or_paid',
	captcha: false,
	about: 'Large directory with a page per game and a blog.',
	fields: [
		{ source: 'name', label: 'Name', required: true },
		{ source: 'url', label: 'URL', required: true },
		{ source: 'description', label: 'Description', required: false }
	],
	steps: ['Sign in at https://dlehunt.com/login (Google, Discord or email), then open https://dlehunt.com/submit.'],
	tips: [
		'Paid "Featured" and "Spotlight" placements skip the review wait; they are optional.',
		'Submit once: for a change, email contact@dlehunt.com instead of submitting again. A clone has to say it is unofficial.',
		'The form only shows after signing in, so its exact fields were not checked.'
	],
	check: (context) => lookOnPage(context, 'https://dlehunt.com/browse', 'Dle Hunt\'s browse page'),
	verified: '2026-11-24'
};

export const wordlesOfTheWorld: Directory = {
	id: 'wordles-of-the-world',
	name: 'Wordles of the World',
	url: 'https://rwmpelstilzchen.gitlab.io/wordles/',
	submitUrl: 'https://gitlab.com/rwmpelstilzchen/wordles/-/merge_requests',
	method: 'gitlab_issue',
	account: true,
	cost: 'free',
	captcha: false,
	about: 'Catalogue of Wordle-like games in every language, kept as YAML on GitLab.',
	scope: 'Wordle-like games, any language',
	fields: [
		{ source: 'name', label: 'name', required: true },
		{ source: 'languages', label: 'lang', required: true, note: 'ISO 639-3 codes: eng, fra, spa...' },
		{ source: 'url', label: 'url', required: true },
		{ source: 'creatorName', label: 'developer', required: false }
	],
	gitlab: { project: 'rwmpelstilzchen/wordles', title: (profile) => `Add ${profile.name}` },
	steps: [
		'Preferred: a merge request adding the entry below to the right file in database/ (one entry per merge request, tick "allow commits from members").',
		'Or open the prefilled GitLab issue.'
	],
	tips: ['Merge requests can take a while to be reviewed.'],
	entry: (profile) =>
		[
			`- name: ${profile.name}`,
			`  lang: ${profile.languages?.[0] ?? 'eng'}`,
			`  url: ${profile.url}`,
			...(profile.creatorName ? ['  developer:', `    - name: ${profile.creatorName}`] : [])
		].join('\n'),
	verified: '2026-11-24'
};

export const wordleverse: Directory = {
	id: 'wordleverse',
	name: 'Wordleverse',
	url: 'https://wordleverse.net',
	submitUrl: 'https://wordleverse.net/submit',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Very large index of daily puzzles and their language editions, with a public API.',
	fields: [
		{ source: 'name', label: 'Title', required: true },
		{ source: 'url', label: 'URL', required: true },
		{ source: 'description', label: 'Description', required: false },
		{ source: 'cadence', label: 'Daily / unlimited', required: false },
		{ source: 'languages', label: 'Language', required: false },
		{ source: 'tags', label: 'Suggested tags', required: false },
		{ source: 'creatorName', label: 'Your name', required: false },
		{ source: 'contactEmail', label: 'Your email', required: false }
	],
	steps: ['Open https://wordleverse.net/submit and fill in the form; no account needed (it offers to create one, which is optional).'],
	tips: ['Submissions are moderated before they are published.'],
	check: (context) => lookOnPage(context, `https://wordleverse.net/api/v1/games?q=${encodeURIComponent(context.profile.url)}`, 'Wordleverse\'s API'),
	verified: '2026-11-24'
};

export const dleList: Directory = {
	id: 'dlelist',
	name: 'DleList',
	url: 'https://dlelist.com',
	submitUrl: 'https://dlelist.com/submit',
	method: 'form',
	account: false,
	cost: 'free_or_paid',
	captcha: false,
	about: 'Fast, searchable list with a page per game.',
	fields: [
		{ source: 'name', label: 'Name', required: true, maxLength: 100 },
		{ source: 'url', label: 'URL', required: true },
		{ source: 'description', label: 'Description', required: true, maxLength: 1000 },
		{
			source: 'category',
			label: 'Category',
			required: false,
			note: 'Words, Geography, History, Music, Movies/TV, Math, Logic, Trivia, Sports, Science/Nature, Video Games, Food, Colors, Estimation, Shapes/Patterns, Vehicles, Card/Board Games, Novelty, Miscellaneous.'
		},
		{ source: 'contactEmail', label: 'Email', required: false }
	],
	steps: ['Open https://dlelist.com/submit, keep the free "standard" option, and fill in the form.'],
	tips: [
		'Free submissions have no set review date. A paid priority review and a sponsorship exist; neither is needed to be listed.'
	],
	check: (context) => lookOnPage(context, 'https://dlelist.com/sitemap.xml', 'DleList\'s sitemap'),
	verified: '2026-11-24'
};

export const goldles: Directory = {
	id: 'goldles',
	name: 'Goldles',
	url: 'https://www.goldles.com',
	submitUrl: 'https://www.goldles.com/suggest',
	method: 'form',
	account: false,
	cost: 'free_or_paid',
	captcha: true,
	about: 'Curated list of the best daily game per site, with weekly picks.',
	scope: 'one game per site: for a portal, its best game',
	fields: [
		{ source: 'url', label: 'Game URL', required: true },
		{ source: 'description', label: 'Description', required: true },
		{ source: 'tagline', label: 'Comments', required: false }
	],
	steps: ['Open https://www.goldles.com/suggest, fill in the form and answer its question.'],
	tips: ['Free review takes 2 to 4 weeks. A paid priority review (about 2 business days) is optional.'],
	verified: '2026-11-24'
};

export const sportsdle: Directory = {
	id: 'sportsdle',
	name: 'Sportsdle\'s dle list',
	url: 'https://www.sportsdle.com/dle-games',
	submitUrl: 'https://www.sportsdle.com/dle-games/submit',
	method: 'form',
	account: false,
	cost: 'paid',
	captcha: false,
	about: 'Hand-picked list of sports daily games.',
	scope: 'sports games only',
	fields: [
		{ source: 'name', label: 'Game name', required: true },
		{ source: 'url', label: 'URL', required: true }
	],
	steps: ['Paid only: open https://www.sportsdle.com/dle-games/submit and decide whether it is worth it. Record "skipped" if not.'],
	tips: [
		'No free submissions: a one-time fee, refunded if the game is not accepted.',
		'Their rules: one puzzle a day for everyone, limited guesses, feedback after each guess, a shareable result, works on a phone.'
	],
	verified: '2026-11-24'
};

export const theWordFinder: Directory = {
	id: 'the-word-finder',
	name: 'The Word Finder daily games',
	url: 'https://www.thewordfinder.com/daily-games/',
	submitUrl: 'https://www.thewordfinder.com/daily-games/',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Daily games library inside a large word-tools site, with a "My Games" dashboard.',
	fields: [
		{ source: 'name', label: 'Game name', required: true },
		{ source: 'description', label: 'Game description', required: true },
		{
			source: 'category',
			label: 'Category',
			required: false,
			note: 'Words, Video Games, Logic, Movies & TV, Geography, Sports, Trivia, Music, Miscellaneous, Numbers, Patterns & Shapes, Estimation, Science, Chess, History, Colors, Vehicles, Food.'
		},
		{ source: 'url', label: 'Game URL', required: true },
		{ source: 'contactEmail', label: 'Email', required: false }
	],
	steps: ['Open https://www.thewordfinder.com/daily-games/, click "+ Suggest Game" and fill in the form.'],
	check: (context) => lookOnPage(context, 'https://api.thewordfinder.com/daily-games/games', 'The Word Finder\'s library'),
	verified: '2026-11-24'
};

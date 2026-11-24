import { sameGame } from '../games.ts';
import { describeError, request } from '../http.ts';
import type { CheckOutcome, Directory, SubmitContext } from './types.ts';

const DATA = 'https://raw.githubusercontent.com/aukspot/dles/main/src/lib/data';

/** The list lives in its repository: listed, archived (still shown) and removed games. */
const FILES = [
	{ file: 'dles.json', found: 'yes' as const, wording: 'is listed on The Dles' },
	{ file: 'archived_dles.json', found: 'yes' as const, wording: 'is in The Dles\' archive' },
	{ file: 'removed_dles.json', found: 'no' as const, wording: 'was removed from The Dles earlier; ask the maintainer before submitting again' }
];

async function check({ profile, fetcher }: SubmitContext): Promise<CheckOutcome> {
	let readAny = false;
	for (const { file, found, wording } of FILES) {
		try {
			const response = await request(`${DATA}/${file}`, { headers: { accept: 'application/json' } }, { fetcher });
			if (!response.ok) continue;
			const games = JSON.parse(response.text) as Array<{ name?: string; url?: string }>;
			readAny = true;
			const match = games.find((game) => Boolean(game.url) && sameGame(profile.url, game.url as string));
			if (match) return { found, detail: `"${match.name ?? profile.name}" ${wording}.`, reference: 'https://dles.aukspot.com' };
		} catch (error) {
			if (file === 'dles.json') return { found: 'unknown', detail: `Could not read The Dles' list: ${describeError(error)}.` };
		}
	}
	return readAny ? { found: 'no', detail: 'Not on The Dles.' } : { found: 'unknown', detail: 'Could not read The Dles\' list.' };
}

export const theDles: Directory = {
	id: 'the-dles',
	name: 'The Dles',
	url: 'https://dles.aukspot.com',
	submitUrl: 'https://dles.aukspot.com/suggest',
	method: 'form',
	account: false,
	cost: 'free',
	captcha: false,
	about: 'Open-source list of daily games, filterable by category and theme.',
	fields: [
		{ source: 'url', label: 'What is the game\'s URL?', required: true },
		{ source: 'description', label: 'Describe the game', required: true },
		{ source: 'contactEmail', label: '(Optional) Contact information', required: false }
	],
	steps: [
		'Open https://dles.aukspot.com/suggest (a Tally form) and fill it with the values above.',
		'The form also asks whether the game includes content made with generative AI: answer it yourself.',
		'The maintainer prefers the form, but a GitHub issue works too (link above).'
	],
	tips: ['New games are added in batches with the site\'s updates, so it can take a while.'],
	github: { repo: 'aukspot/dles', labels: ['dles suggestion'], title: (profile) => `Suggest a dle: ${profile.name}` },
	check,
	verified: '2026-11-24'
};

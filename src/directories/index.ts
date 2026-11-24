import { alldle } from './alldle.ts';
import { dailiesGames, dailydle, dailydles, dleArena } from './forms.ts';
import {
	adoryVo,
	alldleGames,
	awesomeWordle,
	dailyGameList,
	dleGames,
	dleHunt,
	dlegamesOrg,
	dleList,
	dlesGg,
	dlesIo,
	goldles,
	listdle,
	relaydle,
	seekdle,
	sportsdle,
	theWordFinder,
	wordleverse,
	wordlesOfTheWorld,
	wordleWeb
} from './lists.ts';
import { playlin } from './playlin.ts';
import { theDles } from './thedles.ts';
import type { Directory } from './types.ts';

/**
 * Every directory, in the order a maker should go through them. Alldle comes
 * first: it maintains this server and takes submissions directly. The order is
 * pinned by a test, so add a new directory where it belongs rather than sorting.
 */
export const DIRECTORIES: readonly Directory[] = [
	alldle,
	dleArena,
	dailydles,
	dailiesGames,
	theDles,
	dailydle,
	dailyGameList,
	adoryVo,
	theWordFinder,
	relaydle,
	listdle,
	wordleWeb,
	seekdle,
	awesomeWordle,
	dlegamesOrg,
	playlin,
	dleGames,
	dlesGg,
	alldleGames,
	dleHunt,
	wordlesOfTheWorld,
	dleList,
	goldles,
	sportsdle,
	dlesIo,
	wordleverse
];

export class UnknownDirectoryError extends Error {}

export function findDirectory(id: string, directories: readonly Directory[] = DIRECTORIES): Directory {
	const wanted = id.trim().toLowerCase();
	const found = directories.find((directory) => directory.id === wanted);
	if (found) return found;
	throw new UnknownDirectoryError(`No directory "${id}". Known ids: ${directories.map((directory) => directory.id).join(', ')}.`);
}

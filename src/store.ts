import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { normalizeUrl, type GameProfile } from './games.ts';

/**
 * Where a game stands on one directory.
 *
 * - prepared: the submission was laid out, nobody confirmed it was sent.
 * - submitted: it was sent, by this server or by the maker, and is waiting for review.
 * - listed: the game is on the directory.
 * - rejected: the directory said no.
 * - skipped: the maker chose not to submit there.
 */
export const SUBMISSION_STATUSES = ['prepared', 'submitted', 'listed', 'rejected', 'skipped'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses after which a directory no longer needs anything from the maker. */
export const SETTLED_STATUSES: ReadonlySet<SubmissionStatus> = new Set(['submitted', 'listed', 'rejected', 'skipped']);

export interface HistoryEntry {
	at: string;
	status: SubmissionStatus;
	note?: string;
}

export interface Attempt {
	at: string;
	ok: boolean;
	detail: string;
}

export interface SubmissionRecord {
	status: SubmissionStatus;
	updatedAt: string;
	/** A link that proves it: the listing, the issue, a confirmation page. */
	reference?: string;
	note?: string;
	/** The last automatic submission this server tried, whether it worked or not. */
	lastAttempt?: Attempt;
	history: HistoryEntry[];
}

export interface GameRecord {
	profile: GameProfile;
	createdAt: string;
	updatedAt: string;
	submissions: Record<string, SubmissionRecord>;
}

export interface State {
	version: 1;
	/** Keyed by the game's normalized link. */
	games: Record<string, GameRecord>;
}

const HISTORY_LIMIT = 20;

export function defaultStatePath(): string {
	const fromEnv = process.env.DLE_SUBMIT_STATE?.trim();
	if (fromEnv) return fromEnv;
	return join(homedir(), '.dle-submit', 'state.json');
}

function emptyState(): State {
	return { version: 1, games: {} };
}

function isState(value: unknown): value is State {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as { version?: unknown; games?: unknown };
	return candidate.version === 1 && typeof candidate.games === 'object' && candidate.games !== null;
}

export class StateFileError extends Error {}

/**
 * The server's memory: one JSON file on the maker's machine. Each change reads the
 * file again before writing it, so two assistants open at once do not undo each
 * other's records, and writes go through a temporary file so a crash never leaves
 * half a file behind.
 */
export class Store {
	readonly path: string;

	constructor(path: string = defaultStatePath()) {
		this.path = path;
	}

	read(): State {
		let raw: string;
		try {
			raw = readFileSync(this.path, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
			throw error;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new StateFileError(`${this.path} is not valid JSON. Fix or move it; nothing was overwritten.`);
		}
		if (!isState(parsed)) {
			throw new StateFileError(`${this.path} is not a dle-submit memory file. Fix or move it; nothing was overwritten.`);
		}
		return parsed;
	}

	update<T>(change: (state: State) => T): T {
		const state = this.read();
		const result = change(state);
		this.write(state);
		return result;
	}

	private write(state: State): void {
		mkdirSync(dirname(this.path), { recursive: true });
		const temporary = `${this.path}.${process.pid}.tmp`;
		writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
		renameSync(temporary, this.path);
	}
}

export class UnknownGameError extends Error {}

/**
 * A game from what an assistant passes: its link (any spelling) or its name.
 * Throws with the saved games listed, so the assistant can correct itself.
 */
export function findGame(state: State, ref: string): { key: string; record: GameRecord } {
	const trimmed = ref.trim();
	let key: string | undefined;
	try {
		key = normalizeUrl(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
	} catch {
		key = undefined;
	}
	const direct = key ? state.games[key] : undefined;
	if (key && direct) return { key, record: direct };

	const byName = Object.entries(state.games).filter(
		([, record]) => record.profile.name.trim().toLowerCase() === trimmed.toLowerCase()
	);
	if (byName.length === 1) {
		const [found] = byName;
		if (found) return { key: found[0], record: found[1] };
	}
	const saved = Object.values(state.games).map((record) => `${record.profile.name} (${record.profile.url})`);
	if (byName.length > 1) {
		throw new UnknownGameError(`Several saved games are called "${trimmed}". Pass the game's link instead: ${saved.join(', ')}.`);
	}
	throw new UnknownGameError(
		saved.length > 0
			? `No saved game matches "${trimmed}". Saved games: ${saved.join(', ')}. Use save_game for a new one.`
			: `No game is saved yet. Call save_game with the game's name and link first.`
	);
}

/** Records a status change, keeping a short history of earlier ones. */
export function setStatus(
	record: GameRecord,
	directoryId: string,
	status: SubmissionStatus,
	details: { note?: string; reference?: string } = {},
	now: string = new Date().toISOString()
): SubmissionRecord {
	const previous = record.submissions[directoryId];
	const entry: HistoryEntry = details.note ? { at: now, status, note: details.note } : { at: now, status };
	const next: SubmissionRecord = {
		status,
		updatedAt: now,
		history: [...(previous?.history ?? []), entry].slice(-HISTORY_LIMIT)
	};
	const reference = details.reference ?? previous?.reference;
	if (reference) next.reference = reference;
	const note = details.note ?? previous?.note;
	if (note) next.note = note;
	if (previous?.lastAttempt) next.lastAttempt = previous.lastAttempt;
	record.submissions[directoryId] = next;
	record.updatedAt = now;
	return next;
}

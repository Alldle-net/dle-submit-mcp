import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { DIRECTORIES, findDirectory, UnknownDirectoryError } from './directories/index.ts';
import type { CheckOutcome, Directory, SubmitOutcome } from './directories/types.ts';
import { gameProfileSchema, missingRecommended, normalizeUrl, type GameProfile } from './games.ts';
import { VERSION, describeError, type Fetcher } from './http.ts';
import { prepareSubmission } from './prepare.ts';
import {
	findGame,
	setStatus,
	StateFileError,
	SUBMISSION_STATUSES,
	UnknownGameError,
	type GameRecord,
	type Store,
	type SubmissionRecord
} from './store.ts';

const INSTRUCTIONS = `dle-submit gets a daily ".dle" game listed on the directories that list such games, and remembers, per game, where it was already sent.

Workflow: save_game once (name and link at least; tagline, description, category, languages and a contact email fill most forms). Then go through list_directories in the order given. For a directory that sends automatically, call submit. For the others, call prepare_submission, help the maker send it (open the prefilled link, or fill the form with the values given), then record_submission with what happened. get_progress says what is left. check_listings looks for the game on directories that expose their list, and records the ones where it is found.

Never record "submitted" for a directory unless the submission was actually sent. Nothing here creates accounts, solves captchas or pays for anything: those steps are the maker's.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const LOCAL_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const REMOTE_READ = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const REMOTE_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;

const CHECK_CONCURRENCY = 4;

const gameField = z.string().trim().min(1).describe('The game\'s link or its saved name.');
const directoryField = z.string().trim().min(1).describe('A directory id from list_directories.');

export interface ServerDependencies {
	store: Store;
	fetcher?: Fetcher;
	directories?: readonly Directory[];
	now?: () => Date;
}

function json(data: unknown): CallToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function failure(message: string): CallToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] };
}

async function run(work: () => Promise<CallToolResult> | CallToolResult): Promise<CallToolResult> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof UnknownGameError || error instanceof UnknownDirectoryError || error instanceof StateFileError) {
			return failure(error.message);
		}
		console.error('dle-submit tool failed', error);
		return failure(`Something went wrong: ${describeError(error)}`);
	}
}

async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array<R>(items.length);
	let next = 0;
	async function worker(): Promise<void> {
		while (next < items.length) {
			const index = next++;
			results[index] = await work(items[index] as T);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

function statusOf(record: GameRecord, directoryId: string): SubmissionRecord | undefined {
	return record.submissions[directoryId];
}

function brief(directory: Directory, submission: SubmissionRecord | undefined): Record<string, unknown> {
	const row: Record<string, unknown> = {
		id: directory.id,
		name: directory.name,
		url: directory.url,
		method: directory.method,
		sendsAutomatically: Boolean(directory.autoSubmit),
		account: directory.account,
		cost: directory.cost,
		captcha: directory.captcha
	};
	if (directory.scope) row.scope = directory.scope;
	if (submission) {
		row.status = submission.status;
		row.updatedAt = submission.updatedAt;
		if (submission.reference) row.reference = submission.reference;
	} else {
		row.status = 'not started';
	}
	return row;
}

function progress(record: GameRecord, directories: readonly Directory[]): Record<string, unknown> {
	const counts: Record<string, number> = { 'not started': 0 };
	for (const status of SUBMISSION_STATUSES) counts[status] = 0;
	const todo: Directory[] = [];
	const waiting: Directory[] = [];
	for (const directory of directories) {
		const submission = statusOf(record, directory.id);
		const status = submission?.status ?? 'not started';
		counts[status] = (counts[status] ?? 0) + 1;
		if (!submission) todo.push(directory);
		else if (submission.status === 'prepared') waiting.push(directory);
	}
	const settled = directories.length - todo.length - waiting.length;
	const next = waiting[0] ?? todo[0];
	return {
		game: { name: record.profile.name, url: record.profile.url },
		directories: directories.length,
		settled,
		counts,
		preparedButNotConfirmed: waiting.map((directory) => ({ id: directory.id, name: directory.name })),
		notStarted: todo.map((directory) => ({ id: directory.id, name: directory.name, sendsAutomatically: Boolean(directory.autoSubmit) })),
		next: next
			? {
					id: next.id,
					name: next.name,
					how: next.autoSubmit ? 'Call submit: it is sent from here.' : 'Call prepare_submission, send it, then record_submission.'
				}
			: null
	};
}

export function buildServer(dependencies: ServerDependencies): McpServer {
	const { store } = dependencies;
	const fetcher = dependencies.fetcher ?? fetch;
	const directories = dependencies.directories ?? DIRECTORIES;
	const now = (): string => (dependencies.now?.() ?? new Date()).toISOString();
	const directoryById = (id: string): Directory => findDirectory(id, directories);

	const server = new McpServer(
		{ name: 'dle-submit', title: 'Submit your dle', version: VERSION, websiteUrl: 'https://github.com/Alldle-net/dle-submit-mcp' },
		{ instructions: INSTRUCTIONS }
	);

	server.registerTool(
		'save_game',
		{
			title: 'Save a game',
			description:
				'Saves a game\'s details, used to fill every directory\'s form. Saving again with the same link updates it; fields left out keep their saved value.',
			inputSchema: gameProfileSchema.extend({
				replaces: z.string().trim().optional().describe('The game\'s previous link, when the game moved to a new one. Its history moves with it.')
			}),
			annotations: LOCAL_WRITE
		},
		(input) =>
			run(() => {
				const { replaces, ...fields } = input;
				const key = normalizeUrl(fields.url);
				const saved = store.update((state) => {
					let existing = state.games[key];
					if (replaces) {
						const previous = findGame(state, replaces);
						if (previous.key !== key) {
							existing = previous.record;
							delete state.games[previous.key];
						}
					}
					const stamp = now();
					const profile: GameProfile = { ...(existing?.profile ?? {}), ...stripUndefined(fields) } as GameProfile;
					state.games[key] = {
						profile,
						createdAt: existing?.createdAt ?? stamp,
						updatedAt: stamp,
						submissions: existing?.submissions ?? {}
					};
					return state.games[key];
				});
				const missing = missingRecommended(saved.profile);
				return json({
					saved: saved.profile,
					memoryFile: store.path,
					directoriesAlreadyTracked: Object.keys(saved.submissions).length,
					worthAdding: missing.map(({ field, why }) => `${field}: ${why}`),
					next: 'Call list_directories with this game to see where it stands, then go through them in order.'
				});
			})
	);

	server.registerTool(
		'list_games',
		{
			title: 'List saved games',
			description: 'The games saved in memory, with how far each one has got.',
			annotations: READ_ONLY
		},
		() =>
			run(() => {
				const state = store.read();
				return json({
					memoryFile: store.path,
					games: Object.values(state.games).map((record) => {
						const summary = progress(record, directories);
						return { name: record.profile.name, url: record.profile.url, settled: summary.settled, directories: summary.directories, next: summary.next };
					})
				});
			})
	);

	server.registerTool(
		'list_directories',
		{
			title: 'List directories',
			description:
				'Every directory that lists daily games, in the order to go through them, with how each takes submissions. With a game, adds where that game stands on each.',
			inputSchema: z.object({ game: gameField.optional() }),
			annotations: READ_ONLY
		},
		({ game }) =>
			run(() => {
				const record = game ? findGame(store.read(), game).record : undefined;
				return json({
					...(record ? { game: { name: record.profile.name, url: record.profile.url } } : {}),
					directories: directories.map((directory) => brief(directory, record ? statusOf(record, directory.id) : undefined))
				});
			})
	);

	server.registerTool(
		'prepare_submission',
		{
			title: 'Prepare a submission',
			description:
				'Everything needed to submit a game to one directory: the page, each field\'s value from the saved game, prefilled issue or email links, and the steps. Marks it "prepared" if nothing was recorded yet; it does not send anything.',
			inputSchema: z.object({ game: gameField, directory: directoryField }),
			annotations: LOCAL_WRITE
		},
		({ game, directory: directoryId }) =>
			run(() => {
				const directory = directoryById(directoryId);
				const { record, submission } = store.update((state) => {
					const found = findGame(state, game).record;
					const current = statusOf(found, directory.id) ?? setStatus(found, directory.id, 'prepared', {}, now());
					return { record: found, submission: current };
				});
				return json({
					...prepareSubmission(directory, record.profile),
					currentStatus: submission.status,
					...(submission.status !== 'prepared'
						? { alreadyDone: `Recorded as ${submission.status} on ${submission.updatedAt.slice(0, 10)}.` }
						: {}),
					afterSending: directory.autoSubmit
						? 'This directory can be sent from here: call submit instead.'
						: 'Once it is sent, call record_submission with status "submitted" (and the issue or confirmation link, if any).'
				});
			})
	);

	server.registerTool(
		'submit',
		{
			title: 'Submit automatically',
			description:
				'Sends the game to a directory that accepts submissions without an account or captcha, and records the outcome. Pass "all" to send it to every such directory it has not been sent to yet. Directories already marked submitted or listed are skipped unless resubmit is true.',
			inputSchema: z.object({
				game: gameField,
				directory: z.string().trim().min(1).describe('A directory id from list_directories, or "all".'),
				resubmit: z.boolean().optional().describe('Send again even if memory says it was already sent.'),
				category: z
					.string()
					.trim()
					.max(60)
					.optional()
					.describe('The directory\'s own category for this game, when submit asked for one. Only for a single directory.')
			}),
			annotations: REMOTE_WRITE
		},
		({ game, directory: directoryId, resubmit, category }) =>
			run(async () => {
				const all = directoryId.toLowerCase() === 'all';
				const targets = all ? directories.filter((directory) => directory.autoSubmit) : [directoryById(directoryId)];
				const target = targets[0];
				if (!all && target && !target.autoSubmit) {
					return failure(
						`${target.name} cannot be sent from here (${target.method}${target.captcha ? ', captcha' : ''}${target.account ? ', account needed' : ''}). Call prepare_submission for its prefilled fields, send it, then record_submission.`
					);
				}
				const { record } = findGame(store.read(), game);
				const results: Array<Record<string, unknown>> = [];
				for (const directory of targets) {
					const existing = statusOf(record, directory.id);
					if (existing && (existing.status === 'submitted' || existing.status === 'listed') && !resubmit) {
						results.push({
							directory: directory.id,
							outcome: 'skipped',
							detail: `Already ${existing.status} on ${existing.updatedAt.slice(0, 10)}. Pass resubmit: true to send again.`
						});
						continue;
					}
					if ((existing?.status === 'skipped' || existing?.status === 'rejected') && all) {
						results.push({ directory: directory.id, outcome: 'skipped', detail: `Recorded as ${existing.status}.` });
						continue;
					}
					const sent: SubmitOutcome = await directory.autoSubmit!({ profile: record.profile, fetcher, ...(category && !all ? { category } : {}) }).catch((error: unknown) => ({
						outcome: 'failed' as const,
						detail: describeError(error)
					}));
					store.update((state) => {
						const current = findGame(state, game).record;
						const stamp = now();
						if (sent.outcome === 'failed') {
							const submission = statusOf(current, directory.id) ?? setStatus(current, directory.id, 'prepared', {}, stamp);
							submission.lastAttempt = { at: stamp, ok: false, detail: sent.detail };
						} else {
							const details: { note: string; reference?: string } = { note: sent.detail };
							if (sent.reference) details.reference = sent.reference;
							const submission = setStatus(current, directory.id, sent.outcome, details, stamp);
							submission.lastAttempt = { at: stamp, ok: true, detail: sent.detail };
						}
					});
					const row: Record<string, unknown> = { directory: directory.id, name: directory.name, ...sent };
					if (sent.outcome !== 'failed' && directory.afterListing) row.afterwards = directory.afterListing;
					if (sent.outcome === 'failed') row.fallback = 'Call prepare_submission to send it by hand.';
					results.push(row);
				}
				return json({ results });
			})
	);

	server.registerTool(
		'record_submission',
		{
			title: 'Record a submission',
			description:
				'Remembers what happened on a directory: submitted (sent and waiting), listed (live), rejected, skipped (chose not to), or prepared (laid out, not sent). Only record "submitted" once it was actually sent.',
			inputSchema: z.object({
				game: gameField,
				directory: directoryField,
				status: z.enum(SUBMISSION_STATUSES),
				note: z.string().trim().max(500).optional().describe('Anything worth remembering: what they said, why it was skipped.'),
				reference: z.string().trim().url().regex(/^https?:\/\//i).optional().describe('A link that proves it: the listing, the issue, the email thread.')
			}),
			annotations: LOCAL_WRITE
		},
		({ game, directory: directoryId, status, note, reference }) =>
			run(() => {
				const directory = directoryById(directoryId);
				const { record, submission } = store.update((state) => {
					const found = findGame(state, game).record;
					const details: { note?: string; reference?: string } = {};
					if (note) details.note = note;
					if (reference) details.reference = reference;
					return { record: found, submission: setStatus(found, directory.id, status, details, now()) };
				});
				const summary = progress(record, directories);
				return json({
					recorded: { directory: directory.id, ...submission, history: undefined },
					...(status === 'listed' && directory.afterListing ? { afterwards: directory.afterListing } : {}),
					settled: summary.settled,
					of: summary.directories,
					next: summary.next
				});
			})
	);

	server.registerTool(
		'check_listings',
		{
			title: 'Check where it is listed',
			description:
				'Looks for the game on directories that expose their list publicly, and records "listed" where its link is found. A page named after the game is reported as a maybe and not recorded. Directories with no public list are left out.',
			inputSchema: z.object({
				game: gameField,
				directories: z.array(z.string().trim().min(1)).optional().describe('Directory ids to check. All checkable ones by default.')
			}),
			annotations: REMOTE_READ
		},
		({ game, directories: wanted }) =>
			run(async () => {
				const { record } = findGame(store.read(), game);
				const targets = (wanted?.length ? wanted.map(directoryById) : directories).filter((directory) => directory.check);
				const outcomes = await mapLimit(targets, CHECK_CONCURRENCY, async (directory) => {
					const outcome: CheckOutcome = await directory.check!({ profile: record.profile, fetcher }).catch((error: unknown) => ({
						found: 'unknown' as const,
						detail: describeError(error)
					}));
					return { directory, outcome };
				});
				const newlyListed: string[] = [];
				store.update((state) => {
					const current = findGame(state, game).record;
					for (const { directory, outcome } of outcomes) {
						if (outcome.found !== 'yes' || statusOf(current, directory.id)?.status === 'listed') continue;
						const details: { note: string; reference?: string } = { note: `Found by check_listings: ${outcome.detail}` };
						if (outcome.reference) details.reference = outcome.reference;
						setStatus(current, directory.id, 'listed', details, now());
						newlyListed.push(directory.id);
					}
				});
				return json({
					checked: outcomes.map(({ directory, outcome }) => ({ directory: directory.id, name: directory.name, ...outcome })),
					newlyRecordedAsListed: newlyListed,
					notCheckable: directories.filter((directory) => !directory.check).map((directory) => directory.id)
				});
			})
	);

	server.registerTool(
		'get_progress',
		{
			title: 'Get progress',
			description: 'Where a game stands across all directories: what is settled, what was prepared but not confirmed, what is not started, and what to do next.',
			inputSchema: z.object({ game: gameField }),
			annotations: READ_ONLY
		},
		({ game }) => run(() => json(progress(findGame(store.read(), game).record, directories)))
	);

	server.registerPrompt(
		'submit_everywhere',
		{
			title: 'Submit my game everywhere',
			description: 'Walks through every directory for one game, sending what can be sent and preparing the rest.',
			argsSchema: z.object({ game: z.string().describe('The game\'s link, or its name if it is already saved.') })
		},
		({ game }) => ({
			messages: [
				{
					role: 'user' as const,
					content: {
						type: 'text' as const,
						text: `Get my daily game listed on every directory, using the dle-submit tools. The game: ${game}

1. If it is not saved yet (list_games), ask me for what save_game needs: name, link, a one-line tagline, a short description, category, languages, my name and a contact email. Save it.
2. Run check_listings first, so directories that already list it are not submitted to again.
3. Tell me which directories submit can send to directly (list_directories, sendsAutomatically) and what goes with it: the game's details and my contact email. Once I agree, call submit with directory "all".
4. Then go through get_progress's "notStarted" list in order. For each: prepare_submission, open the prefilled link or fill the form with the values given (use a browser tool if you have one, otherwise give me the link and the values), and wait for me to confirm before calling record_submission with "submitted". If a directory needs an account, a payment or a captcha, tell me and let me decide; record "skipped" if I pass.
5. Finish with get_progress and a short summary of what is done and what is waiting on me.`
					}
				}
			]
		})
	);

	return server;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}


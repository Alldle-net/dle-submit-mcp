/**
 * Drives the built server with the official MCP client, the way an assistant
 * would: lists the tools, saves a game, goes through a directory, restarts the
 * server and checks the memory survived. Run `npm run build` first.
 *
 *   node scripts/smoke.ts            local tools only
 *   node scripts/smoke.ts --network  also check_listings, and submit to Alldle
 *                                    with a game it already lists (writes nothing)
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const network = process.argv.includes('--network');
const folder = mkdtempSync(join(tmpdir(), 'dle-submit-smoke-'));
const statePath = join(folder, 'state.json');

async function connect(): Promise<Client> {
	const client = new Client({ name: 'smoke', version: '1.0.0' });
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [join(import.meta.dirname, '..', 'dist', 'index.js')],
		env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', DLE_SUBMIT_STATE: statePath },
		stderr: 'inherit'
	});
	await client.connect(transport);
	return client;
}

function text(result: unknown): string {
	const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
	return content.map((block) => block.text ?? '').join('\n');
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
	const result = await client.callTool({ name, arguments: args });
	if ((result as { isError?: boolean }).isError) throw new Error(`${name} failed: ${text(result)}`);
	return JSON.parse(text(result)) as Record<string, unknown>;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const game = network
	? { name: 'Globle', url: 'https://globle-game.com/' }
	: { name: 'Smokedle', url: 'https://smokedle.example.com/' };

try {
	let client = await connect();
	const { tools } = await client.listTools();
	console.log('tools:', tools.map((tool) => tool.name).join(', '));
	assert(tools.length === 8, 'eight tools');
	const { prompts } = await client.listPrompts();
	assert(prompts.some((prompt) => prompt.name === 'submit_everywhere'), 'the prompt is listed');

	const saved = await call(client, 'save_game', { ...game, tagline: 'Guess the thing.', category: 'Geography', languages: ['en'] });
	assert(saved.memoryFile === statePath, 'memory goes where DLE_SUBMIT_STATE says');

	const listed = await call(client, 'list_directories', { game: game.url });
	const rows = listed.directories as Array<{ id: string; status: string }>;
	assert(rows[0]?.id === 'alldle', 'Alldle comes first');
	console.log('directories:', rows.length);

	const second = rows[1]?.id;
	if (second) {
		const prepared = await call(client, 'prepare_submission', { game: game.name, directory: second });
		assert(prepared.currentStatus === 'prepared', 'preparing marks it prepared');
		await call(client, 'record_submission', { game: game.name, directory: second, status: 'submitted', note: 'smoke test' });
	}

	if (network) {
		const checked = await call(client, 'check_listings', { game: game.url });
		console.log('check_listings:', JSON.stringify(checked.checked));
		const sent = await call(client, 'submit', { game: game.url, directory: 'alldle', resubmit: true });
		console.log('submit alldle:', JSON.stringify(sent.results));
	}
	await client.close();

	// A new process must remember everything.
	client = await connect();
	const progress = await call(client, 'get_progress', { game: game.url });
	console.log('after restart:', JSON.stringify(progress.counts));
	assert(!second || ((progress.counts as Record<string, number>).submitted ?? 0) >= 1, 'the submission survived a restart');
	const failed = await client.callTool({ name: 'get_progress', arguments: { game: 'nope' } });
	assert((failed as { isError?: boolean }).isError === true, 'an unknown game is an error the assistant can read');
	await client.close();
	console.log('smoke test passed');
} finally {
	rmSync(folder, { recursive: true, force: true });
}

import { readFileSync } from 'node:fs';

const REPO_URL = 'https://github.com/Alldle-net/dle-submit-mcp';

function packageVersion(): string {
	try {
		const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
		return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
	} catch {
		return '0.0.0';
	}
}

export const VERSION: string = packageVersion();

/** Says who is calling, so a directory's owner can tell where a request came from. */
export const USER_AGENT = `dle-submit-mcp/${VERSION} (+${REPO_URL})`;

const DEFAULT_TIMEOUT_MS = 15_000;
/** Sitemaps run to a few megabytes; anything bigger is not worth reading whole. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface HttpResult {
	ok: boolean;
	status: number;
	url: string;
	contentType: string;
	text: string;
}

export type Fetcher = typeof fetch;

async function readCapped(response: Response): Promise<string> {
	if (!response.body) return '';
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_BODY_BYTES) {
			await reader.cancel();
			break;
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString('utf8');
}

export async function request(
	url: string,
	init: RequestInit = {},
	options: { fetcher?: Fetcher; timeoutMs?: number } = {}
): Promise<HttpResult> {
	const fetcher = options.fetcher ?? fetch;
	const headers = new Headers(init.headers);
	if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT);
	const response = await fetcher(url, {
		redirect: 'follow',
		...init,
		headers,
		signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
	});
	return {
		ok: response.ok,
		status: response.status,
		url: response.url || url,
		contentType: response.headers.get('content-type') ?? '',
		text: await readCapped(response)
	};
}

export function describeError(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'the site did not answer in time';
		const cause = (error as { cause?: { code?: string } }).cause;
		if (cause?.code) return `${error.message} (${cause.code})`;
		return error.message;
	}
	return String(error);
}

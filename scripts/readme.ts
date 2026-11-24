/**
 * Writes the directory table into README.md, between its markers, from the same
 * list the server uses, so the two never disagree. `--check` fails instead of
 * writing when the README is out of date (the tests run it).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIRECTORIES } from '../src/directories/index.ts';
import type { Directory } from '../src/directories/types.ts';

const START = '<!-- directories:start -->';
const END = '<!-- directories:end -->';

const METHOD: Record<Directory['method'], string> = {
	api: 'Sent automatically',
	form: 'Web form',
	github_issue: 'GitHub issue',
	github_pr: 'GitHub pull request',
	gitlab_issue: 'GitLab issue',
	email: 'Email',
	contact: 'Contact form',
	discord: 'Discord'
};

const COST: Record<Directory['cost'], string> = { free: 'Free', free_or_paid: 'Free, paid options', paid: 'Paid' };

function cell(text: string): string {
	return text.replace(/\|/g, '\\|');
}

export function directoryTable(directories: readonly Directory[] = DIRECTORIES): string {
	const rows = directories.map((directory, index) => {
		const how = directory.autoSubmit && directory.method !== 'api' ? `${METHOD[directory.method]}, sent automatically` : METHOD[directory.method];
		const notes = [directory.account ? 'account' : '', directory.captcha ? 'captcha' : '', directory.scope ?? ''].filter(Boolean).join(', ');
		return `| ${index + 1} | [${cell(directory.name)}](${directory.url}) | ${how} | ${COST[directory.cost]} | ${cell(notes) || ' '} |`;
	});
	return ['| # | Directory | How it takes games | Cost | Needs / scope |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}

export function withTable(readme: string, table: string = directoryTable()): string {
	const start = readme.indexOf(START);
	const end = readme.indexOf(END);
	if (start === -1 || end === -1 || end < start) throw new Error(`README.md needs ${START} and ${END}.`);
	return `${readme.slice(0, start + START.length)}\n${table}\n${readme.slice(end)}`;
}

const isMain = process.argv[1] && import.meta.filename === process.argv[1];
if (isMain) {
	const path = join(import.meta.dirname, '..', 'README.md');
	const current = readFileSync(path, 'utf8');
	const next = withTable(current);
	if (process.argv.includes('--check')) {
		if (next !== current) {
			console.error('README.md is out of date: run npm run readme.');
			process.exit(1);
		}
	} else if (next !== current) {
		writeFileSync(path, next);
		console.log('README.md updated.');
	}
}

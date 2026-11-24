import type { Directory, DirectoryField, FieldSource } from './directories/types.ts';
import type { GameProfile } from './games.ts';

const CADENCE_WORDING: Record<NonNullable<GameProfile['cadence']>, string> = {
	daily: 'A new puzzle every day, the same for everyone.',
	unlimited: 'Unlimited play, no daily limit.',
	both: 'A daily puzzle, plus an unlimited mode.'
};

/** GitHub refuses new-issue links much past this length. */
const MAX_PREFILL_URL = 7500;

/** The submission as plain text: what goes into an issue, an email or a free-text box. */
export function buildPitch(profile: GameProfile): string {
	const lines: string[] = [`**${profile.name}**: ${profile.url}`];
	if (profile.tagline) lines.push('', profile.tagline);
	if (profile.description) lines.push('', profile.description);
	const facts: string[] = [];
	if (profile.category) facts.push(`- Category: ${profile.category}`);
	if (profile.cadence) facts.push(`- ${CADENCE_WORDING[profile.cadence]}`);
	if (profile.languages?.length) facts.push(`- Languages: ${profile.languages.join(', ')}`);
	if (profile.tags?.length) facts.push(`- Tags: ${profile.tags.join(', ')}`);
	if (profile.launchDate) facts.push(`- Launched: ${profile.launchDate}`);
	if (profile.creatorName) facts.push(`- Made by: ${profile.creatorName}`);
	if (profile.contactEmail) facts.push(`- Contact: ${profile.contactEmail}`);
	const socials = Object.entries(profile.socials ?? {}).filter(([, link]) => Boolean(link));
	if (socials.length) facts.push(`- Links: ${socials.map(([network, link]) => `${network} ${link}`).join(', ')}`);
	if (facts.length) lines.push('', ...facts);
	lines.push('', 'Free to play in the browser, no account needed.');
	return lines.join('\n');
}

export function fieldValue(profile: GameProfile, source: FieldSource): string | undefined {
	if (source === 'pitch') return buildPitch(profile);
	const value = profile[source];
	if (value === undefined) return undefined;
	if (Array.isArray(value)) return value.length ? value.join(', ') : undefined;
	if (typeof value === 'object') {
		const links = Object.entries(value).filter(([, link]) => Boolean(link));
		return links.length ? links.map(([network, link]) => `${network}: ${link}`).join('\n') : undefined;
	}
	if (source === 'cadence') return CADENCE_WORDING[value as NonNullable<GameProfile['cadence']>];
	return String(value);
}

export interface PreparedField {
	label: string;
	value: string | null;
	required: boolean;
	note?: string;
	/** Set when the value is longer than the directory accepts. */
	tooLong?: { maxLength: number; length: number };
}

export interface PreparedSubmission {
	directory: {
		id: string;
		name: string;
		submitUrl: string;
		method: Directory['method'];
		account: boolean;
		cost: Directory['cost'];
		captcha: boolean;
		scope?: string;
	};
	sendsAutomatically: boolean;
	fields: PreparedField[];
	/** Required values the saved profile does not have yet. */
	missing: string[];
	/** Links that open the submission already filled in. */
	links: { label: string; url: string }[];
	/** For an issue or an email: the text to paste. */
	text?: { title?: string; body: string };
	/** For a list kept in a file: the exact entry to add. */
	entry?: string;
	steps: string[];
	tips: string[];
}

function prepareField(profile: GameProfile, field: DirectoryField): PreparedField {
	const value = fieldValue(profile, field.source) ?? null;
	const prepared: PreparedField = { label: field.label, value, required: field.required };
	if (field.note) prepared.note = field.note;
	if (value !== null && field.maxLength && value.length > field.maxLength) {
		prepared.tooLong = { maxLength: field.maxLength, length: value.length };
	}
	return prepared;
}

function defaultTitle(profile: GameProfile): string {
	return `Add ${profile.name}`;
}

function githubIssueLink(directory: Directory, profile: GameProfile, body: string): string | undefined {
	const github = directory.github;
	if (!github) return undefined;
	const params = new URLSearchParams();
	if (github.template) params.set('template', github.template);
	params.set('title', (github.title ?? defaultTitle)(profile));
	if (github.labels?.length) params.set('labels', github.labels.join(','));
	if (github.fieldIds) {
		for (const [source, id] of Object.entries(github.fieldIds) as Array<[FieldSource, string]>) {
			const value = fieldValue(profile, source);
			if (value) params.set(id, value);
		}
	} else {
		params.set('body', body);
	}
	const link = `https://github.com/${github.repo}/issues/new?${params.toString()}`;
	return link.length <= MAX_PREFILL_URL ? link : undefined;
}

function gitlabIssueLink(directory: Directory, profile: GameProfile, body: string): string | undefined {
	const gitlab = directory.gitlab;
	if (!gitlab) return undefined;
	const params = new URLSearchParams();
	params.set('issue[title]', (gitlab.title ?? defaultTitle)(profile));
	params.set('issue[description]', body);
	const link = `https://gitlab.com/${gitlab.project}/-/issues/new?${params.toString()}`;
	return link.length <= MAX_PREFILL_URL ? link : undefined;
}

function mailtoLink(address: string, subject: string, body: string): string {
	// URLSearchParams writes spaces as "+", which mail clients show literally.
	return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function prepareSubmission(directory: Directory, profile: GameProfile): PreparedSubmission {
	const fields = directory.fields.map((field) => prepareField(profile, field));
	const missing = fields.filter((field) => field.required && field.value === null).map((field) => field.label);
	const links: { label: string; url: string }[] = [];
	let text: PreparedSubmission['text'];

	const body = buildPitch(profile);
	if (directory.method === 'github_issue' || directory.method === 'github_pr') {
		const title = (directory.github?.title ?? defaultTitle)(profile);
		text = { title, body };
		const link = directory.method === 'github_issue' ? githubIssueLink(directory, profile, body) : undefined;
		if (link) links.push({ label: 'Open the issue, already filled in', url: link });
	} else if (directory.method === 'gitlab_issue') {
		const title = (directory.gitlab?.title ?? defaultTitle)(profile);
		text = { title, body };
		const link = gitlabIssueLink(directory, profile, body);
		if (link) links.push({ label: 'Open the issue, already filled in', url: link });
	} else if ((directory.method === 'email' || directory.method === 'contact') && directory.email) {
		const subject = `Game suggestion: ${profile.name}`;
		text = { title: subject, body };
		links.push({ label: 'Open the email, already written', url: mailtoLink(directory.email, subject, body) });
	} else if (directory.method === 'contact' || directory.method === 'discord') {
		text = { body };
	}
	links.push({ label: 'Submission page', url: directory.submitUrl });
	if (directory.github && directory.method !== 'github_issue' && directory.method !== 'github_pr') {
		const link = githubIssueLink(directory, profile, body);
		if (link) links.push({ label: 'Or open a GitHub issue, already filled in', url: link });
		text ??= { title: (directory.github.title ?? defaultTitle)(profile), body };
	}

	const prepared: PreparedSubmission = {
		directory: {
			id: directory.id,
			name: directory.name,
			submitUrl: directory.submitUrl,
			method: directory.method,
			account: directory.account,
			cost: directory.cost,
			captcha: directory.captcha
		},
		sendsAutomatically: Boolean(directory.autoSubmit),
		fields,
		missing,
		links,
		steps: directory.steps,
		tips: directory.tips ?? []
	};
	if (directory.scope) prepared.directory.scope = directory.scope;
	if (directory.entry) prepared.entry = directory.entry(profile);
	if (text) prepared.text = text;
	return prepared;
}

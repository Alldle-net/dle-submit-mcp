import type { GameProfile, ProfileField } from '../games.ts';
import type { Fetcher } from '../http.ts';

/**
 * How a directory takes new games.
 *
 * - api: this server sends the submission itself.
 * - form: a web form; this server sends it when the form allows (see `autoSubmit`).
 * - github_issue / gitlab_issue: an issue on the list's repository.
 * - github_pr: a pull request that adds the game to a data file.
 * - email: an email to the maintainers.
 * - contact: a general contact form or address, no submission form.
 * - discord: a request on the site's Discord server.
 */
export type SubmitMethod = 'api' | 'form' | 'github_issue' | 'github_pr' | 'gitlab_issue' | 'email' | 'contact' | 'discord';

export type Cost = 'free' | 'free_or_paid' | 'paid';

/** A value a directory asks for: one of the profile's fields, or the composed pitch. */
export type FieldSource = ProfileField | 'pitch';

export interface DirectoryField {
	source: FieldSource;
	/** The directory's own wording for it, so it can be matched to the form. */
	label: string;
	required: boolean;
	maxLength?: number;
	note?: string;
}

export interface SubmitContext {
	profile: GameProfile;
	fetcher: Fetcher;
	/** The directory's own category, when the maker picked one for it. */
	category?: string;
}

export interface SubmitOutcome {
	/** submitted: the directory accepted it for review. listed: it already lists the game. */
	outcome: 'submitted' | 'listed' | 'failed';
	detail: string;
	reference?: string;
}

export interface CheckOutcome {
	/** yes: the game's link is on the directory. maybe: something with its name is. */
	found: 'yes' | 'maybe' | 'no' | 'unknown';
	detail: string;
	reference?: string;
}

export interface Directory {
	id: string;
	name: string;
	url: string;
	/** Where a maker goes to submit, or the page that explains how. */
	submitUrl: string;
	method: SubmitMethod;
	account: boolean;
	cost: Cost;
	captcha: boolean;
	/** One neutral line about the site. */
	about: string;
	/** Who the site lists, when it is narrower than all daily games. */
	scope?: string;
	fields: DirectoryField[];
	/** What to do, in order, when nothing can be sent automatically. */
	steps: string[];
	tips?: string[];
	github?: {
		repo: string;
		/** An issue form's file name: its fields can be filled from the URL by id. */
		template?: string;
		labels?: string[];
		title?: (profile: GameProfile) => string;
		/** Issue-form field ids, for prefilling a form-style template. */
		fieldIds?: Partial<Record<FieldSource, string>>;
	};
	gitlab?: { project: string; title?: (profile: GameProfile) => string };
	email?: string;
	/** Sends the submission itself. Only for public endpoints with no captcha and no account. */
	autoSubmit?: (context: SubmitContext) => Promise<SubmitOutcome>;
	/** For lists kept in a README: the line to add. */
	entry?: (profile: GameProfile) => string;
	/** Looks for the game on the directory, from a public page or endpoint. */
	check?: (context: SubmitContext) => Promise<CheckOutcome>;
	/** What becomes possible once the game is listed. */
	afterListing?: string[];
	/** When the submission path above was last confirmed on the site. */
	verified: string;
}

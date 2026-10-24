/** Messages from the content script or popup to the background service worker. */
export type ExtensionMessage =
  | { type: "badge"; text: string; state: "locked" | "paused" | "unlocked" }
  | { type: "reset-code"; slug: string }
  | { type: "graphql"; query: string; variables: Record<string, unknown> }
  | { type: "open-dashboard"; hash?: string };

export interface ResetCodeResult {
  ok: boolean;
  /** Why the reset was skipped or failed, when ok is false. */
  reason?: string;
  lang?: string;
  /** How many saved drafts in other languages were removed. */
  removedDrafts?: number;
}

export interface GraphqlResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

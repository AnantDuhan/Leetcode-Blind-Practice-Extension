import { outcomeOf, scheduleAfter, type Attempt, type ReviewState } from "../shared/review";

/**
 * Practice history: every attempt per problem plus its re-solve schedule.
 * Stored only in chrome.storage.local on this device; nothing is uploaded.
 */

export interface ProblemMeta {
  title: string;
  frontendId: string;
  difficulty: string;
  topics: string[];
}

export interface ProblemRecord {
  slug: string;
  meta?: ProblemMeta;
  attempts: Attempt[];
  review?: ReviewState;
}

export type History = Record<string, ProblemRecord>;

interface HistoryStorage {
  history?: History;
  flags?: Flags;
}

export interface Flags {
  /** The one-time thank-you after the 10th solved problem was shown. */
  thankYouShown?: boolean;
}

/** Keep the newest attempts per problem; older ones add little. */
const MAX_ATTEMPTS_PER_PROBLEM = 50;

export async function getHistory(): Promise<History> {
  const result = await chrome.storage.local.get<HistoryStorage>("history");
  return result.history ?? {};
}

async function setHistory(history: History): Promise<void> {
  await chrome.storage.local.set<HistoryStorage>({ history });
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialized read-modify-write so concurrent updates can't overwrite each other. */
function update<T>(change: (history: History, now: number) => T): Promise<T> {
  const run = queue.then(async () => {
    const history = await getHistory();
    const result = change(history, Date.now());
    await setHistory(history);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

function recordFor(history: History, slug: string): ProblemRecord {
  history[slug] ??= { slug, attempts: [] };
  return history[slug];
}

function attemptFor(record: ProblemRecord, attemptId: number, review = false): Attempt {
  let attempt = record.attempts.find((a) => a.id === attemptId);
  if (!attempt) {
    attempt = { id: attemptId, review };
    record.attempts.push(attempt);
    record.attempts.sort((a, b) => a.id - b.id);
    if (record.attempts.length > MAX_ATTEMPTS_PER_PROBLEM) {
      record.attempts.splice(0, record.attempts.length - MAX_ATTEMPTS_PER_PROBLEM);
    }
  }
  return attempt;
}

export function saveMeta(slug: string, meta: ProblemMeta): Promise<void> {
  return update((history) => {
    recordFor(history, slug).meta = meta;
  });
}

export function beginAttempt(slug: string, attemptId: number, review: boolean): Promise<void> {
  return update((history) => {
    attemptFor(recordFor(history, slug), attemptId, review);
  });
}

/** A solution section was opened before solving: the problem comes back tomorrow. */
export function recordPeek(slug: string, attemptId: number, at: number): Promise<void> {
  return update((history) => {
    const record = recordFor(history, slug);
    const attempt = attemptFor(record, attemptId);
    if (attempt.peekedAt !== undefined || attempt.solvedAt !== undefined) return;
    attempt.peekedAt = at;
    record.review = scheduleAfter(record.review, "gave-up", at);
  });
}

export interface SolveResult {
  record: ProblemRecord;
  attempt: Attempt;
  /** How many problems have at least one solved attempt, after this one. */
  solvedProblems: number;
}

export function recordSolve(
  slug: string,
  attemptId: number,
  details: { solvedAt: number; solveMs: number; peeked: boolean; wrongSubmissions: number },
): Promise<SolveResult> {
  return update((history) => {
    const record = recordFor(history, slug);
    const attempt = attemptFor(record, attemptId);
    if (attempt.solvedAt === undefined) {
      attempt.solvedAt = details.solvedAt;
      attempt.solveMs = Math.round(details.solveMs);
      attempt.wrongSubmissions = details.wrongSubmissions;
      if (details.peeked && attempt.peekedAt === undefined) attempt.peekedAt = details.solvedAt - 1;
      record.review = scheduleAfter(record.review, outcomeOf(attempt), details.solvedAt);
    }
    const solvedProblems = Object.values(history).filter((r) => r.attempts.some((a) => a.solvedAt !== undefined)).length;
    return { record: structuredClone(record), attempt: { ...attempt }, solvedProblems };
  });
}

export function setRetired(slug: string, retired: boolean): Promise<void> {
  return update((history) => {
    const record = history[slug];
    if (!record) return;
    record.review = { ...(record.review ?? { step: 0, dueAt: null }), retired };
    if (!retired && record.review.dueAt === null) record.review.dueAt = Date.now();
  });
}

export function clearHistory(): Promise<void> {
  return update((history) => {
    for (const slug of Object.keys(history)) delete history[slug];
  });
}

/** Merges an exported file into the current history. Returns problems added or updated. */
export function importHistory(incoming: unknown): Promise<number> {
  if (!incoming || typeof incoming !== "object") return Promise.reject(new Error("Not a history file"));
  const data = (incoming as { history?: unknown }).history ?? incoming;
  if (!data || typeof data !== "object") return Promise.reject(new Error("Not a history file"));

  return update((history) => {
    let changed = 0;
    for (const [slug, raw] of Object.entries(data as Record<string, unknown>)) {
      const record = raw as Partial<ProblemRecord>;
      if (!Array.isArray(record?.attempts)) continue;
      const target = recordFor(history, slug);
      target.meta ??= record.meta;
      for (const attempt of record.attempts) {
        if (typeof attempt?.id !== "number") continue;
        if (!target.attempts.some((a) => a.id === attempt.id)) target.attempts.push(attempt);
      }
      target.attempts.sort((a, b) => a.id - b.id);
      if (record.review && (!target.review || (record.review.dueAt ?? 0) > (target.review.dueAt ?? 0))) {
        target.review = record.review;
      }
      changed++;
    }
    return changed;
  });
}

export async function exportHistory(): Promise<string> {
  const history = await getHistory();
  return JSON.stringify({ format: "no-peek-history", version: 1, exportedAt: new Date().toISOString(), history }, null, 2);
}

export function onHistoryChanged(listener: () => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes.history) listener();
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export async function getFlags(): Promise<Flags> {
  const result = await chrome.storage.local.get<HistoryStorage>("flags");
  return result.flags ?? {};
}

export async function setFlag(flag: keyof Flags, value: boolean): Promise<void> {
  const flags = await getFlags();
  await chrome.storage.local.set<HistoryStorage>({ flags: { ...flags, [flag]: value } });
}

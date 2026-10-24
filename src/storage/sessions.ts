/**
 * Per-problem practice sessions, keyed by problem slug ("two-sum").
 *
 * Stored in chrome.storage.local (not sync) because it changes often and is
 * per-device. Persisting it means a page reload, a second tab, or switching
 * problems and coming back all see the same timer.
 *
 * The timer is pausable, so a session stores time already spent plus when
 * the current running stretch began, rather than just a start time.
 */

/** Why a session is paused. Only "auto" pauses resume by themselves. */
export type PauseReason = "user" | "auto";

export interface ProblemSession {
  /** Identifies this attempt in the history. Kept across restarts. */
  attemptId: number;
  /** Epoch ms of the (re)start. Used for the 24 h expiry. */
  startedAt: number;
  /** Solving time accumulated before the current running stretch, in ms. */
  elapsedMs: number;
  /** Epoch ms the current running stretch began; null while paused. */
  runningSince: number | null;
  /** Set while paused. */
  pausedBy?: PauseReason;
  /** Set when the user used "Reveal anyway" (only possible with strict mode off). */
  revealedEarly?: boolean;
  /** Set when a solution section was opened before solving. */
  peeked?: boolean;
  /** Epoch ms of the first Accepted submission. Solving unlocks everything. */
  solvedAt?: number;
}

type SessionMap = Record<string, ProblemSession>;

interface SessionStorage {
  sessions?: Record<string, Partial<ProblemSession>>;
}

/** A session older than this is treated as a fresh attempt at the problem. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Solving time so far, counting the current running stretch. */
export function elapsedMs(session: ProblemSession, now = Date.now()): number {
  const running = session.runningSince === null ? 0 : Math.max(0, now - session.runningSince);
  return session.elapsedMs + running;
}

export function isPaused(session: ProblemSession): boolean {
  return session.runningSince === null;
}

/** Accepts sessions saved by older versions, which only had `startedAt`. */
function normalize(raw: Partial<ProblemSession> | undefined): ProblemSession | null {
  if (!raw || typeof raw.startedAt !== "number") return null;
  const legacy = raw.elapsedMs === undefined && raw.runningSince === undefined;
  return {
    attemptId: typeof raw.attemptId === "number" ? raw.attemptId : raw.startedAt,
    startedAt: raw.startedAt,
    elapsedMs: legacy ? 0 : Math.max(0, Number(raw.elapsedMs) || 0),
    runningSince: legacy ? raw.startedAt : typeof raw.runningSince === "number" ? raw.runningSince : null,
    ...(raw.pausedBy ? { pausedBy: raw.pausedBy } : {}),
    ...(raw.revealedEarly ? { revealedEarly: true } : {}),
    ...(raw.peeked ? { peeked: true } : {}),
    ...(typeof raw.solvedAt === "number" ? { solvedAt: raw.solvedAt } : {}),
  };
}

function isLive(session: ProblemSession | null, now: number): session is ProblemSession {
  return !!session && now - session.startedAt < SESSION_TTL_MS;
}

async function readAll(): Promise<SessionMap> {
  const result = await chrome.storage.local.get<SessionStorage>("sessions");
  const sessions: SessionMap = {};
  for (const [slug, raw] of Object.entries(result.sessions ?? {})) {
    const session = normalize(raw);
    if (session) sessions[slug] = session;
  }
  return sessions;
}

async function writeAll(sessions: SessionMap): Promise<void> {
  const now = Date.now();
  const pruned: SessionMap = {};
  for (const [slug, session] of Object.entries(sessions)) {
    if (isLive(session, now)) pruned[slug] = session;
  }
  await chrome.storage.local.set<SessionStorage>({ sessions: pruned });
}

// Serialize read-modify-write updates made from this page so they can't
// overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

function update<T>(slug: string, change: (current: ProblemSession | null, now: number) => { next: ProblemSession | null; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const sessions = await readAll();
    const now = Date.now();
    const current = sessions[slug] ?? null;
    const { next, result } = change(isLive(current, now) ? current : null, now);
    if (next && next !== current) {
      sessions[slug] = next;
      await writeAll(sessions);
    }
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function getSession(slug: string): Promise<ProblemSession | null> {
  const session = (await readAll())[slug] ?? null;
  return isLive(session, Date.now()) ? session : null;
}

function freshSession(now: number): ProblemSession {
  return { attemptId: now, startedAt: now, elapsedMs: 0, runningSince: now };
}

/**
 * Starts the timer for a problem. `created` is false when a live session
 * already existed (for example, started from another tab), in which case the
 * existing one is returned unchanged.
 */
export function startSession(slug: string): Promise<{ session: ProblemSession; created: boolean }> {
  return update<{ session: ProblemSession; created: boolean }>(slug, (current, now) => {
    if (current) return { next: current, result: { session: current, created: false } };
    const session = freshSession(now);
    return { next: session, result: { session, created: true } };
  });
}

/** Pauses a running session. Does nothing if it is already paused. */
export function pauseSession(slug: string, reason: PauseReason): Promise<void> {
  return update(slug, (current, now) => {
    if (!current || isPaused(current)) return { next: null, result: undefined };
    return {
      next: { ...current, elapsedMs: elapsedMs(current, now), runningSince: null, pausedBy: reason },
      result: undefined,
    };
  });
}

/**
 * Resumes a paused session. With `onlyIfAuto`, a pause the user made
 * themselves is left alone (used when a tab becomes visible again).
 */
export function resumeSession(slug: string, options: { onlyIfAuto?: boolean } = {}): Promise<void> {
  return update(slug, (current, now) => {
    if (!current || !isPaused(current)) return { next: null, result: undefined };
    if (options.onlyIfAuto && current.pausedBy !== "auto") return { next: null, result: undefined };
    const next: ProblemSession = { ...current, runningSince: now };
    delete next.pausedBy;
    return { next, result: undefined };
  });
}

/**
 * Puts the full think time back and starts counting again. Code is not
 * touched, and it stays the same attempt in the history.
 */
export function restartSession(slug: string): Promise<void> {
  return update(slug, (current, now) => {
    if (current?.solvedAt) return { next: null, result: undefined };
    const next: ProblemSession = { ...freshSession(now), attemptId: current?.attemptId ?? now };
    if (current?.peeked) next.peeked = true;
    return { next, result: undefined };
  });
}

export function markRevealedEarly(slug: string): Promise<void> {
  return update(slug, (current, now) => ({
    next: { ...(current ?? freshSession(now)), revealedEarly: true, peeked: true },
    result: undefined,
  }));
}

/** Records that a solution section was opened before solving. */
export function markSessionPeeked(slug: string): Promise<ProblemSession | null> {
  return update(slug, (current) => {
    if (!current || current.peeked || current.solvedAt) return { next: null, result: null };
    const next = { ...current, peeked: true };
    return { next, result: next };
  });
}

/**
 * Records the first Accepted submission: stops the clock (so the solve time
 * is fixed) and unlocks everything. Returns null if already solved.
 */
export function markSessionSolved(slug: string, solvedAt: number): Promise<ProblemSession | null> {
  return update(slug, (current) => {
    if (!current || current.solvedAt) return { next: null, result: null };
    const next: ProblemSession = {
      ...current,
      elapsedMs: elapsedMs(current, solvedAt),
      runningSince: null,
      solvedAt,
    };
    delete next.pausedBy;
    return { next, result: next };
  });
}

/** Calls `listener` when any tab or the popup changes a session. */
export function onSessionsChanged(listener: () => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes.sessions) listener();
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

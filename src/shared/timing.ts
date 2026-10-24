import { elapsedMs, type ProblemSession } from "../storage/sessions";
import type { UserSettings } from "../storage/settings";

/** Solving time left until unlock, 0 once unlocked or revealed early. */
export function remainingMs(session: ProblemSession, settings: UserSettings, now = Date.now()): number {
  if (session.revealedEarly) return 0;
  return Math.max(0, settings.thinkTime * 60_000 - elapsedMs(session, now));
}

/** "04:59", or "1:04:59" for an hour or more. Never negative. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Short text for the toolbar badge: "25m" while locked, "✓" once unlocked. */
export function badgeText(ms: number): string {
  return ms > 0 ? `${Math.ceil(ms / 60_000)}m` : "✓";
}

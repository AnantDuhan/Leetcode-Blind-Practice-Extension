import { DEFAULT_SETTINGS, loadSettings, onSettingsChanged, type UserSettings } from "../storage/settings";
import {
  getSession,
  isPaused,
  markRevealedEarly,
  onSessionsChanged,
  pauseSession,
  restartSession,
  resumeSession,
  startSession,
  type ProblemSession,
} from "../storage/sessions";
import type { ExtensionMessage, ResetCodeResult } from "../shared/messages";
import { badgeText, formatRemaining, remainingMs } from "../shared/timing";
import { descriptionUrl, lockedSectionForTarget, parseRoute, type LockedSection, type ProblemRoute } from "./route";
import { PracticeUi, type ViewState } from "./ui";

/**
 * Controller for the content script. It runs on every leetcode.com page
 * (LeetCode is a single-page app, so you can reach a problem without a page
 * load) and only acts on /problems/<slug>/ URLs.
 *
 * One interval drives everything: it notices URL changes and re-renders the
 * countdown. Remaining time is always computed from the stored session, so
 * the display can't drift from the actual unlock time or go negative.
 *
 * Auto-pause: the timer only runs while a tab showing the problem is visible.
 * A tab pauses the timer when it becomes hidden, unloads, or navigates to a
 * different problem; any visible tab on that problem resumes it on its next
 * tick. A pause the user made with the button is never resumed automatically.
 */

const TICK_MS = 500;
const INTERCEPTED_EVENTS = ["pointerdown", "mousedown", "click", "auxclick"] as const;

let ready = false;
let settings: UserSettings = DEFAULT_SETTINGS;
let route: ProblemRoute | null = null;
let session: ProblemSession | null = null;
let currentHref = "";
/** A locked section the user tried to open on a page whose URL isn't locked. */
let interceptedSection: LockedSection | null = null;
/** Guards against an older async session lookup overwriting a newer one. */
let sessionRequest = 0;
/** Short status shown in the corner badge for a few seconds. */
let notice: { text: string; until: number } | null = null;
/** Last value sent for the toolbar badge, to avoid resending every tick. */
let lastToolbarBadge = "";
/** True while an auto-pause or auto-resume write is in flight. */
let autoPauseBusy = false;

const ui = new PracticeUi({
  onStart: () => void handleStart(),
  onBack: handleBack,
  onRevealEarly: () => void handleRevealEarly(),
  onTogglePause: () => void handleTogglePause(),
  onRestart: () => void handleRestart(),
});

function isLocked(now = Date.now()): boolean {
  if (!ready || !settings.enabled || !route) return false;
  if (!session) return true;
  return remainingMs(session, settings, now) > 0;
}

function sendMessage(message: ExtensionMessage): Promise<unknown> {
  try {
    return chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // The extension was reloaded or updated; this old content script is orphaned.
    return Promise.resolve(undefined);
  }
}

/** Mirrors the countdown onto the toolbar icon for this tab. */
function updateToolbarBadge(now: number): void {
  const ms = ready && settings.enabled && route && session ? remainingMs(session, settings, now) : null;
  const state = ms === null || ms <= 0 ? "unlocked" : session && isPaused(session) ? "paused" : "locked";
  const text = ms === null ? "" : badgeText(ms);
  if (`${text}|${state}` === lastToolbarBadge) return;
  lastToolbarBadge = `${text}|${state}`;
  void sendMessage({ type: "badge", text, state });
}

function buildView(now: number): ViewState {
  if (!ready || !settings.enabled || !route) {
    return { badge: null, startCard: null, lock: null };
  }

  const locked = isLocked(now);
  if (!locked) interceptedSection = null;

  const remaining = session ? formatRemaining(remainingMs(session, settings, now)) : "";
  const paused = !!session && isPaused(session);
  const noticeText = notice && now < notice.until ? notice.text : null;
  const lockSection = locked ? (route.lockedSection ?? interceptedSection) : null;

  let badge: ViewState["badge"] = null;
  if (session) {
    const state = !locked ? "unlocked" : paused ? "paused" : "locked";
    const text =
      noticeText ??
      (state === "unlocked"
        ? "🔓 Solutions unlocked"
        : state === "paused"
          ? `⏸ Paused · ${remaining} left`
          : `🔒 Solutions unlock in ${remaining}`);
    badge = { state, text, showControls: locked };
  }

  return {
    badge,
    startCard: session ? null : { thinkTime: settings.thinkTime, resetCode: settings.resetCode },
    lock: lockSection
      ? {
          section: lockSection,
          notStarted: !session,
          remainingText: remaining,
          paused,
          canRevealEarly: !settings.strictMode,
        }
      : null,
  };
}

function render(): void {
  const now = Date.now();
  ui.render(buildView(now));
  updateToolbarBadge(now);
}

function showNotice(text: string, ms = 6000): void {
  notice = { text, until: Date.now() + ms };
  render();
}

async function refreshSession(): Promise<void> {
  const request = ++sessionRequest;
  const slug = route?.slug;
  const next = slug ? await getSession(slug) : null;
  if (request !== sessionRequest) return;
  session = next;
  render();
}

function handleRouteChange(): void {
  currentHref = location.href;
  const next = parseRoute(location.pathname);
  const sameProblem = next?.slug === route?.slug;
  // Leaving a problem in this tab pauses its timer.
  if (!sameProblem && route && session && !isPaused(session) && isLocked()) {
    void pauseSession(route.slug, "auto");
  }
  route = next;
  interceptedSection = null;
  if (!sameProblem) session = null;
  render();
  void refreshSession();
}

async function handleStart(): Promise<void> {
  if (!route) return;
  const slug = route.slug;
  const { session: started, created } = await startSession(slug);
  if (route?.slug !== slug) return;
  session = started;
  render();

  // Only a fresh attempt resets the code. A session that already existed
  // (started in another tab) means you may have work in progress.
  if (created && settings.resetCode) {
    showNotice("↺ Resetting code to the default template…", 20_000);
    const result = (await sendMessage({ type: "reset-code", slug })) as ResetCodeResult | undefined;
    if (route?.slug !== slug) return;
    if (result?.ok) showNotice("↺ Code reset to the default template", 3000);
    else showNotice(`⚠️ Couldn't reset code: ${result?.reason ?? "no response"}`, 8000);
  }
}

function handleBack(): void {
  if (route?.lockedSection) {
    location.assign(descriptionUrl(route.slug));
    return;
  }
  interceptedSection = null;
  render();
}

async function handleTogglePause(): Promise<void> {
  if (!route || !session || !isLocked()) return;
  if (isPaused(session)) await resumeSession(route.slug);
  else await pauseSession(route.slug, "user");
  await refreshSession();
}

async function handleRestart(): Promise<void> {
  if (!route || !session) return;
  await restartSession(route.slug);
  await refreshSession();
  showNotice("↺ Timer restarted", 2500);
}

/** Pauses the timer because this tab is going away (hidden, closed, unloaded). */
function autoPause(): void {
  if (!route || !session || isPaused(session) || !isLocked()) return;
  // pauseSession is idempotent, so visibilitychange followed by pagehide is fine.
  void pauseSession(route.slug, "auto");
}

/** Resumes an auto-paused timer when this tab is showing the problem again. */
function maybeAutoResume(): void {
  if (autoPauseBusy || document.visibilityState !== "visible") return;
  if (!route || !session || !isPaused(session) || session.pausedBy !== "auto" || !isLocked()) return;
  autoPauseBusy = true;
  void resumeSession(route.slug, { onlyIfAuto: true })
    .then(refreshSession)
    .finally(() => {
      autoPauseBusy = false;
    });
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "hidden") autoPause();
  else maybeAutoResume();
}

async function handleRevealEarly(): Promise<void> {
  if (!route || settings.strictMode) return;
  await markRevealedEarly(route.slug);
  await refreshSession();
}

/**
 * Blocks opening a locked section before LeetCode sees the event. LeetCode's
 * tabs switch on pointerdown, so click alone is not enough. Only the event
 * target's ancestors are inspected; the page is never scanned.
 */
function interceptLockedInteraction(event: Event): void {
  if (!isLocked()) return;
  if (event.composedPath().includes(ui.element)) return;

  const section = lockedSectionForTarget(event.target);
  if (!section) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.type === "pointerdown" || event.type === "click") {
    interceptedSection = section;
    render();
  }
}

async function main(): Promise<void> {
  for (const type of INTERCEPTED_EVENTS) {
    window.addEventListener(type, interceptLockedInteraction, { capture: true });
  }

  settings = await loadSettings();
  ready = true;

  onSettingsChanged((next) => {
    settings = next;
    render();
  });
  onSessionsChanged(() => void refreshSession());
  window.addEventListener("popstate", handleRouteChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", autoPause);

  handleRouteChange();
  // A problem opened in a background tab shouldn't keep a running timer going.
  await refreshSession();
  if (document.visibilityState === "hidden") autoPause();

  setInterval(() => {
    if (location.href !== currentHref) handleRouteChange();
    else render();
    maybeAutoResume();
  }, TICK_MS);
}

void main();

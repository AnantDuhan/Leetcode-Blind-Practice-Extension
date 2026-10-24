/**
 * Everything that depends on LeetCode's URLs and DOM lives in this file, so a
 * LeetCode redesign should only ever need changes here.
 *
 * Verified against leetcode.com in October 2026:
 * - The left-panel tab is chosen by the URL (/problems/<slug>/editorial/ etc.).
 *   A bare /problems/<slug>/ always opens Description, so the URL is the
 *   reliable thing to guard, not tab labels.
 * - Tabs are flexlayout buttons that switch on `pointerdown`, not `click`, and
 *   carry stable ids: #editorial_tab, #solutions_tab, #submissions_tab.
 * - Discussion is an expandable row on the Description tab whose text starts
 *   with "Discussion (" and does not change the URL.
 * - The AI assistant opens from a button with aria-label "Ask Leet".
 * - Submit is button[data-e2e-locator="console-submit-button"], shortcut
 *   Cmd/Ctrl+Enter. Run is "console-run-button" and must not count.
 */

export type LockedSection = "Editorial" | "Solutions" | "Submissions" | "Discussion" | "Ask Leet (AI)";

export interface ProblemRoute {
  slug: string;
  /** Section the URL is on, if that section is one we lock. */
  lockedSection: LockedSection | null;
}

const PROBLEM_PATH = /^\/problems\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/;

export function parseRoute(pathname: string): ProblemRoute | null {
  const match = PROBLEM_PATH.exec(pathname);
  if (!match) return null;

  const [, slug, section, detail] = match;
  let lockedSection: LockedSection | null = null;

  if (section === "editorial") lockedSection = "Editorial";
  else if (section === "solutions") lockedSection = "Solutions";
  // /submissions/ is the list of your past code. /submissions/<id>/ is the
  // result page LeetCode opens after you submit, which you must be able to see.
  else if (section === "submissions" && !detail) lockedSection = "Submissions";
  else if (section === "discuss") lockedSection = "Discussion";

  return { slug, lockedSection };
}

export function descriptionUrl(slug: string): string {
  return `/problems/${slug}/description/`;
}

const TAB_IDS: Record<string, LockedSection> = {
  editorial_tab: "Editorial",
  solutions_tab: "Solutions",
  submissions_tab: "Submissions",
};

const MAX_ANCESTORS = 8;

function safePathname(href: string): string {
  try {
    const url = new URL(href, location.origin);
    return url.origin === location.origin ? url.pathname : "";
  } catch {
    return "";
  }
}

/**
 * Returns the locked section an interaction target belongs to, or null.
 * Walks a few ancestors up from the event target only; it never scans the page.
 */
export function lockedSectionForTarget(target: EventTarget | null): LockedSection | null {
  if (!(target instanceof Element)) return null;
  // Never interfere with the code editor (its tokens can contain "Solution").
  if (target.closest(".monaco-editor")) return null;

  if (target.closest('[aria-label="Ask Leet"]')) return "Ask Leet (AI)";

  const tabButton = target.closest(".flexlayout__tab_button");
  if (tabButton) {
    for (const [id, section] of Object.entries(TAB_IDS)) {
      if (tabButton.querySelector(`#${id}`)) return section;
    }
    return null;
  }

  let el: Element | null = target;
  for (let i = 0; el && i < MAX_ANCESTORS; i++, el = el.parentElement) {
    const href = el.getAttribute("href");
    if (href) {
      const route = parseRoute(safePathname(href));
      if (route?.lockedSection) return route.lockedSection;
    }
    if (el.matches("div.group.cursor-pointer") && /^Discussion\b/.test(el.textContent?.trim() ?? "")) {
      return "Discussion";
    }
  }
  return null;
}

/** True when the event target is LeetCode's Submit button. */
export function isSubmitTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-e2e-locator="console-submit-button"]');
}

/** True for LeetCode's submit shortcut, Cmd+Enter on Mac and Ctrl+Enter elsewhere. */
export function isSubmitShortcut(event: KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
}

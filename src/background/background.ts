import type { ExtensionMessage, GraphqlResult, ResetCodeResult } from "../shared/messages";
import { APP_NAME, FULL_NAME } from "../shared/brand";
import { dueProblems } from "../shared/stats";
import { getHistory } from "../storage/history";
import { pageGraphql } from "./pageFetch";
import { resetEditorToDefault } from "./resetEditor";

const BADGE_COLORS = {
  locked: "#374151",
  paused: "#b45309",
  unlocked: "#16a34a",
} as const;
const DUE_COLOR = "#7c3aed";

chrome.runtime.onInstalled.addListener((details) => {
  void updateDueBadge();
  // Chrome doesn't inject content scripts into tabs that were already open.
  // After an install or update, add a fresh copy so open LeetCode tabs work
  // straight away; an old copy left over from the previous version shuts
  // itself down when it sees the new one.
  if (details.reason === "install" || details.reason === "update") void injectIntoOpenTabs();
});
chrome.runtime.onStartup.addListener(() => void updateDueBadge());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.history) void updateDueBadge();
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === "open-dashboard") {
    void chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${message.hash ?? ""}`) });
    return;
  }

  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  if (message.type === "badge") {
    void setBadge(tabId, message.text, message.state);
    // Problems become due as time passes; refresh at most once a minute.
    void maybeRefreshDueBadge();
    return;
  }

  if (message.type === "reset-code" || message.type === "graphql") {
    const injection =
      message.type === "reset-code"
        ? chrome.scripting.executeScript({
            target: { tabId, frameIds: [sender.frameId ?? 0] },
            world: "MAIN",
            func: resetEditorToDefault,
            args: [message.slug, message.force === true],
          })
        : chrome.scripting.executeScript({
            target: { tabId, frameIds: [sender.frameId ?? 0] },
            world: "MAIN",
            func: pageGraphql,
            args: [message.query, message.variables],
          });
    injection
      .then(([result]) => sendResponse(result?.result ?? { ok: false, reason: "No result", error: "No result" }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, reason: String(error), error: String(error) } satisfies ResetCodeResult & GraphqlResult),
      );
    return true; // keep the channel open for the async response
  }
});

/**
 * Per-tab toolbar badge: minutes left (amber while paused), a check once
 * unlocked. An empty text hands the tab back to the global badge, which shows
 * how many problems are due for a re-solve.
 */
async function setBadge(tabId: number, text: string, state: keyof typeof BADGE_COLORS): Promise<void> {
  try {
    if (!text) {
      // null (not "") reverts this tab to the global badge.
      await chrome.action.setBadgeText({ tabId, text: null as unknown as string });
      return;
    }
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[state] });
    await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
  } catch {
    // The tab was closed between the message and the update.
  }
}

async function injectIntoOpenTabs(): Promise<void> {
  for (const script of chrome.runtime.getManifest().content_scripts ?? []) {
    if (!script.js?.length || !script.matches?.length) continue;
    const tabs = await chrome.tabs.query({ url: script.matches });
    for (const tab of tabs) {
      if (tab.id === undefined || tab.discarded) continue;
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: script.js }).catch(() => {
        // The tab is loading, closed, or showing an error page; it gets the script on its next load.
      });
    }
  }
}

let lastDueRefresh = 0;

function maybeRefreshDueBadge(): Promise<void> {
  if (Date.now() - lastDueRefresh < 60_000) return Promise.resolve();
  return updateDueBadge();
}

async function updateDueBadge(): Promise<void> {
  lastDueRefresh = Date.now();
  try {
    const due = dueProblems(await getHistory(), Date.now()).length;
    await chrome.action.setBadgeText({ text: due > 0 ? String(due) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: DUE_COLOR });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
    await chrome.action.setTitle({
      title: due > 0 ? `${APP_NAME}: ${due} problem${due === 1 ? "" : "s"} due for a re-solve` : FULL_NAME,
    });
  } catch {
    // Badge APIs can fail during shutdown; the next event retries.
  }
}

void updateDueBadge();

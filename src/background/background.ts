import type { ExtensionMessage, ResetCodeResult } from "../shared/messages";
import { resetEditorToDefault } from "./resetEditor";

const BADGE_COLORS = {
  locked: "#374151",
  paused: "#b45309",
  unlocked: "#16a34a",
} as const;

chrome.runtime.onInstalled.addListener(() => {
  console.log("No Peek: Solution Lock & Timer for LeetCode installed");
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  if (message.type === "badge") {
    void setBadge(tabId, message.text, message.state);
    return;
  }

  if (message.type === "reset-code") {
    chrome.scripting
      .executeScript({
        target: { tabId, frameIds: [sender.frameId ?? 0] },
        world: "MAIN",
        func: resetEditorToDefault,
        args: [message.slug],
      })
      .then(([injection]) => sendResponse((injection?.result as ResetCodeResult) ?? { ok: false, reason: "No result" }))
      .catch((error: unknown) => sendResponse({ ok: false, reason: String(error) } satisfies ResetCodeResult));
    return true; // keep the channel open for the async response
  }
});

/** Per-tab toolbar badge: minutes left (amber while paused), a check once unlocked. */
async function setBadge(tabId: number, text: string, state: keyof typeof BADGE_COLORS): Promise<void> {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    if (!text) return;
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[state] });
    await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
  } catch {
    // The tab was closed between the message and the update.
  }
}

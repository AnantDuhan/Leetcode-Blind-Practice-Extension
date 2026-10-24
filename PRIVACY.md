# Privacy Policy: No Peek: Solution Lock & Timer for LeetCode

Last updated: 24 October 2026

No Peek does not collect, sell or share any personal data. The developer receives nothing from the extension.

## What the extension stores

All data stays in your browser:

| Data | Where | Why |
| --- | --- | --- |
| Your settings (enabled, strict mode, reset code on start, think time) | `chrome.storage.sync` | So your settings follow your Chrome profile. Chrome syncs this through your Google account, like any extension's settings. |
| For each problem you start: its URL name (for example `two-sum`), when you started, solving time so far, and whether it is paused | `chrome.storage.local`, on this device only | So the timer survives reloads, second tabs and switching problems. Entries are deleted automatically after 24 hours. |

## What the extension does on leetcode.com

The extension runs only on `leetcode.com`. It does not run on any other site.

When you start a fresh attempt with **Reset code on start** turned on, the extension, inside the LeetCode page:

- requests the problem's default code template from LeetCode's own server (`leetcode.com/graphql`). This request goes only to LeetCode and contains only the problem's URL name;
- reads which programming language you have selected, from LeetCode's storage in your browser;
- replaces the code in the editor with the default template;
- deletes the drafts LeetCode saved in your browser for that problem in other languages.

Your submissions on LeetCode are never read or changed. You can turn this off at any time with the **Reset code on start** setting.

## What the extension does not do

- It does not send any data to the developer or to any third party.
- It does not use analytics, tracking or advertising.
- It does not read your LeetCode account details, your submissions or your browsing on other sites.
- It does not load or run code from any remote server.

## Removing your data

Uninstalling the extension removes everything it stored.

## Contact

Questions: duhananant@gmail.com, or open an issue at
https://github.com/AnantDuhan/Leetcode-Blind-Practice-Extension/issues
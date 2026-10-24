import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,

  name: "No Peek: Solution Lock & Timer for LeetCode",

  version: "1.4.0",

  description:
    "Hide previous solutions and improve problem-solving discipline.",

  permissions: [
    // settings and per-problem start times
    "storage",
    // run the code reset in the page's own JS world, where the editor lives
    "scripting"
  ],

  host_permissions: [
    "https://leetcode.com/*"
  ],

  action: {
    default_popup: "popup.html",
    default_title: "No Peek: Solution Lock & Timer for LeetCode",
    default_icon: {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },

  background: {
    service_worker: "src/background/background.ts",
    type: "module"
  },

  content_scripts: [
    {
      // All of leetcode.com, not just /problems/*: the site is a single-page
      // app, so you can reach a problem from the problem list without a page
      // load, and a script limited to /problems/* would never be injected.
      matches: [
        "https://leetcode.com/*"
      ],

      js: [
        "src/content/content.ts"
      ],

      run_at: "document_idle"
    }
  ],

  icons: {
    "16": "icon16.png",
    "32": "icon32.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
};

export default manifest;
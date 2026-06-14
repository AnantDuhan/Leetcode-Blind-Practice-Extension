import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,

  name: "LeetCode Blind Practice",

  version: "1.0.0",

  description:
    "Hide previous solutions and improve problem-solving discipline.",

  permissions: [
    "storage",
    "tabs",
    "activeTab"
  ],

  host_permissions: [
    "https://leetcode.com/*"
  ],

  action: {
    default_popup: "popup.html"
  },

  background: {
    service_worker: "src/background/background.ts",
    type: "module"
  },

  content_scripts: [
    {
      matches: [
        "https://leetcode.com/problems/*"
      ],

      js: [
        "src/content/content.ts"
      ]
    }
  ],

  icons: {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
};

export default manifest;
import { APP_NAME } from "./brand";

/**
 * Donation links. Leave a value empty to hide that option everywhere.
 *
 * Before publishing:
 * - Turn on GitHub Sponsors for your account (github.com/sponsors), or the
 *   link below shows a 404.
 * - Put your UPI ID (e.g. "name@okaxis") and the payee name your UPI app
 *   shows, so the QR code and copy button appear for Indian users.
 */
export const SUPPORT = {
  githubSponsorsUrl: "https://github.com/sponsors/AnantDuhan",
  upiId: "",
  upiPayeeName: "",
} as const;

export function hasSupportLinks(): boolean {
  return Boolean(SUPPORT.githubSponsorsUrl || SUPPORT.upiId);
}

/** Standard UPI deep link; scanning its QR opens any UPI app with the payee filled in. */
export function upiLink(): string | null {
  if (!SUPPORT.upiId) return null;
  // Not URLSearchParams: it writes spaces as "+", which some UPI apps show
  // literally. The ID keeps its "@" unescaped, as UPI QR codes usually do.
  const parts = [`pa=${SUPPORT.upiId}`];
  if (SUPPORT.upiPayeeName) parts.push(`pn=${encodeURIComponent(SUPPORT.upiPayeeName)}`);
  parts.push("cu=INR", `tn=${encodeURIComponent(`Support ${APP_NAME}`)}`);
  return `upi://pay?${parts.join("&")}`;
}

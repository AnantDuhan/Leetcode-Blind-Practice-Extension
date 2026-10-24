import { useMemo, useState } from "react";
import { APP_NAME } from "../shared/brand";
import qrcode from "qrcode-generator";
import { SUPPORT, hasSupportLinks, upiLink } from "../shared/support";

/** QR code drawn as SVG rects, so no HTML injection and it scales crisply. */
function QrCode({ text, label }: { text: string; label: string }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    const dark: [number, number][] = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) dark.push([r, c]);
    return { size, dark };
  }, [text]);
  const quiet = 4;
  const total = cells.size + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      className="h-40 w-40 rounded-lg"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#ffffff" />
      {cells.dark.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#0f172a" />
      ))}
    </svg>
  );
}

export default function SupportCard({ highlight }: { highlight: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!hasSupportLinks()) return null;
  const upi = upiLink();

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="support"
      className={`rounded-2xl border p-5 transition-colors ${
        highlight ? "border-violet-400 bg-violet-950/40" : "border-slate-800 bg-slate-900"
      }`}
    >
      <h2 className="text-base font-semibold">Support this project</h2>
      <p className="mt-1 max-w-prose text-sm text-slate-400">
        {APP_NAME} is free, has no ads and never collects your data. If it's helping your practice,
        you can chip in to keep it maintained when LeetCode changes things.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        {SUPPORT.githubSponsorsUrl && (
          <div>
            <a
              href={SUPPORT.githubSponsorsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
            >
              <span aria-hidden="true">♥</span> Sponsor on GitHub
            </a>
            <p className="mt-2 text-xs text-slate-500">Cards, worldwide. One-time or monthly.</p>
          </div>
        )}

        {upi && (
          <div className="flex items-start gap-4">
            <QrCode text={upi} label={`UPI QR code for ${SUPPORT.upiId}`} />
            <div className="text-sm">
              <p className="font-semibold">Pay with UPI</p>
              <p className="mt-1 text-xs text-slate-400">Scan with any UPI app, or copy the ID.</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="rounded bg-slate-800 px-2 py-1 text-xs">{SUPPORT.upiId}</code>
                <button
                  onClick={copyUpi}
                  className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Renders assets/icon.svg and assets/icon-small.svg to the PNG sizes Chrome
// uses. Only needed after editing either SVG:
//
//   npm install --no-save @resvg/resvg-js
//   node scripts/render-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";

let Resvg;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  console.error("Missing @resvg/resvg-js. Run: npm install --no-save @resvg/resvg-js");
  process.exit(1);
}

const root = new URL("..", import.meta.url);
const large = readFileSync(new URL("assets/icon.svg", root), "utf8");
const small = readFileSync(new URL("assets/icon-small.svg", root), "utf8");

// The bracket detail turns to noise below 48 px, so small sizes use a simpler mark.
const sizes = [
  [16, small],
  [32, small],
  [48, large],
  [128, large],
];

for (const [size, svg] of sizes) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(new URL(`public/icon${size}.png`, root), png);
  console.log(`public/icon${size}.png`);
}

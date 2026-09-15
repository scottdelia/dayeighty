import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

/* ===========================================================================
   OPEN GRAPH CARD

   This is the first thing anyone sees, and it arrives before they click. It
   is drawn from the same tokens as the page and reprints the page's own
   headline, so the card and the page read as one artifact rather than two.

   Run: npm run og
   =========================================================================== */

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png');

// Same values as tailwind.config.ts. Duplicated deliberately: this script does
// not import the app, so it stays runnable with the app in any state.
const PAPER = '#F5F2EC';
const SURFACE = '#FFFFFF';
const LINE = '#E4DFD5';
const LINE_STRONG = '#CFC8BB';
const INK = '#151517';
const BODY = '#3F3F46';
const MUTED = '#77777F';
const BLOCK = '#B42318';
const BLOCK_WASH = '#FEF3F2';
const BLOCK_EDGE = '#FDA29B';
const DAYEXT = '#F7E37A';
const NIGHTEXT = '#A5D8B0';
const NIGHTINT = '#A9C4EA';
const LOST = '#F4A69C';

// The display face is self-hosted in the app; the card renders with the
// serif the build machine has, which is close enough at 1200 pixels wide.
// Attribute values below are double-quoted, so family names use single quotes.
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Inter, Helvetica, Arial, sans-serif";

/** One stripboard column: a header and a few strips. */
function column(x, label, strips) {
  let y = 452;
  const out = [
    `<rect x="${x}" y="426" width="150" height="150" rx="8" fill="${SURFACE}" stroke="${LINE}"/>`,
    `<text x="${x + 12}" y="444" font-family="${SANS}" font-size="12" font-weight="600" fill="${INK}">${label}</text>`,
  ];
  for (const [fill, stroke, h, text] of strips) {
    out.push(`<rect x="${x + 10}" y="${y}" width="130" height="${h}" rx="4" fill="${fill}" stroke="${stroke}"/>`);
    out.push(`<text x="${x + 18}" y="${y + 15}" font-family="${SANS}" font-size="11" fill="${INK}">${text}</text>`);
    y += h + 6;
  }
  return out.join('');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  <!-- the track: a miniature stripboard of the whole season -->
  <g transform="translate(72, 56)">
    ${Array.from({ length: 100 }, (_, i) => {
      const fill = i < 21 ? LINE : i === 66 ? LOST : i % 13 < 6 ? SURFACE : i % 13 < 10 ? DAYEXT : NIGHTINT;
      const stroke = fill === SURFACE ? LINE_STRONG : 'none';
      return `<rect x="${i * 10.56}" y="0" width="9.6" height="10" rx="1" fill="${fill}" stroke="${stroke}"/>`;
    }).join('')}
    <circle cx="${66 * 10.56 + 5}" cy="5" r="9" fill="${INK}" stroke="${PAPER}" stroke-width="3"/>
  </g>

  <text x="72" y="118" font-family="${SERIF}" font-size="26" font-weight="600" fill="${INK}">Day Eighty</text>
  <rect x="230" y="100" width="1" height="22" fill="${LINE_STRONG}"/>
  <text x="246" y="118" font-family="${SANS}" font-size="15" fill="${MUTED}">Far Bank (w/t) · an invented production · 79 days, no day 80</text>

  <text x="72" y="222" font-family="${SERIF}" font-size="58" fill="${INK}">Tomorrow is a washout.</text>
  <text x="72" y="290" font-family="${SERIF}" font-size="58" fill="${INK}">The call sheet goes out at eight.</text>

  <text x="72" y="344" font-family="${SANS}" font-size="21" fill="${BODY}">Day 46 of 79, 6:10 PM. Six things a producer can do tonight, priced against the</text>
  <text x="72" y="376" font-family="${SANS}" font-size="21" fill="${BODY}">contracts and the permit. One of them it will not price. An invented production; real conventions.</text>

  ${column(72, 'Day 47 · lost', [[LOST, BLOCK_EDGE, 34, '61 · EXT. FORD · DAWN'], [LOST, BLOCK_EDGE, 44, '62 · EXT. FORD · DAY'], [LOST, BLOCK_EDGE, 26, '63 · FAR BANK']])}
  ${column(236, 'Day 47 · revised', [[SURFACE, LINE_STRONG, 36, '101 · FOREST HOUSE'], [SURFACE, LINE_STRONG, 28, '102 · FOREST HOUSE'], [NIGHTINT, '#B7D1D7', 30, '103 · FOREST HOUSE (N)']])}
  ${column(400, 'Day 48', [[DAYEXT, '#FEC84B', 40, '65 · EXT. FORD'], [DAYEXT, '#FEC84B', 36, '66 · FAR BANK'], [DAYEXT, '#FEC84B', 26, '61 · DAWN  ← 47']])}
  ${column(564, 'Day 49', [[DAYEXT, '#FEC84B', 40, '67 · EXT. FORD'], [DAYEXT, '#FEC84B', 40, '68 · EXT. FORD'], [DAYEXT, '#FEC84B', 22, '64 · DUSK  ← 47']])}

  <g transform="translate(760, 426)">
    <rect width="368" height="150" rx="8" fill="${BLOCK_WASH}" stroke="${BLOCK_EDGE}"/>
    <text x="20" y="34" font-family="${SANS}" font-size="12" font-weight="600" letter-spacing="1" fill="${BLOCK}">OPTION 6 · NOT FEASIBLE</text>
    <text x="20" y="72" font-family="${SERIF}" font-size="28" fill="${INK}">There is no Day 80.</text>
    <text x="20" y="100" font-family="${SANS}" font-size="14" fill="${BODY}">Cast contracts, crew deal memos, the stage lease and</text>
    <text x="20" y="120" font-family="${SANS}" font-size="14" fill="${BODY}">every permit end on Day 79. The engine will not price one.</text>
  </g>

  <text x="72" y="606" font-family="${SANS}" font-size="13" letter-spacing="1.2" fill="${MUTED}">SYNTHETIC PRODUCTION · REAL CONSTRAINTS · RUNS OFFLINE</text>
  <text x="1128" y="606" text-anchor="end" font-family="${SANS}" font-size="13" fill="${MUTED}">${NIGHTEXT ? 'The model reads the page. The rules move the strips.' : ''}</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${(png.length / 1024).toFixed(1)} kB)`);

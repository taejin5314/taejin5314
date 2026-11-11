// Draws assets/agent-skyline.svg: every change my coding agent merged to main, one block per merge, one column per day.
// Usage: node scripts/agent-skyline.mjs <path to a clone of taejin5314/claude-codex-loop-engineering>
// The data is the public git history of that repository; nothing else is read.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.argv[2];
if (!repo) throw new Error('pass the path to a clone of claude-codex-loop-engineering');
const log = execFileSync('git', ['-C', repo, 'log', 'origin/main', '--merges', '--reverse', '--date=short', '--format=%ad\t%s'], { encoding: 'utf8', maxBuffer: 1 << 27 });

const DAY = 864e5;
const byDay = new Map();
let agent = 0, human = 0;
for (const line of log.split('\n')) {
  const [date, subject = ''] = line.split('\t');
  if (/^Merge loop (TASK|LOOP)-/.test(subject)) {
    agent++;
    byDay.set(date, (byDay.get(date) || 0) + 1);
  } else if (/^Merge pull request/.test(subject)) human++;
}
if (!agent) throw new Error('no loop merges found in ' + repo);

const days = [...byDay.keys()].sort();
const first = Date.parse(days[0]), last = Date.parse(days[days.length - 1]);
const span = Math.round((last - first) / DAY) + 1;
const best = Math.max(...byDay.values());
const week = [...byDay].filter(([d]) => Date.now() - Date.parse(d) < 7 * DAY).reduce((sum, [, n]) => sum + n, 0);
const share = Math.round((agent / (agent + human)) * 100);

const W = 960, H = 430, LEFT = 40, RIGHT = 920, BASE = 372, TOP = 150;
const colW = (RIGHT - LEFT) / span;
const blockW = Math.max(1.5, (colW - 2.4) / 2);
const pitch = Math.min(5.2, (BASE - TOP) / Math.ceil(best / 2));
const blockH = pitch * 0.78;
const WEEK = ['#ffd98a', '#ff8f66', '#86f0b4', '#7fd4ff', '#b79bff', '#ff7fb8', '#6fe3e0', '#f3a0ff'];
const RAIN = 4.5; // seconds for every block to land
const fmt = (n) => n.toLocaleString('en');
const label = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const r = (n) => Math.round(n * 10) / 10;

let placed = 0, columns = '';
for (let d = 0; d < span; d++) {
  const date = new Date(first + d * DAY).toISOString().slice(0, 10);
  const n = byDay.get(date) || 0;
  if (!n) continue;
  const x = LEFT + d * colW;
  let rects = '';
  for (let k = 0; k < n; k++) {
    const delay = r((placed++ / agent) * RAIN * 100) / 100;
    rects += `<rect x="${r(x + (k % 2) * (blockW + 1.2))}" y="${r(BASE - (Math.floor(k / 2) + 1) * pitch)}" width="${r(blockW)}" height="${r(blockH)}" style="animation-delay:${delay}s"/>`;
  }
  columns += `<g fill="${WEEK[Math.floor(d / 7) % WEEK.length]}"><title>${date}: ${n} merged</title>${rects}</g>\n`;
}

const ticks = [first];
for (let t = new Date(first); t.getTime() <= last; t.setUTCDate(t.getUTCDate() + 1)) if (t.getUTCDate() === 1) ticks.push(t.getTime());
if (last - ticks[ticks.length - 1] > 6 * DAY) ticks.push(last);
const tickMarks = ticks
  .map((ms) => {
    const x = r(LEFT + Math.round((ms - first) / DAY) * colW);
    return `<text x="${x}" y="${BASE + 22}" class="dim">${label(ms)}</text><rect x="${x}" y="${BASE + 4}" width="1" height="5" fill="#8f7a9c"/>`;
  })
  .join('');

const stat = (x, value, text) => `<text x="${x}" y="62" class="num">${value}</text><text x="${x}" y="84" class="dim">${text}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${fmt(agent)} changes merged to main by my coding agent between ${label(first)} and ${label(last)}, drawn as one block per merge and one column per day.">
<defs>
  <radialGradient id="bg" cx="38%" cy="42%" r="85%"><stop offset="0" stop-color="#2b1031"/><stop offset="0.5" stop-color="#170a1c"/><stop offset="1" stop-color="#0a040d"/></radialGradient>
  <style>
    text { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; }
    .head { font: 700 25px -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; fill: #f6ecfa; }
    .sub { font-size: 13px; fill: #c9b6d6; }
    .dim { font-size: 12px; fill: #9a86a8; }
    .num { font-size: 27px; font-weight: 700; fill: #ffe2a8; }
    .sky rect { animation: land 0.55s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
    .scan { animation: scan ${RAIN}s linear both; }
    @keyframes land { from { opacity: 0; transform: translateY(-26px); } 60% { opacity: 1; } to { opacity: 0.92; transform: none; } }
    @keyframes scan { from { transform: translateX(0); opacity: 0.9; } 92% { opacity: 0.9; } to { transform: translateX(${RIGHT - LEFT}px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .sky rect, .scan { animation: none; } .scan { opacity: 0; } }
  </style>
</defs>
<rect width="${W}" height="${H}" rx="16" fill="url(#bg)"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="#4a2c56"/>
<text x="${LEFT}" y="46" class="dim">Creator Assist, from the git history of main</text>
<text x="${LEFT}" y="80" class="head">${fmt(agent)} changes merged by my coding agent</text>
<text x="${LEFT}" y="104" class="sub">Each block is one change it planned, wrote, checked, had reviewed and merged on its own.</text>
${stat(590, share + '%', 'of merges to main')}
${stat(745, fmt(best), 'best day')}
${stat(838, fmt(week), 'last 7 days')}
<g class="sky">
${columns}</g>
<rect x="${LEFT}" y="${BASE + 1}" width="${RIGHT - LEFT}" height="1" fill="#6d5479"/>
<rect class="scan" x="${LEFT}" y="${TOP - 10}" width="2" height="${BASE - TOP + 10}" fill="#ffe2a8"/>
${tickMarks}
<text x="${RIGHT}" y="${H - 16}" text-anchor="end" class="dim">${label(first)} to ${label(last)} ${new Date(last).getUTCFullYear()}, one column per day. Redrawn daily from the repository.</text>
</svg>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'agent-skyline.svg');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(JSON.stringify({ agent, human, share, span, activeDays: days.length, best, week, bytes: svg.length }));

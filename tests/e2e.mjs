// End-to-end checks for Pair Pals Memory: layout on iPhone/iPad sizes, game rules, and saved games.
// Run with `npm test` (needs `npm install` once for Playwright's Chromium).
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_URL = 'file://' + path.join(root, 'index.html');

const DEVICES = [
  ['iPhone SE', 375, 667],
  ['iPhone 15', 393, 852],
  ['iPhone 15 Pro Max', 430, 932],
  ['iPad mini', 744, 1133],
  ['iPad Air', 820, 1180],
  ['iPad Pro 12.9"', 1024, 1366],
];
const SETUPS = [
  { playerCount: 2, count: 16 },
  { playerCount: 4, count: 24 },
  { playerCount: 6, count: 48 },
];

let failures = 0;
let checks = 0;
function check(ok, msg) {
  checks++;
  if (!ok) {
    failures++;
    console.log(`  ✗ ${msg}`);
  }
}

function settingsFor(over = {}) {
  return {
    playerCount: 2,
    players: [],
    set: 'animals',
    count: 16,
    customText: '',
    again: true,
    peek: false,
    sound: false,
    lastFirst: -1,
    ...over,
  };
}

async function open(browser, { w = 393, h = 852, scheme = 'dark', settings = settingsFor() } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(s => {
    try {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.clear();
        localStorage.setItem('pairpals.settings.v1', JSON.stringify(s));
        sessionStorage.setItem('seeded', '1');
      }
    } catch (e) { /* ignore */ }
  }, settings);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => window.PairPals && window.PairPals.game);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

const keys = page => page.evaluate(() => window.PairPals.game.cards.map(c => (c.s === 2 ? -1 : c.k)));
const idle = page => page.waitForFunction(() => ['idle', 'over'].includes(window.PairPals.phase), null, { timeout: 5000 });

async function tap(page, i) {
  await page.locator('.card').nth(i).click();
}
async function playMatch(page) {
  const k = await keys(page);
  const a = k.findIndex(x => x >= 0);
  const b = k.findIndex((x, j) => j !== a && x === k[a]);
  await tap(page, a);
  await tap(page, b);
  await page.waitForTimeout(650);
  await idle(page);
}
async function playMiss(page) {
  const k = await keys(page);
  const a = k.findIndex(x => x >= 0);
  const b = k.findIndex(x => x >= 0 && x !== k[a]);
  await tap(page, a);
  await tap(page, b);
  await page.waitForFunction(() => window.PairPals.phase === 'miss');
  // A tap on the table outside the cards flips a missed pair back early.
  await page.locator('#table').click({ position: { x: 5, y: 60 } });
  await idle(page);
}
const state = page => page.evaluate(() => {
  const g = window.PairPals.game;
  return { turn: g.turn, scores: g.scores.slice(), moves: g.moves, done: g.done, matched: g.cards.filter(c => c.s === 2).length };
});

async function layoutChecks(browser) {
  console.log('Layout');
  for (const [name, W, H] of DEVICES) {
    for (const [w, h, orient] of [[W, H, 'portrait'], [H, W, 'landscape']]) {
      for (const s of SETUPS) {
        const label = `${name} ${orient} ${s.playerCount}p/${s.count}`;
        const { ctx, page, errors } = await open(browser, { w, h, settings: settingsFor(s) });
        const m = await page.evaluate(() => {
          const r = el => el.getBoundingClientRect();
          const table = r(document.getElementById('table'));
          const cards = [...document.querySelectorAll('.card')].map(r);
          const chips = [...document.querySelectorAll('.player')].map(r);
          const ctrls = [...document.querySelectorAll('.brand, .actions, .status')].map(r);
          return {
            sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
            iw: innerWidth, ih: innerHeight, table, cards, chips, ctrls,
            playersBox: r(document.getElementById('players')),
            playersScroll: document.getElementById('players').scrollHeight - document.getElementById('players').clientHeight,
          };
        });
        check(m.sw <= m.iw && m.sh <= m.ih, `${label}: page scrolls (${m.sw}x${m.sh} in ${m.iw}x${m.ih})`);
        const inside = (a, b, t = 1) => a.left >= b.left - t && a.right <= b.right + t && a.top >= b.top - t && a.bottom <= b.bottom + t;
        const view = { left: 0, top: 0, right: m.iw, bottom: m.ih };
        check(m.cards.length === s.count, `${label}: ${m.cards.length} cards dealt`);
        check(m.cards.every(c => inside(c, m.table, 2)), `${label}: a card spills outside the table`);
        const minSide = Math.min(...m.cards.map(c => Math.min(c.width, c.height)));
        check(minSide >= 40, `${label}: smallest card is ${minSide.toFixed(1)}px`);
        check(m.chips.every(c => inside(c, view)), `${label}: a score chip is off screen`);
        check(m.ctrls.every(c => inside(c, view)), `${label}: header or status is off screen`);
        check(m.playersScroll <= 1 || orient === 'landscape', `${label}: scoreboard needs scrolling`);
        check(errors.length === 0, `${label}: errors ${errors.join(' | ')}`);
        await ctx.close();
      }
    }
  }
}

async function ruleChecks(browser) {
  console.log('Rules');
  {
    const { ctx, page, errors } = await open(browser, { settings: settingsFor({ playerCount: 3, count: 12 }) });
    let s = await state(page);
    check(s.turn === 0, `3p: first turn should be seat 0, got ${s.turn}`);
    await playMiss(page);
    s = await state(page);
    check(s.turn === 1 && s.scores.join() === '0,0,0', `3p: miss passes the turn (turn ${s.turn}, scores ${s.scores})`);
    await playMatch(page);
    s = await state(page);
    check(s.turn === 1 && s.scores.join() === '0,1,0', `3p: match keeps the turn (turn ${s.turn}, scores ${s.scores})`);
    await playMiss(page);
    s = await state(page);
    check(s.turn === 2, `3p: second miss moves to seat 2 (turn ${s.turn})`);
    for (let i = 0; i < 5; i++) await playMatch(page);
    await page.waitForTimeout(1200);
    s = await state(page);
    check(s.done && s.scores.join() === '0,1,5' && s.matched === 12, `3p: game over with scores 0,1,5 (got ${s.scores}, done ${s.done})`);
    const title = await page.textContent('#results-title');
    check(await page.evaluate(() => document.getElementById('results').open), '3p: results dialog opens');
    check(title.includes('Player 3 wins'), `3p: results title "${title}"`);
    const chip = await page.locator('.player').nth(2).getAttribute('aria-label');
    check(chip.includes('5 pairs'), `3p: chip label "${chip}"`);
    const ranks = await page.locator('.rank .rank-name').allTextContents();
    check(ranks.join() === 'Player 3,Player 2,Player 1', `3p: ranking order ${ranks}`);
    check(errors.length === 0, `3p: errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { settings: settingsFor({ playerCount: 2, count: 8, again: false }) });
    await playMatch(page);
    await page.waitForTimeout(700);
    const s = await state(page);
    check(s.turn === 1 && s.scores.join() === '1,0', `no-again rule: match passes the turn (turn ${s.turn}, scores ${s.scores})`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { settings: settingsFor({ playerCount: 2, count: 8 }) });
    for (let i = 0; i < 2; i++) await playMatch(page);
    await playMiss(page);
    for (let i = 0; i < 2; i++) await playMatch(page);
    await page.waitForTimeout(1200);
    const title = await page.textContent('#results-title');
    check(title.includes('tie'), `tie: results title "${title}"`);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(browser, { settings: settingsFor({ playerCount: 1, count: 8 }) });
    await playMiss(page);
    for (let i = 0; i < 4; i++) await playMatch(page);
    await page.waitForTimeout(1200);
    const s = await state(page);
    check(s.done && s.moves === 5, `solo: 5 moves recorded (got ${s.moves})`);
    const title = await page.textContent('#results-title');
    check(title === 'All pairs found!', `solo: results title "${title}"`);
    check(!(await page.isHidden('#res-best')), 'solo: best score note shows');
    check(errors.length === 0, `solo: errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open(browser, { settings: settingsFor({ playerCount: 2, count: 16 }) });
    const k = await keys(page);
    const a = 0;
    const b = k.findIndex(x => x !== k[0]);
    await tap(page, a);
    await tap(page, b);
    await page.waitForFunction(() => window.PairPals.phase === 'miss');
    await page.evaluate(() => window.PairPals.newGame());
    await page.waitForTimeout(2200);
    const s = await state(page);
    const up = await page.locator('.card.is-up').count();
    check(up === 0 && s.scores.join() === '0,0' && s.moves === 0, `new game during a miss leaves no stale flips (up ${up}, moves ${s.moves})`);
    check(errors.length === 0, `new game mid-miss: errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { settings: settingsFor({ playerCount: 2, count: 12 }) });
    await page.evaluate(() => window.PairPals.newGame());
    await playMatch(page);
    await playMiss(page);
    const before = await state(page);
    await page.reload();
    await page.waitForFunction(() => window.PairPals && window.PairPals.game);
    const after = await state(page);
    check(JSON.stringify(before) === JSON.stringify(after), `reload restores the game (${JSON.stringify(before)} vs ${JSON.stringify(after)})`);
    await ctx.close();
  }
  {
    const custom = '🦖🍕🎈 🧑‍🚀 Mum Dad A';
    const { ctx, page } = await open(browser, { settings: settingsFor({ set: 'custom', customText: custom, count: 20 }) });
    const items = await page.evaluate(() => window.PairPals.game.items.map(i => i.v));
    const mine = ['🦖', '🍕', '🎈', '🧑‍🚀', 'Mum', 'Dad', 'A'];
    check(mine.every(x => items.includes(x)) && new Set(items).size === 10, `custom pictures used and topped up from Mix (${items.join(' ')})`);
    await ctx.close();
  }
}

const browser = await chromium.launch();
try {
  await ruleChecks(browser);
  await layoutChecks(browser);
} finally {
  await browser.close();
}
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);

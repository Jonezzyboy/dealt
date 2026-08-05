'use strict';

/* ============================================================
   Deterministic daily deal
   The dealer's hand is built first and the spread is dealt
   around it, so every deal is guaranteed honest.
   ============================================================ */

function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- cards ---------- */

// Suit order settles ties: spades first, clubs last.
const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function card(r, s) { return { r, s }; }
function cardKey(c) { return c.r + '-' + c.s; }
function rankLabel(r) { return RANK_LABEL[r] || String(r); }

function freshDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 2; r <= 14; r++) deck.push(card(r, s));
  }
  return deck;
}

function byRank(a, b) { return b.r - a.r || a.s - b.s; }

/* ---------- hand evaluation ---------- */

const CAT = {
  HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
  FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8,
};

const CAT_NAME = [
  'high card', 'a pair', 'two pair', 'three of a kind', 'a straight',
  'a flush', 'a full house', 'four of a kind', 'a straight flush',
];

// Returns the hand's category, spoken name, and canonical arrangement:
// the cards that make the rank first, then the spares, highest first,
// with equal ranks settled by suit. This is the order the dealer holds.
function evaluateHand(cards) {
  const sorted = cards.slice().sort(byRank);
  const isFlush = cards.every((c) => c.s === cards[0].s);
  const ranks = sorted.map((c) => c.r);
  const distinct = new Set(ranks).size === 5;

  let straightHigh = 0;
  if (distinct) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2) straightHigh = 5;
  }

  if (straightHigh) {
    // The wheel reads 5-4-3-2-A: the ace plays low, so it sits last.
    const arranged = straightHigh === 5 ? sorted.slice(1).concat(sorted[0]) : sorted;
    if (isFlush) {
      const name = straightHigh === 14 ? 'a royal flush' : 'a straight flush';
      return { cat: CAT.STRAIGHT_FLUSH, name, arranged };
    }
    return { cat: CAT.STRAIGHT, name: CAT_NAME[CAT.STRAIGHT], arranged };
  }

  if (isFlush) return { cat: CAT.FLUSH, name: CAT_NAME[CAT.FLUSH], arranged: sorted };

  const groups = [];
  for (const c of sorted) {
    const g = groups.find((x) => x[0].r === c.r);
    if (g) g.push(c); else groups.push([c]);
  }
  groups.sort((a, b) => b.length - a.length || b[0].r - a[0].r);
  const arranged = groups.flat();

  const shape = groups.map((g) => g.length).join('');
  const cat = { '41': CAT.QUADS, '32': CAT.FULL_HOUSE, '311': CAT.TRIPS,
    '221': CAT.TWO_PAIR, '2111': CAT.PAIR, '11111': CAT.HIGH }[shape];
  return { cat, name: CAT_NAME[cat], arranged };
}

/* ---------- building the dealer's hand ---------- */

function pickRanks(n, rng) {
  const pool = [];
  for (let r = 2; r <= 14; r++) pool.push(r);
  return shuffle(pool, rng).slice(0, n);
}

function pickSuits(n, rng) {
  return shuffle([0, 1, 2, 3], rng).slice(0, n);
}

function straightRanks(high) {
  if (high === 5) return [5, 4, 3, 2, 14];
  return [high, high - 1, high - 2, high - 3, high - 4];
}

function buildHand(cat, rng) {
  const anySuit = (r) => card(r, Math.floor(rng() * 4));
  switch (cat) {
    case CAT.PAIR: {
      const [p, k1, k2, k3] = pickRanks(4, rng);
      const [s1, s2] = pickSuits(2, rng);
      return [card(p, s1), card(p, s2), anySuit(k1), anySuit(k2), anySuit(k3)];
    }
    case CAT.TWO_PAIR: {
      const [a, b, k] = pickRanks(3, rng);
      const [s1, s2] = pickSuits(2, rng);
      const [s3, s4] = pickSuits(2, rng);
      return [card(a, s1), card(a, s2), card(b, s3), card(b, s4), anySuit(k)];
    }
    case CAT.TRIPS: {
      const [t, k1, k2] = pickRanks(3, rng);
      const [s1, s2, s3] = pickSuits(3, rng);
      return [card(t, s1), card(t, s2), card(t, s3), anySuit(k1), anySuit(k2)];
    }
    case CAT.STRAIGHT: {
      const high = 5 + Math.floor(rng() * 10);
      return straightRanks(high).map(anySuit);
    }
    case CAT.FLUSH: {
      const s = Math.floor(rng() * 4);
      return pickRanks(5, rng).map((r) => card(r, s));
    }
    case CAT.FULL_HOUSE: {
      const [a, b] = pickRanks(2, rng);
      const [s1, s2, s3] = pickSuits(3, rng);
      const [s4, s5] = pickSuits(2, rng);
      return [card(a, s1), card(a, s2), card(a, s3), card(b, s4), card(b, s5)];
    }
    case CAT.QUADS: {
      const [q, k] = pickRanks(2, rng);
      return [card(q, 0), card(q, 1), card(q, 2), card(q, 3), anySuit(k)];
    }
    case CAT.STRAIGHT_FLUSH: {
      const s = Math.floor(rng() * 4);
      const high = 5 + Math.floor(rng() * 10);
      return straightRanks(high).map((r) => card(r, s));
    }
  }
}

/* ---------- the spread ---------- */

const SPREAD_SIZE = 12;
const GUESSES = 4;

// Decoys lean toward cards that rhyme with the hand — matching ranks,
// the hand's dominant suit, neighbouring ranks — so near-miss hands
// appear on the table.
function pickDecoys(hand, rng) {
  const used = new Set(hand.map(cardKey));
  const pool = freshDeck().filter((c) => !used.has(cardKey(c)));
  const handRanks = new Set(hand.map((c) => c.r));
  const suitCounts = [0, 0, 0, 0];
  for (const c of hand) suitCounts[c.s]++;
  const dominant = suitCounts.indexOf(Math.max(...suitCounts));
  const nearRank = (r) => hand.some((c) => Math.abs(c.r - r) === 1);
  const weight = (c) => 1
    + (handRanks.has(c.r) ? 3 : 0)
    + (c.s === dominant ? 2 : 0)
    + (nearRank(c.r) ? 2 : 0);

  const decoys = [];
  while (decoys.length < SPREAD_SIZE - hand.length) {
    let total = 0;
    for (const c of pool) total += weight(c);
    let roll = rng() * total;
    let idx = 0;
    while (idx < pool.length - 1 && (roll -= weight(pool[idx])) > 0) idx++;
    decoys.push(pool.splice(idx, 1)[0]);
  }
  return decoys;
}

// How many five-card pickings from the spread rank exactly as `cat`.
function countCategory(spread, cat) {
  let n = 0;
  for (let a = 0; a < spread.length - 4; a++)
    for (let b = a + 1; b < spread.length - 3; b++)
      for (let c = b + 1; c < spread.length - 2; c++)
        for (let d = c + 1; d < spread.length - 1; d++)
          for (let e = d + 1; e < spread.length; e++) {
            if (evaluateHand([spread[a], spread[b], spread[c], spread[d], spread[e]]).cat === cat) n++;
          }
  return n;
}

const DEAL_WEIGHTS = [
  [CAT.PAIR, 20], [CAT.TWO_PAIR, 18], [CAT.TRIPS, 15], [CAT.STRAIGHT, 15],
  [CAT.FLUSH, 13], [CAT.FULL_HOUSE, 11], [CAT.QUADS, 5], [CAT.STRAIGHT_FLUSH, 3],
];

function generateDeal(dayIndex) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const rng = mulberry32(((dayIndex + 1) * 2654435761) ^ (attempt * 40503 + 17));
    let roll = rng() * 100;
    let cat = CAT.PAIR;
    for (const [c, w] of DEAL_WEIGHTS) {
      if ((roll -= w) <= 0) { cat = c; break; }
    }
    const hand = buildHand(cat, rng);
    const ev = evaluateHand(hand);
    // Random suits occasionally promote the hand (a straight lands
    // suited, a flush lands consecutive) — deal again if so.
    if (ev.cat !== cat) continue;
    const spread = shuffle(hand.concat(pickDecoys(hand, rng)), rng);
    // Announcing a straight or better must not hand over the answer:
    // the table has to hold at least one other hand of the same rank.
    if (cat >= CAT.STRAIGHT && countCategory(spread, cat) < 2) continue;
    return { spread, hand: ev.arranged, cat, name: ev.name };
  }
  throw new Error('No deal could be generated for day ' + dayIndex);
}

/* ---------- tells ---------- */

// Every card is unique, so no double-counting subtleties:
// hit = right card in the right place, near = in the hand elsewhere.
function tells(guess, hand) {
  const held = new Set(hand.map(cardKey));
  return guess.map((c, i) =>
    cardKey(c) === cardKey(hand[i]) ? 'hit' : held.has(cardKey(c)) ? 'near' : 'out');
}

/* ---------- the calendar ---------- */

// Deal No. 1 = 5 August 2026. Flips at local midnight.
const EPOCH = { y: 2026, m: 7, d: 5 };

function todayIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epoch = new Date(EPOCH.y, EPOCH.m, EPOCH.d);
  return Math.max(0, Math.round((start - epoch) / 864e5));
}

function msToMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
}

/* ============================================================
   Commendations
   Earnable badges, judged against a summary of a winning day:
   { wins, streak, guesses, noOut, cat }.
   ============================================================ */

const BADGES = [
  { id: 'ante-up', seal: 'A♠', name: 'Ante Up',
    desc: 'Call your first hand.',
    test: (c) => c.wins >= 1 },
  { id: 'flopped-it', seal: '1st', name: 'Flopped It',
    desc: 'Call the hand on the flop — your very first guess.',
    test: (c) => c.guesses === 1 },
  { id: 'on-the-turn', seal: '2nd', name: 'On the Turn',
    desc: 'Call the hand inside two guesses.',
    test: (c) => c.guesses <= 2 },
  { id: 'slow-play', seal: '4th', name: 'Slow Play',
    desc: 'Call it at the showdown — your very last guess.',
    test: (c) => c.guesses === GUESSES },
  { id: 'poker-face', seal: 'PF', name: 'Poker Face',
    desc: "Win without ever playing a card the dealer wasn't holding.",
    test: (c) => c.noOut },
  { id: 'high-roller', seal: '4K+', name: 'High Roller',
    desc: 'Call a hand of four of a kind or better.',
    test: (c) => c.cat >= CAT.QUADS },
  { id: 'hot-streak', seal: '3d', name: 'Hot Streak',
    desc: 'Call the hand three days running.',
    test: (c) => c.streak >= 3 },
  { id: 'on-a-heater', seal: '7d', name: 'On a Heater',
    desc: 'Call the hand seven days running.',
    test: (c) => c.streak >= 7 },
  { id: 'card-sharp', seal: '30', name: 'Card Sharp',
    desc: 'Call the hand thirty days running.',
    test: (c) => c.streak >= 30 },
  { id: 'the-grinder', seal: '90', name: 'The Grinder',
    desc: 'Call the hand ninety days running.',
    test: (c) => c.streak >= 90 },
  { id: 'the-nuts', seal: '1yr', name: 'The Nuts',
    desc: 'Call the hand a full year running.',
    test: (c) => c.streak >= 365 },
  { id: 'century-chip', seal: '100', name: 'Century Chip',
    desc: 'Call one hundred hands in all.',
    test: (c) => c.wins >= 100 },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateDeal, evaluateHand, buildHand, tells, countCategory,
    mulberry32, freshDeck, card, cardKey, rankLabel,
    CAT, CAT_NAME, SUITS, SPREAD_SIZE, GUESSES, BADGES,
  };
}

/* ============================================================
   The table (browser only)
   ============================================================ */

if (typeof document !== 'undefined') (function () {
  const $ = (sel) => document.querySelector(sel);

  const DAY_KEY = 'dealt-day-v1';
  const STATS_KEY = 'dealt-stats-v1';
  const HISTORY_KEY = 'dealt-history-v1';
  const BADGES_KEY = 'dealt-badges-v1';

  const ROUND_NAME = ['Flop', 'Turn', 'River', 'Showdown'];
  const ROUND_PHRASE = ['on the flop', 'on the turn', 'on the river', 'at the showdown'];

  const today = todayIndex();
  // ?no=N replays past deal N for practice; anything else means today.
  const requested = Number(new URLSearchParams(location.search).get('no')) - 1;
  const archive = Number.isInteger(requested) && requested >= 0 && requested < today;
  const day = archive ? requested : today;
  const deal = generateDeal(day);
  const held = new Set(deal.hand.map(cardKey));

  const state = {
    rows: [],      // submitted calls, each an array of five spread indices
    current: [],   // spread indices placed so far this call
    solved: false,
    gaveUp: false,
  };

  const atIndex = (i) => deal.spread[i];
  const rowCards = (row) => row.map(atIndex);
  const rowTells = (row) => tells(rowCards(row), deal.hand);
  const finished = () => state.solved || state.gaveUp || state.rows.length >= GUESSES;

  /* ---------- persistence ---------- */

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  }

  // Archive days get their own slot so practice never clobbers today's table.
  const SLOT_KEY = archive ? `${DAY_KEY}:${day}` : DAY_KEY;

  function saveDay() {
    localStorage.setItem(SLOT_KEY, JSON.stringify({
      day,
      rows: state.rows,
      current: state.current,
      gaveUp: state.gaveUp,
    }));
  }

  function loadStats() {
    return Object.assign(
      { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: null, lastPlayedDay: null },
      loadJSON(STATS_KEY) || {}
    );
  }

  function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function loadHistory() {
    const h = loadJSON(HISTORY_KEY);
    return Array.isArray(h) ? h : [];
  }

  // Archive plays never touch stats or streaks. A late call is still
  // worth recording, and may close a deal originally left unread.
  function recordArchiveResult(won) {
    if (!won) return;
    const history = loadHistory();
    const existing = history.find((h) => h.day === day);
    if (existing && existing.solved) return;
    if (existing) {
      existing.solved = true;
      existing.guesses = state.rows.length;
      existing.late = true;
    } else {
      history.push({ day, solved: true, guesses: state.rows.length, late: true });
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function recordResult(won) {
    if (archive) return recordArchiveResult(won);
    const stats = loadStats();
    if (stats.lastPlayedDay === day) return;
    stats.played++;
    stats.lastPlayedDay = day;
    if (won) {
      stats.wins++;
      stats.streak = stats.lastWinDay === day - 1 ? stats.streak + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      stats.lastWinDay = day;
    } else {
      stats.streak = 0;
    }
    saveStats(stats);
    const history = loadHistory();
    history.push({ day, solved: won, guesses: won ? state.rows.length : null });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function loadBadges() {
    return loadJSON(BADGES_KEY) || {};
  }

  // Awarded only on a win; idempotent, so replaying a saved win is safe.
  function awardBadges() {
    const stats = loadStats();
    const ctx = {
      wins: stats.wins,
      streak: stats.streak,
      guesses: state.rows.length,
      noOut: state.rows.flat().every((i) => held.has(cardKey(atIndex(i)))),
      cat: deal.cat,
    };
    const earned = loadBadges();
    const fresh = [];
    for (const b of BADGES) {
      if (!(b.id in earned) && b.test(ctx)) {
        earned[b.id] = day;
        fresh.push(b);
      }
    }
    if (fresh.length) {
      localStorage.setItem(BADGES_KEY, JSON.stringify(earned));
      fresh.forEach(queueToast);
    }
  }

  /* ---------- toasts ---------- */

  const toastQueue = [];
  let toastShowing = false;

  function queueToast(badge) {
    toastQueue.push(badge);
    if (!toastShowing) nextToast();
  }

  function nextToast() {
    const b = toastQueue.shift();
    if (!b) { toastShowing = false; return; }
    toastShowing = true;
    const el = document.createElement('div');
    el.className = 'toast';
    const seal = document.createElement('span');
    seal.className = 'seal';
    seal.textContent = b.seal;
    const text = document.createElement('span');
    text.className = 'toast-text';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'toast-eyebrow';
    eyebrow.textContent = 'Commendation earned';
    const name = document.createElement('span');
    name.className = 'toast-name';
    name.textContent = b.name;
    text.append(eyebrow, name);
    el.append(seal, text);
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.remove(); nextToast(); }, 300);
    }, 3800);
  }

  /* ---------- moves ---------- */

  function onSpread(i) {
    if (finished()) return;
    const at = state.current.indexOf(i);
    if (at !== -1) {
      state.current.splice(at, 1);
    } else if (state.current.length < 5) {
      state.current.push(i);
    } else {
      return note('Five cards make a hand — take one back first.');
    }
    saveDay();
    renderAll();
  }

  function onSlot(pos) {
    if (finished() || pos >= state.current.length) return;
    state.current.splice(pos, 1);
    saveDay();
    renderAll();
  }

  function takeBack() {
    if (finished() || state.current.length === 0) return;
    state.current.pop();
    saveDay();
    renderAll();
  }

  function clearRow() {
    if (finished() || state.current.length === 0) return;
    state.current = [];
    saveDay();
    renderAll();
  }

  function submit() {
    if (finished()) return;
    if (state.current.length < 5) {
      const short = 5 - state.current.length;
      return note(`Five cards to call a hand — ${short} more to place.`);
    }
    state.rows.push(state.current.slice());
    state.current = [];
    const t = rowTells(state.rows[state.rows.length - 1]);
    if (t.every((x) => x === 'hit')) {
      win(true);
    } else if (state.rows.length >= GUESSES) {
      recordResult(false);
    }
    saveDay();
    renderAll();
  }

  function win(animate) {
    state.solved = true;
    recordResult(true);
    if (!archive) awardBadges();
    const stamp = $('#stamp');
    stamp.hidden = false;
    if (!animate) stamp.style.animation = 'none';
  }

  let confirmTimer = null;

  function fold() {
    const btn = $('#fold');
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Tap again to fold';
      confirmTimer = setTimeout(() => {
        btn.classList.remove('confirm');
        btn.textContent = 'Fold';
      }, 3500);
      return;
    }
    clearTimeout(confirmTimer);
    state.gaveUp = true;
    state.current = [];
    recordResult(false);
    saveDay();
    renderAll();
  }

  let noteTimer = null;

  function note(msg) {
    const el = $('#note');
    el.textContent = msg;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { el.textContent = ''; }, 2800);
  }

  /* ---------- rendering ---------- */

  function cardFace(c, mini) {
    const el = document.createElement('span');
    el.className = 'cardface' + (c.s === 1 || c.s === 2 ? ' red' : '') + (mini ? ' mini' : '');
    const corner = document.createElement('span');
    corner.className = 'corner';
    const rank = document.createElement('b');
    rank.textContent = rankLabel(c.r);
    const suit = document.createElement('i');
    suit.textContent = SUITS[c.s];
    corner.append(rank, suit);
    const pip = document.createElement('span');
    pip.className = 'pip';
    pip.textContent = SUITS[c.s];
    el.append(corner, pip);
    return el;
  }

  // What each spread card's past tells add up to: in the hand, or not.
  function knowledge() {
    const known = new Map();
    for (const row of state.rows) {
      for (const i of row) {
        known.set(i, held.has(cardKey(atIndex(i))) ? 'in' : 'out');
      }
    }
    return known;
  }

  function renderSpread() {
    const box = $('#spread');
    box.innerHTML = '';
    const known = knowledge();
    for (let i = 0; i < deal.spread.length; i++) {
      const c = atIndex(i);
      const btn = document.createElement('button');
      btn.className = 'card'
        + (state.current.includes(i) ? ' placed' : '')
        + (known.get(i) === 'out' ? ' known-out' : '')
        + (known.get(i) === 'in' ? ' known-in' : '');
      btn.disabled = finished();
      btn.setAttribute('aria-label', `${rankLabel(c.r)} of ${['spades', 'hearts', 'diamonds', 'clubs'][c.s]}`);
      btn.appendChild(cardFace(c));
      btn.addEventListener('click', () => onSpread(i));
      box.appendChild(btn);
    }
  }

  function slotEl(cls) {
    const el = document.createElement('span');
    el.className = 'slot' + (cls ? ' ' + cls : '');
    return el;
  }

  function rowShell(label) {
    const div = document.createElement('div');
    div.className = 'row';
    const tag = document.createElement('span');
    tag.className = 'row-tag';
    tag.textContent = label;
    const slots = document.createElement('span');
    slots.className = 'row-slots';
    div.append(tag, slots);
    return { div, slots };
  }

  function renderRows() {
    const box = $('#rows');
    box.innerHTML = '';

    for (let r = 0; r < GUESSES; r++) {
      if (r < state.rows.length) {
        const row = state.rows[r];
        const t = rowTells(row);
        const { div, slots } = rowShell(ROUND_NAME[r]);
        div.classList.add('locked');
        row.forEach((i, pos) => {
          const s = slotEl(t[pos]);
          s.appendChild(cardFace(atIndex(i)));
          slots.appendChild(s);
        });
        const makes = document.createElement('span');
        makes.className = 'row-makes';
        makes.textContent = t.every((x) => x === 'hit')
          ? "the dealer's hand"
          : `makes ${evaluateHand(rowCards(row)).name}`;
        div.appendChild(makes);
        box.appendChild(div);
      } else if (r === state.rows.length && !finished()) {
        const { div, slots } = rowShell(ROUND_NAME[r]);
        div.classList.add('active');
        for (let pos = 0; pos < 5; pos++) {
          if (pos < state.current.length) {
            const i = state.current[pos];
            const s = slotEl('filled');
            const btn = document.createElement('button');
            btn.className = 'slot-card';
            btn.setAttribute('aria-label', 'Take this card back');
            btn.appendChild(cardFace(atIndex(i)));
            btn.addEventListener('click', () => onSlot(pos));
            s.appendChild(btn);
            slots.appendChild(s);
          } else {
            slots.appendChild(slotEl('empty'));
          }
        }
        box.appendChild(div);
      } else {
        const { div, slots } = rowShell(ROUND_NAME[r]);
        div.classList.add('ahead');
        for (let pos = 0; pos < 5; pos++) slots.appendChild(slotEl('empty'));
        box.appendChild(div);
      }
    }

    if (finished() && !state.solved) {
      const { div, slots } = rowShell('Held');
      div.classList.add('reveal');
      for (const c of deal.hand) {
        const s = slotEl('hit');
        s.appendChild(cardFace(c));
        slots.appendChild(s);
      }
      const makes = document.createElement('span');
      makes.className = 'row-makes';
      makes.textContent = "the dealer's hand";
      div.appendChild(makes);
      box.appendChild(div);
    }
  }

  function renderControls() {
    $('#takeback').disabled = state.current.length === 0 || finished();
    $('#clear').disabled = state.current.length === 0 || finished();
    $('#call').disabled = state.current.length < 5 || finished();
    $('#call').hidden = finished();
    $('#fold').hidden = finished();
  }

  function renderResult() {
    const box = $('#result');
    box.hidden = !finished();
    if (!finished()) return;
    const n = state.rows.length;
    $('#resultText').textContent = state.solved
      ? `Hand called${archive ? ' late' : ''} ${ROUND_PHRASE[n - 1]} — ${deal.name}, read in `
        + `${n} ${n === 1 ? 'call' : 'calls'}.`
      : archive
        ? 'This past deal stays unread.'
        : 'The dealer keeps the pot today. A fresh deal at midnight.';
    const earned = loadBadges();
    const fresh = archive ? [] : BADGES.filter((b) => earned[b.id] === day);
    const nb = $('#newBadges');
    nb.hidden = fresh.length === 0;
    nb.textContent = fresh.length
      ? `New commendation${fresh.length === 1 ? '' : 's'}: ${fresh.map((b) => b.name).join(' · ')}`
      : '';
    $('#share').hidden = !state.solved;
  }

  function renderBadges() {
    const earned = loadBadges();
    $('#badgeCount').textContent = `${Object.keys(earned).length} of ${BADGES.length}`;
    const ul = $('#badgeList');
    ul.innerHTML = '';
    for (const b of BADGES) {
      const got = b.id in earned;
      const li = document.createElement('li');
      li.className = 'badge' + (got ? ' earned' : '')
        + (!archive && earned[b.id] === day ? ' fresh' : '');
      const seal = document.createElement('span');
      seal.className = 'seal';
      seal.textContent = b.seal;
      const name = document.createElement('span');
      name.className = 'badge-name';
      name.textContent = b.name;
      const desc = document.createElement('span');
      desc.className = 'badge-desc';
      desc.textContent = got ? `${b.desc} Earned No. ${earned[b.id] + 1}.` : b.desc;
      const text = document.createElement('span');
      text.className = 'badge-text';
      text.append(name, desc);
      li.append(seal, text);
      ul.appendChild(li);
    }
  }

  function renderStats() {
    const s = loadStats();
    $('#stats').textContent = `Streak ${s.streak} · Called ${s.wins}/${s.played}`;
  }

  function tallyLine(label, value) {
    const li = document.createElement('li');
    const k = document.createElement('span');
    k.className = 'expr';
    k.textContent = label;
    const leader = document.createElement('span');
    leader.className = 'leader';
    const v = document.createElement('span');
    v.className = 'amt';
    v.textContent = value;
    li.append(k, leader, v);
    return li;
  }

  function renderTally() {
    const s = loadStats();
    $('#tally').hidden = s.played === 0;
    if (s.played === 0) return;

    const history = loadHistory();
    const late = history.filter((h) => h.solved && h.late).length;
    const figures = [
      ['Hands called', `${s.wins} of ${s.played}`],
      ['Call rate', `${Math.round((s.wins / s.played) * 100)}%`],
      ['Current run', `${s.streak} day${s.streak === 1 ? '' : 's'}`],
      ['Best run', `${s.maxStreak} day${s.maxStreak === 1 ? '' : 's'}`],
    ];
    if (late) figures.push(['Called late', `${late}`]);
    const ul = $('#tallyFigures');
    ul.innerHTML = '';
    for (const [k, v] of figures) ul.appendChild(tallyLine(k, v));

    const counts = [0, 0, 0, 0];
    for (const h of history) {
      if (h.solved && h.guesses >= 1 && h.guesses <= GUESSES) counts[h.guesses - 1]++;
    }
    const most = Math.max(...counts, 1);
    const ol = $('#tallyDist');
    ol.innerHTML = '';
    for (let i = 0; i < GUESSES; i++) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'dist-label';
      label.textContent = ROUND_PHRASE[i][0].toUpperCase() + ROUND_PHRASE[i].slice(1);
      const bar = document.createElement('span');
      bar.className = 'dist-bar';
      bar.style.width = counts[i] ? `${(counts[i] / most) * 100}%` : '2px';
      if (!counts[i]) bar.classList.add('zero');
      const track = document.createElement('span');
      track.className = 'dist-track';
      track.appendChild(bar);
      const count = document.createElement('span');
      count.className = 'dist-count';
      count.textContent = counts[i];
      li.append(label, track, count);
      ol.appendChild(li);
    }
  }

  function dateForDay(d) {
    return new Date(EPOCH.y, EPOCH.m, EPOCH.d + d).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function renderHistory() {
    $('#history').hidden = today === 0;
    if (today === 0) return;
    const byDay = new Map(loadHistory().map((h) => [h.day, h]));
    const ol = $('#historyLines');
    ol.innerHTML = '';
    for (let d = today - 1; d >= 0; d--) {
      const h = byDay.get(d);
      const amt = !h ? 'not attempted'
        : h.solved
          ? `called${h.late ? ' late' : ''} ${ROUND_PHRASE[h.guesses - 1]}`
          : 'went unread';
      const cls = (!h ? 'blank' : h.solved ? 'called' : 'unread')
        + (archive && d === day ? ' current' : '');
      const li = tallyLine('', amt);
      li.className = cls;
      const a = document.createElement('a');
      a.href = `?no=${d + 1}`;
      a.textContent = `No. ${d + 1} · ${dateForDay(d)}`;
      li.querySelector('.expr').appendChild(a);
      ol.appendChild(li);
    }
  }

  function renderAll() {
    renderSpread();
    renderRows();
    renderControls();
    renderResult();
    renderStats();
    renderTally();
    renderHistory();
    renderBadges();
  }

  /* ---------- share & clock ---------- */

  const TELL_EMOJI = { hit: '🟩', near: '🟨', out: '⬛' };

  // Plain punctuation only — em dashes and middle dots garble in some
  // messaging apps, so the shared text sticks to ASCII plus emoji.
  function shareText() {
    const n = state.rows.length;
    const lines = [`🃏 Dealt No. ${day + 1}`];
    lines.push(`Called ${deal.name}${archive ? ' late' : ''} ${ROUND_PHRASE[n - 1]} (${n}/${GUESSES})`);
    for (const row of state.rows) {
      lines.push(rowTells(row).map((t) => TELL_EMOJI[t]).join(''));
    }
    const s = loadStats();
    if (!archive && s.streak > 1) lines.push(`📈 ${s.streak} days running`);
    const earned = loadBadges();
    const fresh = archive ? [] : BADGES.filter((b) => earned[b.id] === day).map((b) => b.name);
    if (fresh.length) lines.push(`🏅 ${fresh.join(', ')}`);
    lines.push('', 'https://jonezzyboy.github.io/dealt/');
    return lines.join('\n');
  }

  const shareBtn = $('#share');
  const canShare = typeof navigator.share === 'function';
  const shareLabel = canShare ? 'Share result' : 'Copy result';
  shareBtn.textContent = shareLabel;

  function flashShare(msg) {
    shareBtn.textContent = msg;
    setTimeout(() => { shareBtn.textContent = shareLabel; }, 2000);
  }

  function copyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* fall through */ }
    ta.remove();
    return ok;
  }

  shareBtn.addEventListener('click', async () => {
    const text = shareText();
    if (canShare) {
      try { await navigator.share({ text }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      flashShare('Copied');
    } catch {
      flashShare(copyFallback(text) ? 'Copied' : 'Copy failed');
    }
  });

  /* ---------- felt ---------- */

  const THEME_KEY = 'dealt-theme-v1';
  const THEMES = [
    { id: '', name: 'Card room', felt: '#1d4a34', chip: '#f7f2e2' },
    { id: 'burgundy', name: 'Burgundy', felt: '#4d2129', chip: '#f7f2e2' },
    { id: 'midnight', name: 'Midnight', felt: '#1a2c47', chip: '#f7f2e2' },
    { id: 'saloon', name: 'Saloon', felt: '#7c5c39', chip: '#f9f3e0' },
    { id: 'daylight', name: 'Daylight', felt: '#e8e3d1', chip: '#fdfbf2' },
    { id: 'after-hours', name: 'After hours', felt: '#131619', chip: '#232830' },
  ];

  let themeId = localStorage.getItem(THEME_KEY) || '';
  if (!THEMES.some((t) => t.id === themeId)) themeId = '';

  const themeBtn = $('#theme');
  const themeMenu = $('#themeMenu');

  function themeChip(t) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = t.felt;
    const leaf = document.createElement('span');
    leaf.className = 'chip-leaf';
    leaf.style.background = t.chip;
    chip.appendChild(leaf);
    return chip;
  }

  function applyTheme() {
    if (themeId) document.documentElement.dataset.theme = themeId;
    else delete document.documentElement.dataset.theme;
    const t = THEMES.find((x) => x.id === themeId);
    const label = document.createElement('span');
    label.className = 'theme-label';
    label.textContent = 'Felt';
    themeBtn.innerHTML = '';
    themeBtn.append(themeChip(t), label);
  }

  function closeThemeMenu() {
    themeMenu.hidden = true;
    themeBtn.setAttribute('aria-expanded', 'false');
  }

  function renderThemeMenu() {
    themeMenu.innerHTML = '';
    for (const t of THEMES) {
      const b = document.createElement('button');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(t.id === themeId));
      if (t.id === themeId) b.classList.add('selected');
      const name = document.createElement('span');
      name.textContent = t.name;
      b.append(themeChip(t), name);
      b.addEventListener('click', () => {
        themeId = t.id;
        localStorage.setItem(THEME_KEY, themeId);
        applyTheme();
        closeThemeMenu();
      });
      themeMenu.appendChild(b);
    }
  }

  themeBtn.addEventListener('click', () => {
    if (themeMenu.hidden) {
      renderThemeMenu();
      themeMenu.hidden = false;
      themeBtn.setAttribute('aria-expanded', 'true');
    } else {
      closeThemeMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (!themeMenu.hidden && !themeMenu.contains(e.target) && !themeBtn.contains(e.target)) {
      closeThemeMenu();
    }
  });

  applyTheme();

  function tick() {
    const ms = msToMidnight();
    const h = String(Math.floor(ms / 3.6e6)).padStart(2, '0');
    const m = String(Math.floor((ms % 3.6e6) / 6e4)).padStart(2, '0');
    const s = String(Math.floor((ms % 6e4) / 1e3)).padStart(2, '0');
    $('#next').textContent = `Next deal in ${h}:${m}:${s}`;
  }

  /* ---------- boot ---------- */

  $('#issue').textContent = `No. ${day + 1}`;
  const shownDate = archive ? new Date(EPOCH.y, EPOCH.m, EPOCH.d + day) : new Date();
  $('#date').textContent = shownDate.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  $('#archiveNote').hidden = !archive;
  if (archive) $('.history details').open = true;
  $('#claim').textContent = deal.name;

  $('#takeback').addEventListener('click', takeBack);
  $('#clear').addEventListener('click', clearRow);
  $('#call').addEventListener('click', submit);
  $('#fold').addEventListener('click', fold);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') { e.preventDefault(); takeBack(); }
    else if (e.key === 'Enter') { if (!finished() && state.current.length === 5) submit(); }
    else if (e.key === 'Escape') { closeThemeMenu(); }
  });

  // First visit: open the rules for them
  if (!loadJSON(STATS_KEY) && !loadJSON(DAY_KEY)) {
    document.querySelector('.rules').open = true;
  }

  const saved = loadJSON(SLOT_KEY);
  if (saved && saved.day === day) {
    const validRow = (row) => Array.isArray(row) && row.length === 5
      && row.every((i) => Number.isInteger(i) && i >= 0 && i < SPREAD_SIZE)
      && new Set(row).size === 5;
    for (const row of Array.isArray(saved.rows) ? saved.rows : []) {
      if (!validRow(row) || finished()) break;
      state.rows.push(row);
      if (rowTells(row).every((t) => t === 'hit')) win(false);
    }
    if (saved.gaveUp) state.gaveUp = true;
    if (!finished() && Array.isArray(saved.current)) {
      state.current = [...new Set(saved.current)]
        .filter((i) => Number.isInteger(i) && i >= 0 && i < SPREAD_SIZE)
        .slice(0, 5);
    }
  }

  renderAll();
  if (archive) {
    $('#next').textContent = 'Past deal · practice only';
  } else {
    tick();
    setInterval(tick, 1000);
  }
})();

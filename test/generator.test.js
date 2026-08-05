'use strict';

const {
  generateDeal, evaluateHand, countCategory, cardKey,
  CAT, SPREAD_SIZE, GUESSES,
} = require('../game.js');

const DAYS = 365 * 3;
let failures = 0;

function fail(day, msg) {
  failures++;
  console.error(`day ${day}: ${msg}`);
}

const seenCats = new Set();

for (let day = 0; day < DAYS; day++) {
  let d;
  try {
    d = generateDeal(day);
  } catch (e) {
    fail(day, e.message);
    continue;
  }

  if (d.spread.length !== SPREAD_SIZE) fail(day, `expected ${SPREAD_SIZE} cards on the table`);
  const keys = d.spread.map(cardKey);
  if (new Set(keys).size !== d.spread.length) fail(day, 'duplicate card in the spread');
  for (const c of d.spread) {
    if (c.r < 2 || c.r > 14 || c.s < 0 || c.s > 3) fail(day, `bad card ${cardKey(c)}`);
  }

  if (d.hand.length !== 5) fail(day, 'the hand is not five cards');
  const onTable = new Set(keys);
  if (!d.hand.every((c) => onTable.has(cardKey(c)))) fail(day, 'hand card missing from the spread');

  const ev = evaluateHand(d.hand);
  if (ev.cat !== d.cat) fail(day, `hand ranks as ${ev.cat}, announced ${d.cat}`);
  if (ev.name !== d.name) fail(day, `hand is "${ev.name}", announced "${d.name}"`);
  if (ev.arranged.map(cardKey).join() !== d.hand.map(cardKey).join()) {
    fail(day, 'hand is not held in canonical order');
  }
  if (d.cat < CAT.PAIR || d.cat > CAT.STRAIGHT_FLUSH) fail(day, `category ${d.cat} out of range`);

  // A straight or better must never be the only hand of its rank on
  // the table — the announcement would give the game away.
  if (d.cat >= CAT.STRAIGHT && countCategory(d.spread, d.cat) < 2) {
    fail(day, 'announcement gives the hand away');
  }

  const again = generateDeal(day);
  if (again.spread.map(cardKey).join() !== keys.join()
    || again.hand.map(cardKey).join() !== d.hand.map(cardKey).join()) {
    fail(day, 'non-deterministic');
  }

  seenCats.add(d.cat);
}

for (const [cat, label] of [
  [CAT.PAIR, 'a pair'], [CAT.TWO_PAIR, 'two pair'], [CAT.TRIPS, 'three of a kind'],
  [CAT.STRAIGHT, 'a straight'], [CAT.FLUSH, 'a flush'], [CAT.FULL_HOUSE, 'a full house'],
  [CAT.QUADS, 'four of a kind'], [CAT.STRAIGHT_FLUSH, 'a straight flush'],
]) {
  if (!seenCats.has(cat)) fail('-', `${label} never dealt across ${DAYS} days`);
}

if (GUESSES !== 4) fail('-', 'the four betting rounds are load-bearing: flop, turn, river, showdown');

console.log(`${DAYS} deals checked, ${failures} failures`);
process.exit(failures ? 1 : 0);

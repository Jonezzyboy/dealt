'use strict';

const { evaluateHand, tells, card, cardKey, CAT } = require('../game.js');

let failures = 0;

function fail(msg) {
  failures++;
  console.error(msg);
}

// suits: 0=♠ 1=♥ 2=♦ 3=♣
const c = card;

function expectHand(label, cards, wantCat, wantName, wantOrder) {
  const ev = evaluateHand(cards);
  if (ev.cat !== wantCat) fail(`${label}: cat ${ev.cat}, wanted ${wantCat}`);
  if (ev.name !== wantName) fail(`${label}: name "${ev.name}", wanted "${wantName}"`);
  if (wantOrder) {
    const got = ev.arranged.map(cardKey).join(' ');
    const want = wantOrder.map(cardKey).join(' ');
    if (got !== want) fail(`${label}: arranged [${got}], wanted [${want}]`);
  }
}

expectHand('high card',
  [c(2, 0), c(5, 3), c(9, 2), c(11, 1), c(14, 0)],
  CAT.HIGH, 'high card',
  [c(14, 0), c(11, 1), c(9, 2), c(5, 3), c(2, 0)]);

expectHand('pair leads, then kickers high to low',
  [c(9, 3), c(14, 0), c(9, 1), c(4, 2), c(11, 0)],
  CAT.PAIR, 'a pair',
  [c(9, 1), c(9, 3), c(14, 0), c(11, 0), c(4, 2)]);

expectHand('two pair: high pair, low pair, kicker',
  [c(3, 0), c(12, 2), c(3, 1), c(7, 3), c(12, 1)],
  CAT.TWO_PAIR, 'two pair',
  [c(12, 1), c(12, 2), c(3, 0), c(3, 1), c(7, 3)]);

expectHand('three of a kind',
  [c(6, 0), c(2, 1), c(6, 2), c(6, 3), c(13, 1)],
  CAT.TRIPS, 'three of a kind',
  [c(6, 0), c(6, 2), c(6, 3), c(13, 1), c(2, 1)]);

expectHand('straight, king high',
  [c(11, 0), c(13, 1), c(9, 2), c(10, 3), c(12, 1)],
  CAT.STRAIGHT, 'a straight',
  [c(13, 1), c(12, 1), c(11, 0), c(10, 3), c(9, 2)]);

expectHand('the wheel reads 5-4-3-2-A',
  [c(14, 0), c(3, 1), c(5, 2), c(2, 3), c(4, 1)],
  CAT.STRAIGHT, 'a straight',
  [c(5, 2), c(4, 1), c(3, 1), c(2, 3), c(14, 0)]);

expectHand('flush, high to low',
  [c(2, 2), c(9, 2), c(14, 2), c(6, 2), c(11, 2)],
  CAT.FLUSH, 'a flush',
  [c(14, 2), c(11, 2), c(9, 2), c(6, 2), c(2, 2)]);

expectHand('full house: trips lead even when the pair outranks them',
  [c(14, 0), c(3, 1), c(3, 2), c(14, 3), c(3, 0)],
  CAT.FULL_HOUSE, 'a full house',
  [c(3, 0), c(3, 1), c(3, 2), c(14, 0), c(14, 3)]);

expectHand('four of a kind, suits in order, kicker last',
  [c(8, 3), c(8, 0), c(2, 1), c(8, 2), c(8, 1)],
  CAT.QUADS, 'four of a kind',
  [c(8, 0), c(8, 1), c(8, 2), c(8, 3), c(2, 1)]);

expectHand('straight flush',
  [c(9, 1), c(6, 1), c(8, 1), c(5, 1), c(7, 1)],
  CAT.STRAIGHT_FLUSH, 'a straight flush',
  [c(9, 1), c(8, 1), c(7, 1), c(6, 1), c(5, 1)]);

expectHand('royal flush gets its proper name',
  [c(12, 0), c(14, 0), c(10, 0), c(13, 0), c(11, 0)],
  CAT.STRAIGHT_FLUSH, 'a royal flush',
  [c(14, 0), c(13, 0), c(12, 0), c(11, 0), c(10, 0)]);

expectHand('steel wheel is a straight flush reading 5-4-3-2-A',
  [c(2, 3), c(14, 3), c(4, 3), c(3, 3), c(5, 3)],
  CAT.STRAIGHT_FLUSH, 'a straight flush',
  [c(5, 3), c(4, 3), c(3, 3), c(2, 3), c(14, 3)]);

expectHand('equal ranks settle by suit, spades first',
  [c(10, 3), c(10, 0), c(4, 1), c(7, 2), c(2, 0)],
  CAT.PAIR, 'a pair',
  [c(10, 0), c(10, 3), c(7, 2), c(4, 1), c(2, 0)]);

/* ---------- tells ---------- */

const hand = [c(12, 1), c(12, 2), c(3, 0), c(3, 1), c(7, 3)];

function expectTells(label, guess, want) {
  const got = tells(guess, hand).join(',');
  if (got !== want.join(',')) fail(`${label}: tells [${got}], wanted [${want.join(',')}]`);
}

expectTells('the hand itself is all hits', hand,
  ['hit', 'hit', 'hit', 'hit', 'hit']);

expectTells('swapped cards read near',
  [c(12, 2), c(12, 1), c(3, 0), c(3, 1), c(7, 3)],
  ['near', 'near', 'hit', 'hit', 'hit']);

expectTells('cards the dealer is not holding read out',
  [c(12, 1), c(2, 0), c(3, 0), c(14, 3), c(7, 3)],
  ['hit', 'out', 'hit', 'out', 'hit']);

expectTells('a held card in the wrong seat reads near',
  [c(7, 3), c(12, 2), c(3, 0), c(3, 1), c(12, 1)],
  ['near', 'hit', 'hit', 'hit', 'near']);

console.log(`evaluator checked, ${failures} failures`);
process.exit(failures ? 1 : 0);

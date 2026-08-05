'use strict';

const { BADGES, CAT } = require('../game.js');

let failures = 0;

function fail(msg) {
  failures++;
  console.error(msg);
}

const badge = (id) => BADGES.find((b) => b.id === id);

function expect(id, ctx, want) {
  const got = badge(id).test(ctx);
  if (got !== want) fail(`${id}: expected ${want} for ${JSON.stringify(ctx)}`);
}

// A plain first win: called on the river, some stray cards played.
const base = { wins: 1, streak: 1, guesses: 3, noOut: false, cat: CAT.PAIR };

if (BADGES.length === 0) fail('no badges defined');
for (const b of BADGES) {
  if (!b.id || !b.seal || !b.name || !b.desc) fail(`badge missing fields: ${JSON.stringify(b)}`);
  if (typeof b.test !== 'function') fail(`${b.id}: test is not a function`);
}
if (new Set(BADGES.map((b) => b.id)).size !== BADGES.length) fail('duplicate badge ids');

expect('ante-up', base, true);
expect('ante-up', { ...base, wins: 0 }, false);

expect('flopped-it', base, false);
expect('flopped-it', { ...base, guesses: 1 }, true);

expect('on-the-turn', base, false);
expect('on-the-turn', { ...base, guesses: 2 }, true);
expect('on-the-turn', { ...base, guesses: 1 }, true);

expect('slow-play', base, false);
expect('slow-play', { ...base, guesses: 4 }, true);

expect('poker-face', base, false);
expect('poker-face', { ...base, noOut: true }, true);

expect('high-roller', base, false);
expect('high-roller', { ...base, cat: CAT.FULL_HOUSE }, false);
expect('high-roller', { ...base, cat: CAT.QUADS }, true);
expect('high-roller', { ...base, cat: CAT.STRAIGHT_FLUSH }, true);

expect('hot-streak', base, false);
expect('hot-streak', { ...base, streak: 3 }, true);

expect('on-a-heater', { ...base, streak: 6 }, false);
expect('on-a-heater', { ...base, streak: 7 }, true);

expect('card-sharp', { ...base, streak: 29 }, false);
expect('card-sharp', { ...base, streak: 30 }, true);

expect('the-grinder', { ...base, streak: 89 }, false);
expect('the-grinder', { ...base, streak: 90 }, true);

expect('the-nuts', { ...base, streak: 364 }, false);
expect('the-nuts', { ...base, streak: 365 }, true);

expect('century-chip', { ...base, wins: 99 }, false);
expect('century-chip', { ...base, wins: 100 }, true);

console.log(`${BADGES.length} badges checked, ${failures} failures`);
process.exit(failures ? 1 : 0);

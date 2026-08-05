# Dealt 🃏

A daily poker deduction game played across a card table. Twelve cards face
up, five of them in the dealer's hand — and the dealer admits what the hand
ranks as. Four calls to find it and earn the gold **CALLED** stamp.

**Play it at <https://jonezzyboy.github.io/dealt/>.**
It's listed alongside everything else on the homepage,
<https://jonezzyboy.github.io/>.

## How to play

The dealer is holding five of the twelve cards on the table, and admits
what the hand ranks as (say, *a flush*).

1. Pick five cards from the spread to call the hand.
2. Each card comes back with a tell — 🟩 right card in the right place,
   🟨 in the hand but the wrong place, ⬛ not in the hand at all.
3. You get four calls: the **flop**, the **turn**, the **river** and
   the **showdown**. Miss all four and the dealer keeps the pot.

House rules:

- The hand reads left to right: the cards that make the rank first, then
  the spares — highest first, with ties settled by suit (♠ ♥ ♦ ♣). Work
  out *which* five cards and the seating follows.
- Each call also shows what your own five cards would rank as.
- Cards you've learned about are marked on the table: duds go grey, cards
  known to be in the hand get a green pip.
- A fresh deal at local midnight. Streaks, results and commendations are
  kept in `localStorage`.
- **Share result** opens the device share sheet where the browser supports
  it (straight into WhatsApp and the like); elsewhere the button copies
  plain, paste-anywhere text to the clipboard.
- **Felt** (in the footer) picks the table: *Card room* (default),
  *Burgundy*, *Midnight*, *Saloon*, *Daylight* (light) and *After hours*
  (dark). The choice is remembered.
- **The tally** (below the table) totals your record — call rate, current
  and best runs, late calls, and which round your hands get called on.
- **Past deals** (below the table) lists every previous day — the deal
  number, its date, and whether the hand was called and on which round.
  Each entry links to that day's deal (also reachable at `?no=N`), replayed
  for practice: calling one is recorded as *called late*, but streaks,
  stats and commendations are untouched.

## Commendations

Badges earned by calling hands in style — call it on the flop
(*Flopped It*), inside two guesses (*On the Turn*), on your very last
guess (*Slow Play*), without ever playing a card the dealer wasn't holding
(*Poker Face*), or on a day of four of a kind or better (*High Roller*) —
plus streaks (*Hot Streak*, *On a Heater*, *Card Sharp*, *The Grinder*,
*The Nuts*) and *Century Chip* for a hundred hands called in all.
The full cabinet lives under **Commendations** below the table, and new
ones are stamped into your shareable result.

## The daily deal

Every day's deal is derived deterministically from the date — everyone
gets the same table on the same day, with no server and no answer list:

1. The date is turned into a day index (deal No. 1 = 5 August 2026).
2. A seeded PRNG ([mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c))
   picks the hand's rank from a weighted spread of categories — pairs are
   everyday fare, straight flushes a rare treat — then builds an actual
   hand of that rank, so **the announcement is always honest**.
3. Seven decoys are dealt around it, weighted toward cards that rhyme with
   the hand — matching ranks, the dominant suit, neighbouring ranks — so
   near-miss hands appear on the table.
4. A deal announcing a straight or better is rejected unless the table
   holds at least one *other* hand of the same rank, so the announcement
   never gives the game away.

## Running it

It's a static page — open `index.html` in a browser, or:

```sh
python3 -m http.server 8000
```

then visit <http://localhost:8000>.

## Tests

```sh
npm test
```

Checks the poker evaluator over every hand rank — categories, spoken
names, canonical ordering (wheels, steel wheels, suit tie-breaks) — and
the tell logic; replays the generator across three years of days and
verifies each deal's shape, honesty, canonical hand order, ambiguity
guarantee and determinism; then checks every commendation's earning
conditions.

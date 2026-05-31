# Off-season placement swiss

Proposal from the Discord thread (Lavina): between seasons, run a 3-round
swiss for new joiners + relegated players to slot them fairly into the
next season's divisions instead of dumping good players at the bottom.

## Why

Right now the build-season-from-signups flow seeds new players by their
admin-set rating (or 0 if unrated). Two failure modes:

1. **Stronger players placed too low**: a new player who's actually
   top-tier ends up bottom of Common, promotes every season for a year
   to get where they belong, frustrating everyone in their wake.
2. **Returning players after a break**: no explicit handling — they
   either keep their old rating (might be stale) or get re-rated as
   new (bad for someone who was top of Rare last season).

A short structured off-season tournament fixes both: every entrant
plays 3 measured matches, the result determines where they slot in.

## Who plays

- **Forced in**: 4th/5th place from middle-to-lower divisions of the
  just-ended season (Lavina suggests "starting from rare 3"). Top
  divisions untouched to keep promotion meaningful.
- **Opt-in**: any new joiner + anyone who wants to test their rank.
- **Off-limits**: top 3 (or N) finishers in any division — they're locked
  in for promotion via the normal season-end recompute.

## Format

- **Round 1**: seeded pairing — 1 vs N, 2 vs N-1, etc. Seeds come from
  either prior-season finish (for returners) or admin-assigned rating
  (for new joiners).
- **Rounds 2-3**: swiss pair within W-L buckets (1-0 plays 1-0, 0-1
  plays 0-1).
- **Scoring** within the placement round itself: best-of-2 set, just
  like league matches. A `1-1` draw counts as half-win-half-loss for
  bucketing.
- **Higher seed privilege**: gets to choose ban-first OR pick-first
  twice across the set vs the opponent's once. Optional; matches the
  Discord proposal.

## Output: 8 result buckets

After 3 rounds, every entrant has a record string sortable from best
to worst:

```
WWW > WWL > WLW > WLL > LWW > LWL > LLW > LLL
```

(Within bucket, higher initial seed wins the tie.)

## Placement into next season's divisions

Two-pass fill:

1. **Pre-promotions first**: players who earned promotion from last
   season's normal end-of-season recompute get their promoted seat
   first. No matter what the placement round says, you don't lose a
   promotion you earned.
2. **Fill remaining seats by bucket**: walk the buckets top-down,
   placing each player into the highest division that still has open
   seats.

If divisions are full and a placement entrant still has nowhere to
go, they spill to the bottom tier (matches existing build-from-signups
overflow behavior).

## Data model sketch

```prisma
model PlacementRound {
  id              String   @id @default(cuid())
  name            String                              // "Pre-Season 8 placement"
  upcomingSeasonId String?                            // the Season this feeds into
  status          PlacementStatus @default(OPEN)      // OPEN, ROUND_1, ROUND_2, ROUND_3, COMPLETE
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  participants    PlacementParticipant[]
  matches         PlacementMatch[]
}

enum PlacementStatus {
  OPEN          // accepting signups
  ROUND_1       // round 1 pairings posted, awaiting results
  ROUND_2
  ROUND_3
  COMPLETE      // bucketed, ready to feed into next season
}

model PlacementParticipant {
  id              String   @id @default(cuid())
  placementRoundId String
  playerId        String
  initialSeed     Int                                  // 1 = highest
  wins            Int      @default(0)                 // 0, 1, 2, or 3
  draws           Int      @default(0)                 // counts as half each side for bucketing
  losses          Int      @default(0)
  finalBucket     String?                              // "WWW", "WWL", ... assigned at COMPLETE

  placementRound  PlacementRound @relation(fields: [placementRoundId], references: [id], onDelete: Cascade)
  player          Player         @relation(fields: [playerId], references: [id])

  @@unique([placementRoundId, playerId])
}

model PlacementMatch {
  id              String   @id @default(cuid())
  placementRoundId String
  roundNumber     Int                                  // 1, 2, 3
  playerAId       String                               // canonical: A < B
  playerBId       String
  gamesWonA       Int      @default(0)
  gamesWonB       Int      @default(0)
  status          PlacementMatchStatus @default(PENDING)
  reportedAt      DateTime?

  placementRound  PlacementRound @relation(fields: [placementRoundId], references: [id], onDelete: Cascade)
}

enum PlacementMatchStatus {
  PENDING
  CONFIRMED
}
```

## Admin flow

1. **End the just-finished season** as normal (recompute ratings,
   archive if desired).
2. **Open a placement round** for the next season:
   - `/admin/placement/new` — pick which divisions count as "middle/
     lower" (forced entries), accept a list of opt-in Discord IDs
3. **Players sign up** via /me opt-in OR Discord signup channel.
4. **Admin starts round 1** — bot posts pairings to a `#placements`
   channel.
5. **Players play + report** using the existing `/report` (with a flag
   distinguishing placement matches from regular league matches).
6. **Admin advances** to round 2, then round 3.
7. **Admin completes** — buckets computed, results displayed.
8. **Build season** auto-uses the placement bucket order instead of
   raw rating for entrants who placed.

## Open design questions

- **Conflicts with normal season build**: a placement entrant might
  ALSO be a normal signup. Resolution: placement bucket always wins.
- **Half-finished placement** (someone misses a round): admin can
  manually assign them a loss for that round, or drop them entirely
  (their rating-based seat falls back).
- **Does a 1-1 draw really count as half W + half L?** Lavina's
  proposal didn't address this; could also require playoff/shootout
  to break draws since the whole point is to test players.
- **How many rounds for smaller pools?** With <8 entrants, 3 rounds
  produces redundant bucketing. Maybe 2 rounds for 4-7 entrants, 3
  for 8+, full round-robin for ≤4.

## Build estimate

- Schema + migration: ~30 min
- Round-pairing algorithm (swiss): ~2 hr (it's a small bin-packing
  problem with constraints)
- Admin UI for create/advance/view placement round: ~4 hr
- Player-facing report flow: ~1 hr (extend existing /report)
- Integration with build-season (placement-order overrides
  rating-order): ~2 hr
- **Total**: ~1 day end-to-end

## Recommendation

Implement only when sign-up volume actually justifies it. Owen made the
valid counter-point: if only 5 people sign up between seasons, the
placement round just IS the next season's bottom division. The system
adds real value at 15+ entrants — until then, manual rating set +
existing snake-draft handles it fine.

Reasonable trigger: **build it when the first season has 30+ players
and the second one already has 15+ new signups in the queue.**

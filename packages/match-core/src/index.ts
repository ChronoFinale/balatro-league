// @balatro/match-core — the shared 1v1 match engine.
//
// What's here today (Phase 0, growing):
//  - the pure ban/pick state machine (`match-state`),
//  - pure series-result resolution (`result`),
//  - Game/GameDeck writers with an INJECTED Prisma client (`match-write`).
// The schema fragment lives at `prisma/core.prisma`. The engine stays
// framework-agnostic: match-write takes a client rather than importing one, so
// each consuming app supplies its own generated PrismaClient.

export * from "./match-state";
export * from "./result";
export * from "./match-write";

// Minimal Challonge v1 REST client. Used by /admin/divisions/[id]/import-challonge
// to pull participants + match results from an existing league bracket.

const BASE = "https://api.challonge.com/v1";

export interface ChallongeParticipant {
  id: number;
  name: string;
  seed: number;
  final_rank: number | null;
}

export interface ChallongeMatch {
  id: number;
  player1_id: number | null;
  player2_id: number | null;
  scores_csv: string;
  winner_id: number | null;
  state: "open" | "complete" | "pending";
  round: number;
  group_id: number | null;
}

export interface ChallongeTournament {
  name: string;
  tournament_type: string;
  state: string;
  participants_count: number;
}

async function get<T>(path: string, apiKey: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Challonge API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// Challonge wraps each resource in {tournament: ...} / {participant: ...} / {match: ...} objects
type Wrapped<K extends string, T> = { [key in K]: T };

export async function fetchTournament(slug: string, apiKey: string): Promise<ChallongeTournament> {
  const wrapped = await get<Wrapped<"tournament", ChallongeTournament>>(`/tournaments/${slug}.json`, apiKey);
  return wrapped.tournament;
}

export async function fetchParticipants(slug: string, apiKey: string): Promise<ChallongeParticipant[]> {
  const arr = await get<Array<Wrapped<"participant", ChallongeParticipant>>>(
    `/tournaments/${slug}/participants.json`,
    apiKey,
  );
  return arr.map((w) => w.participant);
}

export async function fetchMatches(slug: string, apiKey: string): Promise<ChallongeMatch[]> {
  const arr = await get<Array<Wrapped<"match", ChallongeMatch>>>(
    `/tournaments/${slug}/matches.json`,
    apiKey,
  );
  return arr.map((w) => w.match);
}

// Convert a Challonge slug from a full URL if needed.
// "https://challonge.com/mzegd4q9" → "mzegd4q9"
// "mzegd4q9" → "mzegd4q9"
export function normalizeSlug(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/challonge\.com\/(?:tournaments\/)?([a-zA-Z0-9_-]+)/);
  return m ? m[1]! : trimmed;
}

// Parse "scores_csv" — Challonge supports multi-set scores like "21-15,18-21,15-10".
// For our 2-game-series league we only care about the first set's final tally
// being one of 2-0, 1-1, 0-2 (from player1's perspective).
// Returns the normalized "A-B" string + a winner hint ("player1" | "player2" | "draw").
export function interpretScore(
  scoresCsv: string,
  winnerId: number | null,
  player1Id: number | null,
): { result: "2-0" | "1-1" | "0-2"; ok: true } | { ok: false; reason: string } {
  const raw = scoresCsv.trim();
  if (!raw) return { ok: false, reason: "no score reported" };

  // Match the LAST "A-B" pair in the CSV; this handles bo3 etc.
  const matches = [...raw.matchAll(/(\d+)-(\d+)/g)];
  if (matches.length === 0) return { ok: false, reason: `unparseable score: ${raw}` };
  const last = matches[matches.length - 1]!;
  const a = parseInt(last[1]!, 10);
  const b = parseInt(last[2]!, 10);

  // Direct match for our scoring scheme
  if (a === 2 && b === 0) return { result: "2-0", ok: true };
  if (a === 0 && b === 2) return { result: "0-2", ok: true };
  if (a === 1 && b === 1) return { result: "1-1", ok: true };

  // Fall back to winner_id if we have a non-2-game score (e.g. someone wrote 21-15)
  if (winnerId !== null && player1Id !== null) {
    if (winnerId === player1Id) return { result: "2-0", ok: true };
    return { result: "0-2", ok: true };
  }
  return { ok: false, reason: `non-2-game score "${raw}" and no winner_id` };
}

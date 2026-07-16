"use client";

// One dropdown = one set result. Instead of two score boxes plus FF/DQ buttons,
// the TO picks the outcome from a single list and it saves on pick. Labelled by the
// two players in the set (a set is one player vs one player).
//
// The TO enters the ACTUAL played score -- a Bo3 shows 2-0/2-1, a Bo5 shows
// 3-0/3-1/3-2, a Bo7 4-0..4-3. The server converts anything longer than Bo3 to Bo3
// terms for scoring (rules doc + design §12.4: winner 2, loser 1 if competitive else
// 0), so the TO never does that math. Preselects the recorded result via `current`.
import { ActionFlashForm } from "@/components/ActionFlashForm";
import { FormSelect, type FormSelectOption } from "@/components/FormSelect";
import { setOutcomeAction } from "@/app/admin/matchups/[matchupId]/actions";

// "gamesA-gamesB" -> "<winner> A-B" for display (e.g. a recorded/converted score).
function scoreLabel(v: string, a: string, b: string): string {
  const m = v.match(/^(\d+)-(\d+)$/);
  if (!m) return v;
  const ga = Number(m[1]);
  const gb = Number(m[2]);
  return ga > gb ? `${a} ${ga}-${gb}` : gb > ga ? `${b} ${gb}-${ga}` : v;
}

export function SetOutcomeSelect({
  matchupId,
  setId,
  bestOf,
  aName,
  bName,
  current,
}: {
  matchupId: string;
  setId: string;
  bestOf: number;
  aName: string; // team A's player in this set
  bName: string; // team B's player in this set
  current: string;
}) {
  const win = Math.max(1, Math.ceil(bestOf / 2)); // games needed to win the set
  const a = aName.slice(0, 16);
  const b = bName.slice(0, 16);
  const options: FormSelectOption[] = [];
  // Team A's win scores (win-0 .. win-(win-1)); value is the raw "gamesA-gamesB".
  for (let l = win - 1; l >= 0; l--) options.push({ value: `${win}-${l}`, label: `${a} ${win}-${l}` });
  for (let l = win - 1; l >= 0; l--) options.push({ value: `${l}-${win}`, label: `${b} ${win}-${l}` });
  options.push({ value: "ff-a", label: `${a} wins (forfeit)` });
  options.push({ value: "ff-b", label: `${b} wins (forfeit)` });
  options.push({ value: "void", label: "Void / double DQ (0-0)" });

  // A recorded result may be the Bo3-converted score (e.g. a Bo5 3-2 stored as 2-1),
  // which isn't in this set's raw option list -- keep it visible, player-labelled.
  const known = new Set(options.map((o) => o.value));
  if (current && !known.has(current)) options.unshift({ value: current, label: scoreLabel(current, a, b) });

  return (
    <ActionFlashForm action={setOutcomeAction}>
      <input type="hidden" name="matchupId" value={matchupId} />
      <input type="hidden" name="setId" value={setId} />
      <FormSelect
        name="outcome"
        size="sm"
        options={options}
        defaultValue={current}
        placeholder="-- pick result --"
        submitOnChange
        triggerClassName="min-w-[11rem]"
      />
    </ActionFlashForm>
  );
}

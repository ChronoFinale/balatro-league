"use client";

// A pair of player dropdowns for "X vs Y" admin forms where the two MUST be
// different people. Picking someone on one side removes them from the other —
// so you can't select the same player twice (the server rejects it too, but
// this stops it before you submit). Mirrors values into hidden inputs so the
// server action reads the same FormData keys as plain selects.

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  playerId: string;
  displayName: string;
}

function PlayerSelect({
  value,
  onChange,
  options,
  placeholder,
  triggerClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Member[];
  placeholder: string;
  triggerClassName?: string;
}) {
  const items = options.map((m) => ({ value: m.playerId, label: m.displayName }));
  return (
    <Select items={items} value={value === "" ? "" : value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((m) => (
          <SelectItem key={m.playerId} value={m.playerId}>{m.displayName}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DistinctMemberSelects({
  members,
  nameA,
  nameB,
  placeholderA,
  placeholderB,
  triggerClassName = "min-w-[140px]",
}: {
  members: Member[];
  nameA: string;
  nameB: string;
  placeholderA: string;
  placeholderB: string;
  triggerClassName?: string;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <>
      <input type="hidden" name={nameA} value={a} />
      <PlayerSelect
        value={a}
        onChange={setA}
        options={members.filter((m) => m.playerId !== b)}
        placeholder={placeholderA}
        triggerClassName={triggerClassName}
      />
      <span className="muted">vs</span>
      <input type="hidden" name={nameB} value={b} />
      <PlayerSelect
        value={b}
        onChange={setB}
        options={members.filter((m) => m.playerId !== a)}
        placeholder={placeholderB}
        triggerClassName={triggerClassName}
      />
    </>
  );
}

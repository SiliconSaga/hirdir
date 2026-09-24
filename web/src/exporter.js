// Out of the app, into the season workbook: same columns, same order.

import { fairShareSeconds } from "./selectors.js";

const HEADER = "Player,Jersey,Here,Minutes played,+/- fair,Goals,Star,Shy,Needs help,Notes";

const cell = (value) => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // A name or note starting = + - @ is read as a formula by spreadsheets, and
  // a leading tab/CR/LF can smuggle one past that check. Numbers stay numeric,
  // so a negative ± fair is unaffected.
  if (typeof value === "string" && /^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  // \r counts as a line break to many CSV readers, so a value carrying one
  // mid-string must be quoted too, or "Ada\r=1+1" arrives as its own row.
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const minutes = (seconds) => Math.round(seconds / 60);

export function toCsv(state, clockSeconds, onFieldTarget) {
  const fair = fairShareSeconds(state, clockSeconds, onFieldTarget);
  const rows = [...state.kids.values()].map((kid) => {
    const notes = state.notes
      .filter((note) => note.on.includes(kid.id))
      .map((note) => note.text)
      .join(" · ");
    return [
      kid.name,
      kid.jersey,
      kid.present ? "✓" : "A",
      minutes(kid.seconds),
      kid.present ? minutes(kid.seconds - fair) : "",
      kid.goals,
      kid.flags.has("star") ? "★" : "",
      kid.flags.has("shy") ? "x" : "",
      kid.flags.has("help") ? "x" : "",
      notes,
    ]
      .map(cell)
      .join(",");
  });
  return [HEADER, ...rows].join("\n");
}

export function toJson(doc) {
  return JSON.stringify(doc, null, 2);
}

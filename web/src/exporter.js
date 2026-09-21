// Out of the app, into the season workbook: same columns, same order.

import { fairShareSeconds } from "./selectors.js";

const HEADER = "Player,Jersey,Here,Minutes played,+/- fair,Goals,Star,Shy,Needs help,Notes";

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

// Derived questions a coach asks mid-game. Pure reads over GameState.

export function fairShareSeconds(state, clockSeconds, onFieldTarget) {
  const present = [...state.kids.values()].filter((k) => k.present).length;
  if (present === 0) return 0;
  return (clockSeconds * onFieldTarget) / present;
}

export function deficit(kid, fairShare) {
  return kid.seconds - fairShare;
}

export function benchOrder(state, fairShare) {
  return [...state.kids.values()]
    .filter((k) => k.present && !k.onField)
    .sort((a, b) => deficit(a, fairShare) - deficit(b, fairShare) || a.seconds - b.seconds);
}

// Longest current stint first: whoever went on earliest has been on longest.
export function onFieldOrder(state) {
  return [...state.kids.values()]
    .filter((k) => k.onField)
    .sort((a, b) => (a.stintStart ?? 0) - (b.stintStart ?? 0));
}

export function proposeSubOff(state) {
  return onFieldOrder(state)[0] ?? null;
}

// Events in, game state out. Pure: no clock, no DOM, no storage.

function blankKid({ id, name, jersey }) {
  return {
    id,
    name,
    jersey,
    onField: false,
    seconds: 0,
    stintStart: null,
    goals: 0,
    flags: new Set(),
    present: true,
  };
}

export function fold(events, roster, nowT) {
  const kids = new Map(roster.map((k) => [k.id, blankKid(k)]));
  const state = { started: false, ended: false, endedAt: null, kids, notes: [] };

  const on = (kid, t) => {
    if (!kid || kid.onField) return;
    kid.onField = true;
    kid.stintStart = t;
  };
  const off = (kid, t) => {
    if (!kid || !kid.onField) return;
    kid.seconds += Math.max(0, t - kid.stintStart);
    kid.onField = false;
    kid.stintStart = null;
  };

  for (const event of events) {
    const kid = event.kid ? kids.get(event.kid) : null;
    switch (event.type) {
      case "game_start":
        state.started = true;
        break;
      case "game_end":
        state.ended = true;
        state.endedAt = event.t;
        for (const k of kids.values()) off(k, event.t);
        break;
      case "sub_in":
        on(kid, event.t);
        break;
      case "sub_out":
        off(kid, event.t);
        break;
      case "roll_call": {
        const next = new Set(event.on ?? []);
        for (const k of kids.values()) {
          if (next.has(k.id)) on(k, event.t);
          else off(k, event.t);
        }
        break;
      }
      case "absent":
        if (kid) {
          off(kid, event.t);
          kid.present = false;
        }
        break;
      case "present":
        if (kid) kid.present = true;
        break;
      case "goal":
        if (kid) kid.goals += 1;
        break;
      case "flag":
        if (kid) {
          if (kid.flags.has(event.flag)) kid.flags.delete(event.flag);
          else kid.flags.add(event.flag);
        }
        break;
      case "note":
        state.notes.push({
          t: event.t,
          text: event.text,
          on: [...kids.values()].filter((k) => k.onField).map((k) => k.id),
        });
        break;
      default:
        break;
    }
  }

  const cutoff = state.ended ? state.endedAt : nowT;
  for (const kid of kids.values()) {
    if (kid.onField) kid.seconds += Math.max(0, cutoff - kid.stintStart);
  }
  return state;
}

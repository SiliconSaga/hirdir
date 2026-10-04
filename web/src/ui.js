// Renders a view model into the page. No arithmetic, no state.

const $ = (id) => document.getElementById(id);

function markButton(action, label, { set = null, aria = null } = {}) {
  const button = document.createElement("button");
  button.dataset.action = action;
  button.textContent = label;
  if (aria) button.setAttribute("aria-label", aria);
  // Toggles announce their state; one-shot buttons (a goal) have none.
  if (set !== null) {
    button.classList.toggle("set", set);
    button.setAttribute("aria-pressed", String(set));
  }
  return button;
}

// Both questions on one line: how much has this kid had, and where that
// leaves them. ± fair slides every second — the share it is measured against
// grows with the clock — so the plain minutes anchor it.
function metaLine(kid, onField) {
  if (onField) return `${kid.stint} on · ${kid.minutes} min`;
  return kid.owedMinutes
    ? `${kid.minutes} min · owed ${kid.owedMinutes}`
    : `${kid.minutes} min`;
}

function kidRow(kid, { onField }) {
  const li = document.createElement("li");
  li.className = onField ? "kid" : kid.owed ? "kid owed" : "kid";
  li.dataset.kid = kid.id;

  const main = document.createElement("button");
  main.className = "kid-main";
  main.dataset.action = onField ? "off" : "on";

  const jersey = document.createElement("span");
  jersey.className = "jersey";
  jersey.textContent = kid.jersey ?? "";

  // Name above, time below: side by side, four 48px marks left the name
  // truncated to "Bjo…", and the name is the whole point of the row.
  const who = document.createElement("span");
  who.className = "who";
  for (const [className, text] of [
    ["name", kid.name],
    ["meta", metaLine(kid, onField)],
  ]) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    who.append(span);
  }
  main.append(jersey, who);

  // Four marks per row, no more: a kid on the bench cannot score, and a kid on
  // the field is plainly here. Five buttons overflowed the card on a phone.
  const marks = document.createElement("span");
  marks.className = "marks";
  marks.append(
    onField
      ? markButton("goal", `⚽${kid.goals || ""}`, { aria: `Goal for ${kid.name}` })
      : markButton("away", "away", { aria: `${kid.name} is not here today` }),
    markButton("star", "★", { set: kid.flags.includes("star"), aria: `Doing great: ${kid.name}` }),
    markButton("shy", "shy", { set: kid.flags.includes("shy"), aria: `Shy: ${kid.name}` }),
    markButton("help", "help", {
      set: kid.flags.includes("help"),
      aria: `Needs help: ${kid.name}`,
    }),
  );

  li.append(main, marks);
  return li;
}

// A row only needs rebuilding when something structural changed. Ticking the
// clock must not replace elements under a thumb that is mid-tap.
function shapeOf(rows, onField) {
  return rows
    .map((kid) =>
      [kid.id, kid.name, kid.jersey, kid.goals, kid.flags.join("+"), onField ? "" : kid.owed].join(":"),
    )
    .join("|");
}

const lastShape = { "on-field": null, bench: null, away: null };

function paintList(id, rows, onField) {
  const shape = shapeOf(rows, onField);
  const list = $(id);
  if (lastShape[id] === shape && list.children.length === rows.length) {
    // Same players in the same order: just move the numbers on.
    rows.forEach((kid, index) => {
      const meta = list.children[index].querySelector(".meta");
      if (meta) meta.textContent = metaLine(kid, onField);
    });
    return;
  }
  lastShape[id] = shape;
  list.replaceChildren(...rows.map((kid) => kidRow(kid, { onField })));
}

export function render(view) {
  $("clock").textContent = view.clock;
  $("clock-toggle").textContent = view.running ? "Pause" : "Start";
  $("count").textContent = view.countLabel;
  $("count").classList.toggle("warn", view.countWarning);

  paintList("on-field", view.onField, true);
  paintList("bench", view.bench, false);

  $("away-section").hidden = view.away.length === 0;
  $("away").replaceChildren(
    ...view.away.map((kid) => {
      const li = document.createElement("li");
      li.className = "kid away";
      li.dataset.kid = kid.id;
      const button = document.createElement("button");
      button.className = "kid-main";
      button.dataset.action = "present";
      button.setAttribute("aria-label", `${kid.name} is here after all`);
      button.textContent = `${kid.name} — tap if they turn up`;
      li.append(button);
      return li;
    }),
  );

  // The same button ends a game or, when none is running, clears the team out.
  $("end-game").textContent = view.gameLive ? "End game" : "Reset everything";

  // Once the game is over nothing new gets recorded — but undo still works,
  // because ending it by mis-tap is exactly what needs taking back.
  $("undo").disabled = !view.canUndo;
  for (const id of ["rollcall", "note-save", "clock-toggle"]) $(id).disabled = view.ended;

  $("pending").hidden = !view.pending;
  if (view.pending) {
    $("pending-in").textContent = view.pending.inName;
    // With room on the field nobody comes off, so the "for X" half disappears.
    $("pending-swap").hidden = !view.pending.outName;
    $("pending-out").textContent = view.pending.outName;
  }
}

// Fills the roll-call dialog with a toggle per kid and opens it.
export function openRollCall(view, onSave) {
  const grid = $("rollcall-grid");
  const chosen = new Set(view.onField.map((kid) => kid.id));
  const everyone = [...view.onField, ...view.bench];
  grid.replaceChildren(
    ...everyone.map((kid) => {
      const button = document.createElement("button");
      button.textContent = kid.name;
      const paint = () => {
        button.classList.toggle("on", chosen.has(kid.id));
        button.setAttribute("aria-pressed", String(chosen.has(kid.id)));
      };
      paint();
      button.addEventListener("click", () => {
        if (chosen.has(kid.id)) chosen.delete(kid.id);
        else chosen.add(kid.id);
        paint();
      });
      return button;
    }),
  );
  const dialog = $("rollcall-dialog");
  $("rollcall-save").onclick = () => {
    dialog.close();
    onSave([...chosen]);
  };
  $("rollcall-cancel").onclick = () => dialog.close();
  dialog.showModal();
}

export function bind(handlers) {
  for (const listId of ["on-field", "bench", "away"]) {
    $(listId).addEventListener("click", (event) => {
      const button = event.target.closest("button");
      const row = event.target.closest(".kid");
      if (!button || !row) return;
      handlers.kidAction(row.dataset.kid, button.dataset.action);
    });
  }
  $("help-open").addEventListener("click", () => {
    $("help").showModal();
    $("help-title").focus(); // open at the top, not at the first button
  });
  $("help-close").addEventListener("click", () => $("help").close());
  $("clock-toggle").addEventListener("click", handlers.toggleClock);
  $("pending-confirm").addEventListener("click", handlers.confirmSub);
  $("pending-cancel").addEventListener("click", handlers.cancelSub);
  $("undo").addEventListener("click", handlers.undo);
  $("rollcall").addEventListener("click", handlers.rollCall);
  $("end-game").addEventListener("click", handlers.endOrReset);
  $("note-save").addEventListener("click", () => {
    const box = $("note-text");
    if (box.value.trim()) handlers.note(box.value.trim());
    box.value = "";
  });
  // change, not input: it fires on blur or Enter, so a name is saved once when
  // the coach is done with it rather than on every keystroke.
  $("roster-edit").addEventListener("change", (event) => {
    const row = event.target.closest(".roster-row");
    const name = event.target.dataset.field;
    if (!row || !name) return;
    const saved = handlers.editKid(row.dataset.kid, name, event.target.value);
    // The handler returns what it stored, so the field shows the trimmed
    // value it will actually be remembered by.
    if (typeof saved !== "string") return;
    event.target.value = saved;
    if (name === "name") relabel(row, saved);
  });
  $("add-kid").addEventListener("click", () => {
    if (handlers.addKid($("add-name").value, $("add-jersey").value)) {
      $("add-name").value = "";
      $("add-jersey").value = "";
      $("add-name").focus(); // adding a roster is a run of several
    }
  });
  $("new-game").addEventListener("click", handlers.newGame);
  $("export").addEventListener("click", handlers.exportGame);
  $("load-example").addEventListener("click", handlers.loadExample);
  $("import-file").addEventListener("change", (event) => {
    const [file] = event.target.files;
    // Clear the input: without this, picking the same file again fires no
    // change event at all, so a second attempt looks like nothing happened.
    event.target.value = "";
    if (file) handlers.importConfig(file);
  });
}

// The roster editor lives in Setup rather than over the game lists: those rows
// are buttons, they re-sort by who is owed time, and the one-second repaint
// would eat a half-typed name. Painted on demand, never on the clock.
export function renderRoster(roster) {
  $("roster-edit").replaceChildren(
    ...roster.map((kid) => {
      const li = document.createElement("li");
      li.className = "roster-row";
      li.dataset.kid = kid.id;
      const jersey = field("jersey", kid.jersey ?? "");
      jersey.inputMode = "numeric";
      jersey.maxLength = 4;
      li.append(jersey, field("name", kid.name));
      relabel(li, kid.name);
      return li;
    }),
  );
}

// Both labels name the child, so both have to follow a rename — the editor is
// deliberately not repainted on an edit (it would take the focus with it), so
// a screen reader would otherwise keep announcing the old name.
function relabel(row, name) {
  row.querySelector(".jersey-input").setAttribute("aria-label", `Jersey number for ${name}`);
  row.querySelector(".name-input").setAttribute("aria-label", `Name for ${name}`);
}

// The aria-label is left to relabel(), which is also what a rename calls.
function field(name, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = `${name}-input`;
  input.dataset.field = name;
  input.value = value;
  input.autocomplete = "off";
  return input;
}

export function setRosterStatus(text) {
  $("roster-status").textContent = text;
}

// In-page dialogs, not window.confirm, for the same reason the import one is:
// an installed app can have native dialogs suppressed, and a suppressed
// confirm reads as "no" with nothing on screen to say why.
function confirmDanger(name, warning, onYes, declinedWith) {
  const dialog = $(`${name}-confirm`);
  $(`${name}-warning`).textContent = warning;
  $(`${name}-yes`).onclick = () => {
    dialog.close();
    onYes();
  };
  const declined = () => setRosterStatus(declinedWith);
  $(`${name}-no`).onclick = () => {
    dialog.close();
    declined();
  };
  // Escape, or a platform back gesture, closes it without either button —
  // still a decline, and it should say so.
  dialog.oncancel = declined;
  dialog.showModal();
}

export function confirmNewGame(warning, onYes) {
  confirmDanger("new-game", warning, onYes, "Kept the game you had.");
}

export function confirmReset(warning, onYes) {
  confirmDanger("reset", warning, onYes, "Kept the team and the game.");
}

export function setImportStatus(text) {
  $("import-status").textContent = text;
}

// An in-page dialog, not window.confirm: an installed app can have native
// dialogs suppressed, and a suppressed confirm reads as "false" — which
// silently cancelled the import with nothing on screen to explain it.
export function confirmImport(onYes) {
  const dialog = $("import-confirm");
  $("import-confirm-yes").onclick = () => {
    dialog.close();
    onYes();
  };
  const declined = () => setImportStatus("Kept the game in progress.");
  $("import-confirm-no").onclick = () => {
    dialog.close();
    declined();
  };
  // Escape, or a platform back gesture, closes the dialog without either
  // button — that is still a decline and should say so.
  dialog.oncancel = declined;
  dialog.showModal();
  $("import-confirm-title").focus();
}

export function showText(text) {
  const box = $("note-text");
  box.value = text;
  box.focus();
  box.select();
}

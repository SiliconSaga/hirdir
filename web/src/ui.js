// Renders a view model into the page. No arithmetic, no state.

const $ = (id) => document.getElementById(id);

function markButton(action, label, { set = false, aria = null } = {}) {
  const button = document.createElement("button");
  button.dataset.action = action;
  button.textContent = label;
  if (set) button.className = "set";
  if (aria) button.setAttribute("aria-label", aria);
  return button;
}

function kidRow(kid, { onField }) {
  const li = document.createElement("li");
  li.className = onField ? "kid" : kid.owed ? "kid owed" : "kid";
  li.dataset.kid = kid.id;

  const main = document.createElement("button");
  main.className = "kid-main";
  main.dataset.action = onField ? "off" : "on";
  for (const [className, text] of [
    ["jersey", kid.jersey ?? ""],
    ["name", kid.name],
    ["meta", onField ? kid.stint : `${kid.deficit} min`],
  ]) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    main.append(span);
  }

  // Four marks per row, no more: a kid on the bench cannot score, and a kid on
  // the field is plainly here. Five buttons overflowed the card on a phone.
  const marks = document.createElement("span");
  marks.className = "marks";
  marks.append(
    onField
      ? markButton("goal", `⚽${kid.goals || ""}`, { aria: `Goal for ${kid.name}` })
      : markButton("absent", "A", { aria: `${kid.name} is not here today` }),
    markButton("star", "★", { set: kid.flags.includes("star"), aria: `Doing great: ${kid.name}` }),
    markButton("shy", "shy", { set: kid.flags.includes("shy") }),
    markButton("help", "help", { set: kid.flags.includes("help") }),
  );

  li.append(main, marks);
  return li;
}

export function render(view) {
  $("clock").textContent = view.clock;
  $("clock-toggle").textContent = view.running ? "Pause" : "Start";
  $("count").textContent = view.countLabel;
  $("count").classList.toggle("warn", view.countWarning);
  $("undo").disabled = !view.canUndo;

  $("on-field").replaceChildren(...view.onField.map((kid) => kidRow(kid, { onField: true })));
  $("bench").replaceChildren(...view.bench.map((kid) => kidRow(kid, { onField: false })));

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
      button.className = chosen.has(kid.id) ? "on" : "";
      button.addEventListener("click", () => {
        if (chosen.has(kid.id)) chosen.delete(kid.id);
        else chosen.add(kid.id);
        button.classList.toggle("on", chosen.has(kid.id));
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
  for (const listId of ["on-field", "bench"]) {
    $(listId).addEventListener("click", (event) => {
      const button = event.target.closest("button");
      const row = event.target.closest(".kid");
      if (!button || !row) return;
      handlers.kidAction(row.dataset.kid, button.dataset.action);
    });
  }
  $("clock-toggle").addEventListener("click", handlers.toggleClock);
  $("pending-confirm").addEventListener("click", handlers.confirmSub);
  $("pending-cancel").addEventListener("click", handlers.cancelSub);
  $("undo").addEventListener("click", handlers.undo);
  $("rollcall").addEventListener("click", handlers.rollCall);
  $("end-game").addEventListener("click", handlers.endGame);
  $("note-save").addEventListener("click", () => {
    const box = $("note-text");
    if (box.value.trim()) handlers.note(box.value.trim());
    box.value = "";
  });
  $("export").addEventListener("click", handlers.exportGame);
  $("import-file").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) handlers.importConfig(file);
  });
}

export function showText(text) {
  const box = $("note-text");
  box.value = text;
  box.focus();
  box.select();
}

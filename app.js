(() => {
  const LS = "labelwod-v1";
  const CIRC = 2 * Math.PI * 54;

  const SEED = [
    "Ø§Ø³Ú©ÙˆØ§Øª Ø¬Ø§Ù…Ù¾",
    "Ø¨Ø±Ù¾ÛŒ",
    "Ø´Ù†Ø§ Ø³ÙˆØ¦Ø¯ÛŒ",
    "Ù„Ø§Ù†Ú¯Ø² Ù…ØªÙ†Ø§ÙˆØ¨",
    "Ù¾Ù„Ø§Ù†Ú©",
    "Ú©Ø±Ø§Ù†Ú†",
    "Ú©ÙˆÙ‡Ù†ÙˆØ±Ø¯",
    "Ø¬Ø§Ù…Ù¾ÛŒÙ†Ú¯ Ø¬Ú©",
    "Ù†Ø´Ø± Ø¬Ø§Ù†Ø¨",
    "Ø§Ø³Ú©ÙˆØ§Øª Ù‡ÙˆØ§ÛŒÛŒ",
    "Ø¯ÛŒÙˆØ§Ø±Ù†Ø´ÛŒÙ†ÛŒ",
    "Ø­Ø±Ú©Øª Ù¾Ø±ÙˆØ§Ù†Ù‡",
    "Ú©Ø´Ø´ Ù‡Ù…Ø³ØªØ±ÛŒÙ†Ú¯",
    "Ú©ØªÙ„â€ŒØ¨Ù„ Ø³ÙˆØ¦ÛŒÙ†Ú¯",
    "Ø±ÙˆØ¦ÛŒÙ†Ú¯",
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function load() {
    try {
      return JSON.parse(localStorage.getItem(LS)) || { moves: [], wods: [] };
    } catch {
      return { moves: [], wods: [] };
    }
  }
  function save(st) {
    localStorage.setItem(LS, JSON.stringify(st));
  }

  let state = load();
  let editId = null;
  let seq = []; // {moveId, name, work, rest} rest null = use default
  let run = null;
  let raf = 0;

  const views = {
    home: $("#view-home"),
    moves: $("#view-moves"),
    edit: $("#view-edit"),
    run: $("#view-run"),
    done: $("#view-done"),
  };

  function show(name) {
    Object.entries(views).forEach(([k, el]) => el.classList.toggle("on", k === name));
    $$("#navTabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === name));
    $("#tabEdit").hidden = name !== "edit";
    $("#topBar").style.display = name === "run" ? "none" : "";
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function beep(kind) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = kind === "rest" ? 440 : kind === "end" ? 660 : 880;
      g.gain.value = 0.05;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.stop(ctx.currentTime + 0.26);
      setTimeout(() => ctx.close(), 400);
    } catch {}
  }

  /* -------- Moves -------- */
  function renderMoves() {
    const ul = $("#moveList");
    ul.innerHTML = "";
    if (!state.moves.length) return;
    state.moves.forEach((m) => {
      const li = document.createElement("li");
      li.innerHTML = `<div><span class="title"></span></div><div class="ops"></div>`;
      li.querySelector(".title").textContent = m.name;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn danger";
      del.textContent = "Ø­Ø°Ù";
      del.onclick = () => {
        if (!confirm("Ø­Ø°Ù Ø§ÛŒÙ† Ø­Ø±Ú©ØªØŸ")) return;
        state.moves = state.moves.filter((x) => x.id !== m.id);
        save(state);
        renderMoves();
        renderPick();
      };
      li.querySelector(".ops").append(del);
      ul.append(li);
    });
  }

  $("#moveForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#moveName").value.trim();
    if (!name) return;
    if (state.moves.some((m) => m.name === name)) {
      alert("Ø§ÛŒÙ† Ù†Ø§Ù… Ø§Ø² Ù‚Ø¨Ù„ Ù‡Ø³Øª");
      return;
    }
    state.moves.push({ id: uid(), name });
    save(state);
    $("#moveName").value = "";
    renderMoves();
    renderPick();
  };

  $("#btnSeed").onclick = () => {
    SEED.forEach((name) => {
      if (!state.moves.some((m) => m.name === name)) {
        state.moves.push({ id: uid(), name });
      }
    });
    save(state);
    renderMoves();
    renderPick();
  };

  /* -------- WOD list -------- */
  function renderWods() {
    const ul = $("#wodList");
    ul.innerHTML = "";
    state.wods
      .slice()
      .sort((a, b) => b.updated - a.updated)
      .forEach((w) => {
        const li = document.createElement("li");
        const left = document.createElement("div");
        left.innerHTML = `<span class="title"></span><span class="meta"></span>`;
        const names = w.seq.map((s) => s.name);
        const title =
          names.length <= 3
            ? names.join(" Â· ")
            : names.slice(0, 3).join(" Â· ") + " +" + (names.length - 3);
        left.querySelector(".title").textContent = title || "ØªÙ…Ø±ÛŒÙ†";
        left.querySelector(".meta").textContent =
          w.seq.length + " Ø­Ø±Ú©Øª Â· " + w.defWork + "Ø« / " + w.defRest + "Ø«";
        const ops = document.createElement("div");
        ops.className = "ops";
        const start = document.createElement("button");
        start.className = "btn primary";
        start.textContent = "Ø´Ø±ÙˆØ¹";
        start.onclick = () => startRun(w.id);
        const edit = document.createElement("button");
        edit.className = "btn";
        edit.textContent = "ÙˆÛŒØ±Ø§ÛŒØ´";
        edit.onclick = () => openEdit(w.id);
        const del = document.createElement("button");
        del.className = "btn danger";
        del.textContent = "Ø­Ø°Ù";
        del.onclick = () => {
          if (!confirm("Ø­Ø°ÙØŸ")) return;
          state.wods = state.wods.filter((x) => x.id !== w.id);
          save(state);
          renderWods();
        };
        ops.append(start, edit, del);
        li.append(left, ops);
        ul.append(li);
      });
  }

  /* -------- Edit -------- */
  function openEdit(id) {
    editId = id || null;
    seq = [];
    if (id) {
      const w = state.wods.find((x) => x.id === id);
      if (!w) return;
      $("#defWork").value = w.defWork;
      $("#defRest").value = w.defRest;
      $("#restAfterLast").value = w.restAfterLast ? "1" : "0";
      seq = w.seq.map((s) => ({ ...s }));
    } else {
      $("#defWork").value = 40;
      $("#defRest").value = 20;
      $("#restAfterLast").value = "0";
    }
    renderPick();
    renderSeq();
    show("edit");
  }

  function renderPick() {
    const box = $("#pickMoves");
    box.innerHTML = "";
    if (!state.moves.length) return;
    state.moves.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = "+ " + m.name;
      b.onclick = () => {
        const work = Number($("#defWork").value) || 40;
        const rest = Number($("#defRest").value) || 0;
        seq.push({ moveId: m.id, name: m.name, work, rest });
        renderSeq();
      };
      box.append(b);
    });
  }

  function renderSeq() {
    const ol = $("#seqList");
    ol.innerHTML = "";
    seq.forEach((s, i) => {
      const li = document.createElement("li");
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = s.name;
      const timing = document.createElement("div");
      timing.className = "timing";
      timing.innerHTML = `
        <label class="lbl">Ú©Ø§Ø± (Ø«)
          <input type="number" min="5" max="600" data-k="work" value="${s.work}"/>
        </label>
        <label class="lbl">Ø§Ø³ØªØ±Ø§Ø­Øª Ø¨Ø¹Ø¯Ø´ (Ø«)
          <input type="number" min="0" max="300" data-k="rest" value="${s.rest}"/>
        </label>`;
      timing.querySelectorAll("input").forEach((inp) => {
        inp.onchange = () => {
          s[inp.dataset.k] = Number(inp.value) || 0;
        };
      });
      const row = document.createElement("div");
      row.className = "row";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "btn";
      up.textContent = "Ø¨Ø§Ù„Ø§";
      up.disabled = i === 0;
      up.onclick = () => {
        [seq[i - 1], seq[i]] = [seq[i], seq[i - 1]];
        renderSeq();
      };
      const down = document.createElement("button");
      down.type = "button";
      down.className = "btn";
      down.textContent = "Ù¾Ø§ÛŒÛŒÙ†";
      down.disabled = i === seq.length - 1;
      down.onclick = () => {
        [seq[i + 1], seq[i]] = [seq[i], seq[i + 1]];
        renderSeq();
      };
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn danger";
      rm.textContent = "Ø­Ø°Ù Ø§Ø² Ù„ÛŒØ³Øª";
      rm.onclick = () => {
        seq.splice(i, 1);
        renderSeq();
      };
      row.append(up, down, rm);
      li.append(name, timing, row);
      ol.append(li);
    });
  }

  $("#btnNewWod").onclick = () => openEdit(null);
  $("#btnCancelEdit").onclick = () => {
    show("home");
    renderWods();
  };
  $("#btnSaveWod").onclick = () => {
    if (!seq.length) {
      alert("Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ø­Ø±Ú©Øª");
      return;
    }
    const payload = {
      id: editId || uid(),
      name: "",
      defWork: Number($("#defWork").value) || 40,
      defRest: Number($("#defRest").value) || 0,
      restAfterLast: $("#restAfterLast").value === "1",
      seq: seq.map((s) => ({
        moveId: s.moveId,
        name: s.name,
        work: Number(s.work) || 40,
        rest: Number(s.rest) || 0,
      })),
      updated: Date.now(),
    };
    const ix = state.wods.findIndex((w) => w.id === payload.id);
    if (ix >= 0) state.wods[ix] = payload;
    else state.wods.push(payload);
    save(state);
    show("home");
    renderWods();
  };

  /* -------- Runner -------- */
  function buildTimeline(w) {
    const steps = [];
    w.seq.forEach((s, i) => {
      steps.push({
        kind: "work",
        name: s.name,
        seconds: s.work || w.defWork,
        index: i,
        total: w.seq.length,
        nextName: w.seq[i + 1] ? w.seq[i + 1].name : null,
      });
      const isLast = i === w.seq.length - 1;
      const restSec = s.rest != null ? s.rest : w.defRest;
      if (restSec > 0 && (!isLast || w.restAfterLast)) {
        steps.push({
          kind: "rest",
          name: s.name,
          seconds: restSec,
          index: i,
          total: w.seq.length,
          nextName: w.seq[i + 1] ? w.seq[i + 1].name : null,
        });
      }
    });
    return steps;
  }

  function startRun(id) {
    const w = state.wods.find((x) => x.id === id);
    if (!w || !w.seq.length) return;
    const steps = buildTimeline(w);
    run = {
      wod: w,
      steps,
      i: 0,
      startedAt: performance.now(),
      pausedAt: null,
      pausedTotal: 0,
      playing: true,
    };
    renderRunQueue();
    paintRun(true);
    show("run");
    cancelAnimationFrame(raf);
    tick();
    beep("work");
  }

  function renderRunQueue() {
    const ol = $("#runQueue");
    ol.innerHTML = "";
    run.wod.seq.forEach((s, i) => {
      const li = document.createElement("li");
      const step = run.steps[run.i];
      if (step && i < step.index) li.className = "done";
      if (step && i === step.index) li.className = "now";
      li.innerHTML = `<span></span><span></span>`;
      li.children[0].textContent = i + 1 + ". " + s.name;
      li.children[1].textContent = s.work + "Ø« / Ø§Ø³ØªØ±Ø§Ø­Øª " + s.rest + "Ø«";
      ol.append(li);
    });
  }

  function currentElapsed() {
    if (!run) return 0;
    const now = run.pausedAt != null ? run.pausedAt : performance.now();
    return (now - run.startedAt - run.pausedTotal) / 1000;
  }

  function paintRun(forceBeep) {
    if (!run) return;
    const step = run.steps[run.i];
    if (!step) {
      finishRun();
      return;
    }
    const elapsed = Math.min(currentElapsed(), step.seconds);
    const phase = $("#phaseBadge");
    phase.textContent = step.kind === "work" ? "Ú©Ø§Ø±" : "Ø§Ø³ØªØ±Ø§Ø­Øª";
    phase.className = "phase " + step.kind;
    $("#curMove").textContent =
      step.kind === "work" ? step.name : "Ø§Ø³ØªØ±Ø§Ø­Øª";
    if (step.kind === "rest" && step.nextName) {
      $("#nextMove").textContent = "Ø­Ø±Ú©Øª Ø¨Ø¹Ø¯ÛŒ: " + step.nextName;
    } else if (step.kind === "work" && step.nextName) {
      $("#nextMove").textContent = "Ø¨Ø¹Ø¯ÛŒ: " + step.nextName;
    } else if (step.kind === "work") {
      $("#nextMove").textContent = "Ø¢Ø®Ø±ÛŒÙ† Ø­Ø±Ú©Øª";
    } else {
      $("#nextMove").textContent = "Ù¾Ø§ÛŒØ§Ù† Ù†Ø²Ø¯ÛŒÚ© Ø§Ø³Øª";
    }
    $("#runProgress").textContent =
      "Ø­Ø±Ú©Øª " + (step.index + 1) + " Ø§Ø² " + step.total;
    $("#elapsed").textContent = fmt(elapsed);
    $("#target").textContent = "/ " + fmt(step.seconds);
    const ring = $("#ringFg");
    ring.classList.toggle("rest", step.kind === "rest");
    const p = step.seconds ? elapsed / step.seconds : 1;
    ring.style.strokeDashoffset = String(CIRC * (1 - Math.min(1, p)));
    if (forceBeep) renderRunQueue();
  }

  function advance() {
    run.i += 1;
    run.startedAt = performance.now();
    run.pausedTotal = 0;
    run.pausedAt = null;
    if (run.i >= run.steps.length) {
      finishRun();
      return;
    }
    beep(run.steps[run.i].kind === "rest" ? "rest" : "work");
    paintRun(true);
  }

  function tick() {
    if (!run || !run.playing) return;
    const step = run.steps[run.i];
    if (!step) {
      finishRun();
      return;
    }
    paintRun(false);
    if (currentElapsed() >= step.seconds) {
      advance();
    }
    raf = requestAnimationFrame(tick);
  }

  function finishRun() {
    cancelAnimationFrame(raf);
    beep("end");
    run = null;
    show("done");
  }

  $("#btnPause").onclick = () => {
    if (!run) return;
    if (run.playing) {
      run.playing = false;
      run.pausedAt = performance.now();
      $("#btnPause").textContent = "Ø§Ø¯Ø§Ù…Ù‡";
      cancelAnimationFrame(raf);
    } else {
      run.pausedTotal += performance.now() - run.pausedAt;
      run.pausedAt = null;
      run.playing = true;
      $("#btnPause").textContent = "ØªÙˆÙ‚Ù";
      tick();
    }
  };

  $("#btnSkip").onclick = () => {
    if (!run) return;
    if (!run.playing) {
      run.pausedTotal += performance.now() - run.pausedAt;
      run.pausedAt = null;
      run.playing = true;
      $("#btnPause").textContent = "ØªÙˆÙ‚Ù";
    }
    advance();
    cancelAnimationFrame(raf);
    tick();
  };

  $("#btnStop").onclick = () => {
    if (!confirm("ØªÙ…Ø±ÛŒÙ† Ù‚Ø·Ø¹ Ø´ÙˆØ¯ØŸ")) return;
    cancelAnimationFrame(raf);
    run = null;
    show("home");
    renderWods();
  };

  $("#btnBackHome").onclick = () => {
    show("home");
    renderWods();
  };

  /* -------- Nav -------- */
  $$("#navTabs button").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.view === "edit") return;
      show(b.dataset.view);
      if (b.dataset.view === "home") renderWods();
      if (b.dataset.view === "moves") renderMoves();
    };
  });

  /* -------- PWA -------- */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  renderMoves();
  renderWods();
  show("home");
})();

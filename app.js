(() => {
  const LS = "mojdei-v1";
  const CIRC = 2 * Math.PI * 54;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function load() {
    try {
      const cur = JSON.parse(localStorage.getItem(LS));
      if (cur) return cur;
    } catch {}
    // مهاجرت از نسخه قبلی
    try {
      const old = JSON.parse(localStorage.getItem("labelwod-v1"));
      if (old) {
        localStorage.setItem(LS, JSON.stringify(old));
        return old;
      }
    } catch {}
    return { moves: [], wods: [] };
  }
  function save(st) {
    localStorage.setItem(LS, JSON.stringify(st));
  }

  let state = load();
  let editId = null;
  let seq = [];
  let run = null;
  let raf = 0;

  const viewIds = ["home", "edit", "run", "done"];

  function show(name) {
    viewIds.forEach((k) => {
      const el = document.getElementById("view-" + k);
      if (!el) return;
      if (k === name) el.classList.add("on");
      else el.classList.remove("on");
    });
    $$("#navTabs button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-view") === name);
    });
    const tabEdit = document.getElementById("tabEdit");
    if (tabEdit) tabEdit.hidden = name !== "edit";
    const topBar = document.getElementById("topBar");
    if (topBar) topBar.style.display = name === "run" ? "none" : "";
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

  function addMoveToSeq(m) {
    const work = Number(($("#defWork") || {}).value) || 40;
    const rest = Number(($("#defRest") || {}).value) || 0;
    seq.push({ moveId: m.id, name: m.name, work, rest });
    renderSeq();
  }

  function removeMove(id) {
    if (!confirm("این حرکت از فهرست سریع حذف شود؟")) return;
    state.moves = state.moves.filter((x) => x.id !== id);
    save(state);
    renderPick();
  }

  function renderWods() {
    const ul = $("#wodList");
    if (!ul) return;
    ul.innerHTML = "";
    state.wods
      .slice()
      .sort((a, b) => b.updated - a.updated)
      .forEach((w) => {
        const li = document.createElement("li");
        const left = document.createElement("div");
        left.innerHTML = '<span class="title"></span><span class="meta"></span>';
        const names = w.seq.map((s) => s.name);
        const title =
          names.length <= 3
            ? names.join(" · ")
            : names.slice(0, 3).join(" · ") + " +" + (names.length - 3);
        left.querySelector(".title").textContent = title || "—";
        left.querySelector(".meta").textContent =
          w.seq.length + " حرکت · " + w.defWork + "ث / " + w.defRest + "ث";
        const ops = document.createElement("div");
        ops.className = "ops";
        const start = document.createElement("button");
        start.className = "btn primary sm";
        start.textContent = "شروع";
        start.onclick = () => startRun(w.id);
        const edit = document.createElement("button");
        edit.className = "btn sm";
        edit.textContent = "ویرایش";
        edit.onclick = () => openEdit(w.id);
        const del = document.createElement("button");
        del.className = "btn danger sm";
        del.textContent = "حذف";
        del.onclick = () => {
          if (!confirm("حذف؟")) return;
          state.wods = state.wods.filter((x) => x.id !== w.id);
          save(state);
          renderWods();
        };
        ops.append(start, edit, del);
        li.append(left, ops);
        ul.append(li);
      });
  }

  function openEdit(id) {
    editId = id || null;
    seq = [];
    if (id) {
      const w = state.wods.find((x) => x.id === id);
      if (!w) return;
      const dw = $("#defWork");
      const dr = $("#defRest");
      if (dw) dw.value = String(w.defWork);
      if (dr) dr.value = String(w.defRest);
      seq = w.seq.map((s) => ({ ...s }));
    } else {
      const dw = $("#defWork");
      const dr = $("#defRest");
      if (dw) dw.value = "40";
      if (dr) dr.value = "20";
    }
    const moveInput = $("#moveName");
    if (moveInput) moveInput.value = "";
    renderPick();
    renderSeq();
    show("edit");
    try {
      window.scrollTo(0, 0);
    } catch {}
  }

  function renderPick() {
    const box = $("#pickMoves");
    if (!box) return;
    box.innerHTML = "";
    state.moves.forEach((m) => {
      const wrap = document.createElement("div");
      wrap.className = "chip-wrap";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = "+ " + m.name;
      b.onclick = () => addMoveToSeq(m);
      const x = document.createElement("button");
      x.type = "button";
      x.className = "chip-x";
      x.setAttribute("aria-label", "حذف");
      x.textContent = "×";
      x.onclick = () => removeMove(m.id);
      wrap.append(b, x);
      box.append(wrap);
    });
  }

  function renderSeq() {
    const ol = $("#seqList");
    if (!ol) return;
    ol.innerHTML = "";
    seq.forEach((s, i) => {
      const li = document.createElement("li");
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = s.name;
      const timing = document.createElement("div");
      timing.className = "timing";
      timing.innerHTML =
        '<label class="lbl">تمرین (ث)<input type="number" min="5" max="600" data-k="work" value="' +
        s.work +
        '"/></label>' +
        '<label class="lbl">استراحت بعدش (ث)<input type="number" min="0" max="300" data-k="rest" value="' +
        s.rest +
        '"/></label>';
      timing.querySelectorAll("input").forEach((inp) => {
        inp.onchange = () => {
          s[inp.dataset.k] = Number(inp.value) || 0;
        };
      });
      const row = document.createElement("div");
      row.className = "row";
      const up = document.createElement("button");
      up.type = "button";
      up.className = "btn sm";
      up.textContent = "بالا";
      up.disabled = i === 0;
      up.onclick = () => {
        const tmp = seq[i - 1];
        seq[i - 1] = seq[i];
        seq[i] = tmp;
        renderSeq();
      };
      const down = document.createElement("button");
      down.type = "button";
      down.className = "btn sm";
      down.textContent = "پایین";
      down.disabled = i === seq.length - 1;
      down.onclick = () => {
        const tmp = seq[i + 1];
        seq[i + 1] = seq[i];
        seq[i] = tmp;
        renderSeq();
      };
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn danger sm";
      rm.textContent = "حذف";
      rm.onclick = () => {
        seq.splice(i, 1);
        renderSeq();
      };
      row.append(up, down, rm);
      li.append(name, timing, row);
      ol.append(li);
    });
  }

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
      if (restSec > 0 && !isLast) {
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
    run = {
      wod: w,
      steps: buildTimeline(w),
      i: 0,
      startedAt: performance.now(),
      pausedAt: null,
      pausedTotal: 0,
      playing: true,
    };
    const bp = $("#btnPause");
    if (bp) bp.textContent = "توقف";
    renderRunQueue();
    paintRun(true);
    show("run");
    cancelAnimationFrame(raf);
    tick();
    beep("work");
  }

  function renderRunQueue() {
    const ol = $("#runQueue");
    if (!ol || !run) return;
    ol.innerHTML = "";
    run.wod.seq.forEach((s, i) => {
      const li = document.createElement("li");
      const step = run.steps[run.i];
      if (step && i < step.index) li.className = "done";
      if (step && i === step.index) li.className = "now";
      li.innerHTML = "<span></span><span></span>";
      li.children[0].textContent = i + 1 + ". " + s.name;
      li.children[1].textContent = s.work + "ث / " + s.rest + "ث";
      ol.append(li);
    });
  }

  function currentElapsed() {
    if (!run) return 0;
    const now = run.pausedAt != null ? run.pausedAt : performance.now();
    return (now - run.startedAt - run.pausedTotal) / 1000;
  }

  function paintRun(force) {
    if (!run) return;
    const step = run.steps[run.i];
    if (!step) {
      finishRun();
      return;
    }
    const elapsed = Math.min(currentElapsed(), step.seconds);
    const phase = $("#phaseBadge");
    if (phase) {
      phase.textContent = step.kind === "work" ? "تمرین" : "استراحت";
      phase.className = "phase " + step.kind;
    }
    const cur = $("#curMove");
    if (cur) cur.textContent = step.kind === "work" ? step.name : "استراحت";
    const next = $("#nextMove");
    if (next) next.textContent = step.nextName ? "بعدی: " + step.nextName : "";
    const prog = $("#runProgress");
    if (prog) prog.textContent = step.index + 1 + " / " + step.total;
    const el = $("#elapsed");
    if (el) el.textContent = fmt(elapsed);
    const tg = $("#target");
    if (tg) tg.textContent = "/ " + fmt(step.seconds);
    const ring = $("#ringFg");
    if (ring) {
      ring.classList.toggle("rest", step.kind === "rest");
      const p = step.seconds ? elapsed / step.seconds : 1;
      ring.style.strokeDashoffset = String(CIRC * (1 - Math.min(1, p)));
    }
    if (force) renderRunQueue();
  }

  function advance() {
    if (!run) return;
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
    paintRun(false);
    if (currentElapsed() >= run.steps[run.i].seconds) advance();
    raf = requestAnimationFrame(tick);
  }

  function finishRun() {
    cancelAnimationFrame(raf);
    beep("end");
    run = null;
    show("done");
  }

  function wire() {
    const btnNew = $("#btnNewWod");
    if (btnNew) {
      btnNew.onclick = function (e) {
        if (e) e.preventDefault();
        openEdit(null);
      };
    }
    const btnCancel = $("#btnCancelEdit");
    if (btnCancel) {
      btnCancel.onclick = function () {
        show("home");
        renderWods();
      };
    }
    const btnSave = $("#btnSaveWod");
    if (btnSave) {
      btnSave.onclick = function () {
        if (!seq.length) {
          alert("حداقل یک حرکت");
          return;
        }
        const payload = {
          id: editId || uid(),
          name: "",
          defWork: Number(($("#defWork") || {}).value) || 40,
          defRest: Number(($("#defRest") || {}).value) || 0,
          restAfterLast: false,
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
    }
    const moveForm = $("#moveForm");
    if (moveForm) {
      moveForm.onsubmit = function (e) {
        e.preventDefault();
        const name = ($("#moveName") || {}).value;
        const n = (name || "").trim();
        if (!n) return;
        let m = state.moves.find((x) => x.name === n);
        if (!m) {
          m = { id: uid(), name: n };
          state.moves.push(m);
          save(state);
          renderPick();
        }
        addMoveToSeq(m);
        $("#moveName").value = "";
        try {
          $("#moveName").focus();
        } catch {}
      };
    }
    $$("#navTabs button").forEach((b) => {
      b.onclick = function () {
        const v = b.getAttribute("data-view");
        if (v === "edit") return;
        show(v);
        if (v === "home") renderWods();
      };
    });
    const btnPause = $("#btnPause");
    if (btnPause) {
      btnPause.onclick = function () {
        if (!run) return;
        if (run.playing) {
          run.playing = false;
          run.pausedAt = performance.now();
          btnPause.textContent = "ادامه";
          cancelAnimationFrame(raf);
        } else {
          run.pausedTotal += performance.now() - run.pausedAt;
          run.pausedAt = null;
          run.playing = true;
          btnPause.textContent = "توقف";
          tick();
        }
      };
    }
    const btnSkip = $("#btnSkip");
    if (btnSkip) {
      btnSkip.onclick = function () {
        if (!run) return;
        if (!run.playing) {
          run.pausedTotal += performance.now() - run.pausedAt;
          run.pausedAt = null;
          run.playing = true;
          if (btnPause) btnPause.textContent = "توقف";
        }
        advance();
        cancelAnimationFrame(raf);
        tick();
      };
    }
    const btnStop = $("#btnStop");
    if (btnStop) {
      btnStop.onclick = function () {
        if (!confirm("قطع؟")) return;
        cancelAnimationFrame(raf);
        run = null;
        show("home");
        renderWods();
      };
    }
    const btnBack = $("#btnBackHome");
    if (btnBack) {
      btnBack.onclick = function () {
        show("home");
        renderWods();
      };
    }
  }

  window.Mojdei = {
    newWod: function () {
      openEdit(null);
    },
    show: show,
  };

  wire();
  renderWods();
  show("home");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=10").catch(function () {});
  }
})();

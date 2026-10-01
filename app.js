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
  let speakReady = false;

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

  function setStepper(id, value) {
    const inp = $("#" + id);
    const val = $("#" + id + "Val");
    if (inp) inp.value = String(value);
    if (val) val.textContent = String(value);
  }

  function getStepper(id, fallback) {
    return Number(($("#" + id) || {}).value) || fallback;
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

  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const voices = speechSynthesis.getVoices() || [];
    const fa =
      voices.find((v) => /^fa(-|_|$)/i.test(v.lang)) ||
      voices.find((v) => /persian|farsi|iran/i.test(v.name));
    if (fa) return fa;
    return null;
  }

  function faOnes(n) {
    return ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"][n] || String(n);
  }
  function faTeens(n) {
    return [
      "ده",
      "یازده",
      "دوازده",
      "سیزده",
      "چهارده",
      "پانزده",
      "شانزده",
      "هفده",
      "هجده",
      "نوزده",
    ][n - 10];
  }
  function faTens(n) {
    return ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"][n];
  }
  function faHundreds(n) {
    return ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"][n];
  }
  function toFaWords(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (n < 10) return faOnes(n);
    if (n < 20) return faTeens(n);
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return o ? faTens(t) + " و " + faOnes(o) : faTens(t);
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      return r ? faHundreds(h) + " و " + toFaWords(r) : faHundreds(h);
    }
    return String(n);
  }

  function speakSeconds(n) {
    if (!window.speechSynthesis) return;
    const sec = Math.max(0, Math.round(n));
    const phrase = toFaWords(sec) + " ثانیه";
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(phrase);
      const voice = pickVoice();
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || "fa-IR";
      } else {
        u.lang = "fa-IR";
      }
      u.rate = 0.9;
      u.pitch = 1;
      u.volume = 1;
      speechSynthesis.speak(u);
    } catch {}
  }

  function warmSpeech() {
    if (speakReady || !window.speechSynthesis) return;
    speakReady = true;
    try {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = function () {
        speechSynthesis.getVoices();
      };
    } catch {}
  }

  function addMoveToSeq(m) {
    const work = getStepper("defWork", 40);
    const rest = getStepper("defRest", 0);
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
    const hint = $("#wodEmptyHint");
    if (!ul) return;
    ul.innerHTML = "";
    const has = state.wods.length > 0;
    if (hint) hint.hidden = has;
    if (!has) return;
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
      setStepper("defWork", w.defWork);
      setStepper("defRest", w.defRest);
      seq = w.seq.map((s) => ({ ...s }));
    } else {
      setStepper("defWork", 40);
      setStepper("defRest", 20);
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

  function makeMiniStepper(item, key, min, max, step) {
    const wrap = document.createElement("div");
    wrap.className = "stepper";
    const lbl = document.createElement("span");
    lbl.className = "stepper-lbl";
    lbl.textContent = key === "work" ? "تمرین" : "استراحت";
    const row = document.createElement("div");
    row.className = "stepper-row";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "stepper-btn";
    minus.textContent = "−";
    const val = document.createElement("div");
    val.className = "stepper-val";
    const num = document.createElement("span");
    num.textContent = String(item[key]);
    const unit = document.createElement("small");
    unit.textContent = "ث";
    val.append(num, unit);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "stepper-btn";
    plus.textContent = "+";
    function apply(delta) {
      let n = Number(item[key]) || 0;
      n = Math.max(min, Math.min(max, n + delta * step));
      item[key] = n;
      num.textContent = String(n);
    }
    minus.onclick = () => apply(-1);
    plus.onclick = () => apply(1);
    row.append(minus, val, plus);
    wrap.append(lbl, row);
    return wrap;
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
      timing.append(makeMiniStepper(s, "work", 5, 600, 5), makeMiniStepper(s, "rest", 0, 300, 5));
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

  function markSpeakPlan(step) {
    const total = step.seconds || 0;
    // سه قسمت؛ دو بار اعلام: حدود یک‌سوم و دو‌سوم مسیر
    const marks = [];
    if (total >= 12) {
      marks.push(Math.round(total / 3));
      marks.push(Math.round((2 * total) / 3));
    } else if (total >= 6) {
      marks.push(Math.max(1, Math.floor(total / 2)));
    }
    return {
      marks: marks.filter((m, i, a) => m > 0 && m < total && a.indexOf(m) === i),
      spoken: {},
    };
  }

  function maybeSpeak(remain, plan) {
    if (!plan || !plan.marks) return;
    plan.marks.forEach((m) => {
      if (!plan.spoken[m] && remain <= m + 0.35 && remain >= m - 0.35) {
        plan.spoken[m] = true;
        speakSeconds(m);
      }
    });
  }

  function startRun(id) {
    warmSpeech();
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
      speak: markSpeakPlan(steps[0]),
    };
    const bp = $("#btnPause");
    if (bp) bp.textContent = "توقف";
    renderRunQueue();
    paintRun(true);
    show("run");
    cancelAnimationFrame(raf);
    tick();
    beep("work");
    if (steps[0]) speakSeconds(steps[0].seconds);
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
    const remain = Math.max(0, step.seconds - elapsed);
    const phase = $("#phaseBadge");
    if (phase) {
      phase.textContent = step.kind === "work" ? "تمرین" : "استراحت";
      phase.className = "phase " + step.kind;
    }
    const cur = $("#curMove");
    if (cur) cur.textContent = step.kind === "work" ? step.name : "استراحت";
    const next = $("#nextMove");
    const nextCard = $("#nextCard");
    if (next) next.textContent = step.nextName || "پایان";
    if (nextCard) nextCard.classList.toggle("is-empty", !step.nextName);
    const prog = $("#runProgress");
    if (prog) prog.textContent = step.index + 1 + " / " + step.total;
    const el = $("#elapsed");
    if (el) el.textContent = fmt(remain);
    const tg = $("#target");
    if (tg) tg.textContent = "باقی‌مانده از " + fmt(step.seconds);
    const ring = $("#ringFg");
    if (ring) {
      ring.classList.toggle("rest", step.kind === "rest");
      const p = step.seconds ? elapsed / step.seconds : 1;
      ring.style.strokeDashoffset = String(CIRC * (1 - Math.min(1, p)));
    }
    maybeSpeak(remain, run.speak);
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
    const step = run.steps[run.i];
    run.speak = markSpeakPlan(step);
    beep(step.kind === "rest" ? "rest" : "work");
    speakSeconds(step.seconds);
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
    try {
      if (window.speechSynthesis) speechSynthesis.cancel();
    } catch {}
    beep("end");
    run = null;
    show("done");
  }

  function wireSteppers() {
    $$(".stepper[data-for]").forEach((box) => {
      const id = box.getAttribute("data-for");
      const min = Number(box.getAttribute("data-min")) || 0;
      const max = Number(box.getAttribute("data-max")) || 600;
      const step = Number(box.getAttribute("data-step")) || 5;
      box.querySelectorAll(".stepper-btn").forEach((btn) => {
        btn.onclick = () => {
          const dir = Number(btn.getAttribute("data-dir")) || 0;
          let n = getStepper(id, min);
          n = Math.max(min, Math.min(max, n + dir * step));
          setStepper(id, n);
        };
      });
    });
  }

  function wire() {
    wireSteppers();
    warmSpeech();
    const bindNew = (sel) => {
      const btn = $(sel);
      if (btn) {
        btn.onclick = function (e) {
          if (e) e.preventDefault();
          openEdit(null);
        };
      }
    };
    bindNew("#btnNewWod");
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
          defWork: getStepper("defWork", 40),
          defRest: getStepper("defRest", 0),
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
          try {
            if (window.speechSynthesis) speechSynthesis.cancel();
          } catch {}
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
        try {
          if (window.speechSynthesis) speechSynthesis.cancel();
        } catch {}
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
    navigator.serviceWorker.register("./sw.js?v=12").catch(function () {});
  }
})();

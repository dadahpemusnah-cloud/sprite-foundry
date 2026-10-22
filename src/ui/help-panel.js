  // src/ui/help-panel.js
  var PAGE = { foundry: "Sprite Foundry", workshop: "2.5D Workshop" };
  var el = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids.filter((k) => k !== null && k !== void 0));
    return e;
  };
  var norm = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]+/gu, " ");
  function initHelpPanel({ $: $2, mode, setMode: setMode2 }) {
    const panel = $2("#helpPanel"), body = $2("#helpBody"), btn = $2("#helpBtn");
    const st = { tab: "tutorials", query: "", from: null, open: null };
    const shown = (node) => !!node && node.getClientRects().length > 0;
    function showMe(at, page, appears) {
      const msg = $2("#helpWhere .help-note");
      if (page && page !== mode()) setMode2(page);
      const node = document.querySelector(at);
      if (!shown(node)) {
        if (msg) msg.textContent = `That part is not on screen yet: it appears ${appears || "later in the workflow"}.`;
        return false;
      }
      if (msg) msg.textContent = "";
      if (window.matchMedia("(max-width: 720px)").matches) close(false);
      node.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      node.classList.add("help-flash");
      setTimeout(() => node.classList.remove("help-flash"), 2200);
      return true;
    }
    const chips = (list) => list.map((c) => el("span", { className: "help-chip", textContent: c.label }));
    const showBtn = (at, page, appears, what) => {
      const b = el("button", { type: "button", textContent: "Show me" });
      b.setAttribute("aria-label", `Show me ${what}`);
      b.addEventListener("click", () => showMe(at, page, appears));
      return b;
    };
    const line = (k, text) => text ? el("p", {}, el("span", { className: "k", textContent: k + " " }), text) : null;
    function stepView(s, page) {
      return el(
        "li",
        { className: "help-step" },
        el("h4", { textContent: s.title }),
        s.appears ? el("p", { className: "hint", textContent: `Appears ${s.appears}.` }) : null,
        el("p", {}, el("span", { className: "k", textContent: "Click: " }), ...chips(s.controls)),
        line("Do:", s.do),
        line("You get:", s.expect),
        line("Watch out:", s.watch),
        line("Undo / go back:", s.undo),
        showBtn(s.go, page, s.appears, s.title)
      );
    }
    function tutorialView(t) {
      const d = el(
        "details",
        { id: "help-tut-" + t.id },
        el("summary", { textContent: `${t.title} \xB7 ${PAGE[t.mode]}` }),
        el("p", { textContent: t.intro }),
        t.note ? el("p", { className: "hint", textContent: t.note }) : null,
        el("ol", {}, ...t.steps.map((s) => stepView(s, t.mode)))
      );
      if (st.open === "help-tut-" + t.id) d.open = true;
      return d;
    }
    function manualView(m) {
      const d = el(
        "details",
        { id: "help-man-" + m.id },
        el("summary", { textContent: `${m.title} \xB7 ${PAGE[m.mode]}` }),
        el("p", { textContent: m.summary }),
        m.appears ? el("p", { className: "hint", textContent: `Appears ${m.appears}.` }) : null,
        el("dl", {}, ...m.items.flatMap((i) => [el("dt", {}, el("span", { className: "help-chip", textContent: i.label })), el("dd", { textContent: i.text })])),
        m.more ? el("p", { className: "hint", textContent: m.more }) : null,
        showBtn(m.go, m.mode, m.appears, m.title)
      );
      if (st.open === "help-man-" + m.id) d.open = true;
      return d;
    }
    const glossaryView = () => [
      el("h3", { textContent: "Glossary" }),
      el("dl", {}, ...GLOSSARY.flatMap(([t, d]) => [el("dt", { textContent: t }), el("dd", { textContent: d })])),
      el("h3", { textContent: "What the app can and cannot do" }),
      el("ul", {}, ...LIMITS.map((t) => el("li", { textContent: t })))
    ];
    const index = [
      ...TUTORIALS.flatMap((t) => t.steps.map((s) => ({ kind: "Tutorial step", title: `${t.title}: ${s.title}`, text: [s.do, s.expect, s.watch, s.undo, ...s.controls.map((c) => c.label)].join(" "), open: "help-tut-" + t.id, tab: "tutorials", go: s.go, page: t.mode, appears: s.appears }))),
      ...MANUAL.map((m) => ({ kind: "Manual", title: m.title, text: [m.summary, m.more || "", ...m.items.flatMap((i) => [i.label, i.text])].join(" "), open: "help-man-" + m.id, tab: "manual", go: m.go, page: m.mode, appears: m.appears })),
      ...GLOSSARY.map(([t, d]) => ({ kind: "Glossary", title: t, text: d, tab: "glossary" })),
      ...LIMITS.map((t) => ({ kind: "Limits", title: t.split(":")[0].split(".")[0], text: t, tab: "glossary" }))
    ];
    function search(q) {
      const words = norm(q).split(/\s+/).filter(Boolean);
      return index.filter((e) => {
        const h = norm(e.title + " " + e.text);
        return words.every((w2) => h.includes(w2));
      });
    }
    function render() {
      for (const b of document.querySelectorAll("#helpTabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === st.tab && !st.query));
      if (st.query.trim()) {
        const hits = search(st.query);
        body.replaceChildren(
          el("p", { className: "hint", textContent: hits.length ? `${hits.length} result${hits.length > 1 ? "s" : ""} for "${st.query.trim()}"` : `Nothing found for "${st.query.trim()}". Try another word, such as joint, frame or export.` }),
          ...hits.slice(0, 40).map((h) => {
            const open2 = el("button", { type: "button", textContent: "Open" });
            open2.setAttribute("aria-label", `Open ${h.title}`);
            open2.addEventListener("click", () => {
              st.query = "";
              $2("#helpSearch").value = "";
              st.tab = h.tab;
              st.open = h.open || null;
              render();
              const d = h.open && document.getElementById(h.open);
              if (d) d.scrollIntoView({ block: "start" });
            });
            return el("div", { className: "help-hit" }, el("div", { className: "t", textContent: h.kind }), el("div", { textContent: h.title }), el("p", { className: "hint", textContent: h.text.slice(0, 160) + (h.text.length > 160 ? "\u2026" : "") }), open2, h.go ? showBtn(h.go, h.page, h.appears, h.title) : null);
          })
        );
        return;
      }
      const page = mode(), order2 = (list) => [...list.filter((x) => x.mode === page), ...list.filter((x) => x.mode !== page)];
      if (st.tab === "tutorials") body.replaceChildren(el("p", { className: "hint", textContent: 'Step-by-step guides. Open one and follow along; "Show me" points at the real control.' }), ...order2(TUTORIALS).map(tutorialView));
      else if (st.tab === "manual") body.replaceChildren(el("p", { className: "hint", textContent: `Every panel and its controls, ${PAGE[page]} first.` }), ...order2(MANUAL).map(manualView));
      else body.replaceChildren(...glossaryView());
    }
    function whereNow() {
      const page = mode();
      let best = null, bd = Infinity;
      for (const m of MANUAL.filter((x) => x.mode === page)) {
        const n = document.querySelector(m.go);
        if (!shown(n)) continue;
        const r = n.getBoundingClientRect(), d = r.top < 0 ? r.bottom < 0 ? Infinity : 0 : r.top;
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      return { page, scroll: window.scrollY, section: best };
    }
    function renderWhere() {
      const w2 = st.from, box = $2("#helpWhere");
      if (!w2) {
        box.replaceChildren();
        return;
      }
      const back = el("button", { type: "button", textContent: "Back to where I was" });
      back.addEventListener("click", () => {
        if (mode() !== w2.page) setMode2(w2.page);
        window.scrollTo({ top: w2.scroll });
        close(true);
      });
      const here = w2.section ? el("button", { type: "button", textContent: `Help for \u201C${w2.section.title}\u201D` }) : null;
      if (here) here.addEventListener("click", () => {
        st.query = "";
        $2("#helpSearch").value = "";
        st.tab = "manual";
        st.open = "help-man-" + w2.section.id;
        render();
        const d = document.getElementById(st.open);
        if (d) d.scrollIntoView({ block: "start" });
      });
      box.replaceChildren(el("span", { textContent: `You are in ${PAGE[w2.page]}${w2.section ? " \xB7 " + w2.section.title : ""}.` }), here, back, el("span", { className: "help-note", role: "status" }));
    }
    function open() {
      st.from = whereNow();
      renderWhere();
      render();
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      $2("#helpSearch").focus();
    }
    function close(returnFocus = true) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (returnFocus) btn.focus();
    }
    btn.addEventListener("click", () => panel.hidden ? open() : close());
    $2("#helpClose").addEventListener("click", () => close());
    $2("#helpSearch").addEventListener("input", (e) => {
      st.query = e.target.value;
      render();
    });
    for (const b of document.querySelectorAll("#helpTabs button")) b.addEventListener("click", () => {
      st.tab = b.dataset.tab;
      st.query = "";
      $2("#helpSearch").value = "";
      st.open = null;
      render();
    });
    $2("#helpTabs").addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const tabs = [...document.querySelectorAll("#helpTabs button")], i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      n.focus();
      n.click();
      e.preventDefault();
    });
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    });
    return {
      open,
      close,
      info: () => ({ open: !panel.hidden, tab: st.tab, query: st.query, from: st.from ? { page: st.from.page, section: st.from.section && st.from.section.id } : null })
    };
  }


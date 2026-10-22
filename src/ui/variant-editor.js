  // src/ui/variant-editor.js
  function createVariantEditor({ $: $2, prefix, get, set, colours, shown, onShow, say }) {
    const el2 = (id) => $2("#" + prefix + id);
    el2("Shown").addEventListener("change", (e) => onShow(e.target.value));
    const tryIt = (fn) => {
      try {
        fn();
      } catch (err) {
        say(err.message);
      }
    };
    el2("Add").addEventListener("click", () => tryIt(() => {
      const list = addVariant(get(), el2("Name").value), name = list[list.length - 1].name;
      set(list);
      el2("Name").value = "";
      onShow(name);
      say(`Added the variant ${name}: give its colours new ones below.`);
    }));
    el2("Rename").addEventListener("click", () => tryIt(() => {
      const from = shown();
      if (!from) {
        say("Choose a variant to rename.");
        return;
      }
      const list = renameVariant(get(), from, el2("Name").value), to = list.find((v, i) => get()[i].name === from).name;
      set(list);
      el2("Name").value = "";
      onShow(to);
    }));
    el2("Del").addEventListener("click", () => {
      const name = shown();
      if (!name) {
        say("Choose a variant to remove.");
        return;
      }
      set(deleteVariant(get(), name));
      onShow("");
      say(`Removed the variant ${name}. The drawing is unchanged.`);
    });
    function render() {
      const list = get(), cur2 = shown(), v = variantByName(list, cur2);
      el2("Shown").replaceChildren(new Option("The drawing (no variant)", ""), ...list.map((x) => new Option(x.name, x.name)));
      el2("Shown").value = v ? cur2 : "";
      for (const id of ["Rename", "Del"]) el2(id).disabled = !v;
      el2("Map").hidden = !v;
      if (!v) {
        el2("Map").replaceChildren();
        el2("Hint").textContent = list.length ? "Choose a variant to change its colours." : "A variant gives some colours new ones (a red team, a night version). It never changes the drawing.";
        return;
      }
      const all = [.../* @__PURE__ */ new Set([...colours(), ...Object.keys(v.map)])];
      el2("Map").replaceChildren(...all.map((c) => {
        const row = document.createElement("span");
        row.className = "var-row";
        const from = document.createElement("span");
        from.className = "var-from";
        from.style.background = c;
        from.title = c;
        const to = document.createElement("input");
        to.type = "color";
        to.value = v.map[c] || c;
        to.setAttribute("aria-label", c + " becomes");
        to.addEventListener("change", () => set(setMapping(get(), v.name, c, to.value)));
        row.append(from, document.createTextNode("\u2192"), to);
        if (v.map[c]) {
          const x = document.createElement("button");
          x.type = "button";
          x.textContent = "\xD7";
          x.setAttribute("aria-label", "Keep " + c);
          x.addEventListener("click", () => set(setMapping(get(), v.name, c, null)));
          row.append(x);
        }
        return row;
      }));
      const n = Object.keys(v.map).length;
      el2("Hint").textContent = `${v.name}: ${n} colour${n === 1 ? "" : "s"} changed; the others stay. Exports add a sheet for every variant.`;
    }
    return { render };
  }


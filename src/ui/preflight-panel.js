  // src/ui/preflight-panel.js
  var LABEL2 = { ready: "ready", attention: "needs attention", na: "not applicable" };
  var FIX_LABEL = { parts: "Open step 4", rig: "Open step 5", motion: "Open Template Motion" };
  function initPreflightPanel({ $: $2, onFix }) {
    let last = null;
    function render(result) {
      last = result;
      $2("#pfPanel").hidden = !result;
      if (!result) return;
      $2("#pfState").textContent = result.state === "ready" ? "ready to animate" : `${result.items.filter((i) => i.state === "attention").length} to look at`;
      $2("#pfState").className = "pf-state mono pf-chip " + result.state;
      $2("#pfList").replaceChildren(...result.items.map((it) => {
        const li = document.createElement("li");
        li.className = "pf-item";
        li.dataset.check = it.id;
        li.dataset.state = it.state;
        const chip = document.createElement("span");
        chip.className = "pf-chip " + it.state;
        chip.textContent = LABEL2[it.state];
        const text = document.createElement("span");
        text.className = "hint";
        const b = document.createElement("b");
        b.textContent = it.title + ": ";
        text.append(b, it.message);
        li.append(chip, text);
        if (it.fix && it.state !== "ready") {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = FIX_LABEL[it.fix.step];
          btn.setAttribute("aria-label", `${FIX_LABEL[it.fix.step]} to fix: ${it.title}`);
          btn.addEventListener("click", () => onFix(it.fix));
          li.append(btn);
        } else li.append(document.createElement("span"));
        return li;
      }));
    }
    return { render, info: () => last ? { state: last.state, items: last.items.map((i) => ({ id: i.id, state: i.state, message: i.message, fix: i.fix })) } : null };
  }


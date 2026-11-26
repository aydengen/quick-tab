(() => {
  "use strict";

  // This is a self-contained simulation, not an extension API integration.
  const en = document.documentElement.lang.startsWith("en");
  const text = en
    ? {
        titles: ["Friday side project", "Moodboard", "aydengen / quick-tab", "Deep focus"],
        alt: (title) => `Simulated tab: ${title}`,
        again: "Try again →",
        restart: "Start over →",
        switched: (title) => `Switched to “${title}”. With the extension, releasing Alt does this.`,
        cancelled: "Cancelled. You stayed on the same page.",
        hint: "Use ← → or Q to choose, Enter to confirm, Esc to cancel, or click a card",
      }
    : {
        titles: ["周五，做点喜欢的事", "下一点灵感", "aydengen / quick-tab", "Deep focus"],
        alt: (title) => `模拟标签页：${title}`,
        again: "再试一次 →",
        restart: "重新开始 →",
        switched: (title) => `已切换到「${title}」。安装后，松开 Alt 就能完成这一步`,
        cancelled: "已取消，仍留在原来的页面",
        hint: "用 ← → 或 Q 选择，Enter 确认，Esc 取消；也可以直接点击卡片",
      };
  const addresses = [
    "notes.example / my-space",
    "design.example / inspiration",
    "github.com / aydengen / quick-tab",
    "music.example / deep-focus",
  ];
  // Image paths come from the markup so the page works from any directory.
  const tabs = [...document.querySelectorAll("[data-tab] .tab-preview img")].map(
    (img, i) => ({ title: text.titles[i], address: addresses[i], image: img.getAttribute("src") })
  );
  const stage = document.querySelector("#demo-stage");
  const switcher = document.querySelector("#switcher");
  const cards = [...document.querySelectorAll("[data-tab]")];
  const start = document.querySelector("#demo-start");
  const status = document.querySelector("#demo-status");
  const page = document.querySelector("#active-page");
  const shade = document.querySelector("#demo-shade");
  const success = document.querySelector("#demo-success");
  let current = 0;
  let selected = 1;
  let open = true;

  function select(index, focus = false) {
    selected = (index + tabs.length) % tabs.length;
    cards.forEach((card, i) => {
      card.classList.toggle("is-selected", i === selected);
      card.setAttribute("aria-pressed", String(i === selected));
    });
    if (focus) cards[selected].focus();
  }

  function updateBrowser() {
    document.querySelectorAll("[data-browser-tab]").forEach((tab, i) => {
      tab.classList.toggle("is-active", i === current);
    });
    document.querySelectorAll("[data-current]").forEach((badge, i) => {
      badge.hidden = i !== current;
    });
    page.src = tabs[current].image;
    page.alt = text.alt(tabs[current].title);
    document.querySelector("#demo-address").textContent = tabs[current].address;
  }

  function closePanel(confirmed) {
    open = false;
    switcher.hidden = true;
    shade.hidden = true;
    success.hidden = !confirmed;
    start.setAttribute("aria-expanded", "false");
    start.textContent = text.again;
    status.textContent = confirmed ? text.switched(tabs[current].title) : text.cancelled;
    start.focus();
  }

  function confirm(index) {
    current = index;
    updateBrowser();
    closePanel(true);
  }

  start.addEventListener("click", () => {
    open = true;
    switcher.hidden = false;
    shade.hidden = false;
    success.hidden = true;
    start.setAttribute("aria-expanded", "true");
    status.textContent = text.hint;
    start.textContent = text.restart;
    select(current + 1, true);
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => confirm(index));
    card.addEventListener("focus", () => select(index));
  });

  stage.addEventListener("keydown", (event) => {
    if (!open || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (
      ["arrowright", "arrowleft", "arrowup", "arrowdown", "q"].includes(key)
    ) {
      event.preventDefault();
      const columns =
        getComputedStyle(switcher).gridTemplateColumns.split(" ").length;
      let next = selected;
      if (key === "arrowleft") next -= 1;
      else if (key === "arrowup") {
        if (selected >= columns) next -= columns;
      } else if (key === "arrowdown") {
        if (selected + columns < tabs.length) next += columns;
      } else next += 1;
      select(next, true);
    } else if (key === "escape") {
      event.preventDefault();
      closePanel(false);
    }
    // Enter/Space and Tab retain their native button/focus behavior.
  });

  document.querySelector("#demo-controls").hidden = false;
  updateBrowser();
})();

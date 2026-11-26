(() => {
  "use strict";

  // This is a self-contained simulation, not an extension API integration.
  const tabs = [
    {
      title: "周五，做点喜欢的事",
      address: "notes.example / my-space",
      image: "./assets/notes.svg",
    },
    {
      title: "下一点灵感",
      address: "design.example / inspiration",
      image: "./assets/design.svg",
    },
    {
      title: "aydengen / quick-tab",
      address: "github.com / aydengen / quick-tab",
      image: "./assets/code.svg",
    },
    {
      title: "Deep focus",
      address: "music.example / deep-focus",
      image: "./assets/music.svg",
    },
  ];
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
    if (focus) cards[selected].focus({ preventScroll: true });
  }

  function updateBrowser() {
    document.querySelectorAll("[data-browser-tab]").forEach((tab, i) => {
      tab.classList.toggle("is-active", i === current);
    });
    document.querySelectorAll("[data-current]").forEach((badge, i) => {
      badge.hidden = i !== current;
    });
    page.src = tabs[current].image;
    page.alt = `模拟标签页：${tabs[current].title}`;
    document.querySelector("#demo-address").textContent = tabs[current].address;
  }

  function closePanel(confirmed) {
    open = false;
    switcher.hidden = true;
    shade.hidden = true;
    success.hidden = !confirmed;
    start.setAttribute("aria-expanded", "false");
    start.textContent = "再试一次 →";
    status.textContent = confirmed
      ? `已切换到「${tabs[current].title}」。安装后，松开 Alt 就能完成这一步`
      : "已取消，仍留在原来的页面";
    start.focus({ preventScroll: true });
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
    status.textContent =
      "用 ← → 或 Q 选择，Enter 确认，Esc 取消；也可以直接点击卡片";
    start.textContent = "重新开始 →";
    select(current + 1, true);
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => confirm(index));
    card.addEventListener("focus", () => select(index));
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") select(index);
    });
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
      else if (key === "arrowup") next = Math.max(0, selected - columns);
      else if (key === "arrowdown")
        next = Math.min(tabs.length - 1, selected + columns);
      else next += 1;
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

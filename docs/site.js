(() => {
  "use strict";

  // Self-contained simulation that reacts to the real Alt+Q shortcut; it never reads real tabs.
  const en = document.documentElement.lang.startsWith("en");
  const text = en
    ? {
        titles: ["Friday side project", "Moodboard", "aydengen / quick-tab", "Deep focus"],
        alt: (title) => `Simulated tab: ${title}`,
        opened: "Switcher open. Keep pressing Q, then release Alt.",
        switched: (title) => `Switched to “${title}”`,
        cancelled: "Cancelled",
      }
    : {
        titles: ["周五，做点喜欢的事", "下一点灵感", "aydengen / quick-tab", "Deep focus"],
        alt: (title) => `模拟标签页：${title}`,
        opened: "面板已打开，继续按 Q 选择，松开 Alt 切换",
        switched: (title) => `已切换到「${title}」`,
        cancelled: "已取消",
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
  const switcher = document.querySelector("#switcher");
  const cards = [...document.querySelectorAll("[data-tab]")];
  const status = document.querySelector("#demo-status");
  const page = document.querySelector("#active-page");
  const shade = document.querySelector("#demo-shade");
  const success = document.querySelector("#demo-success");
  const keycaps = {
    alt: document.querySelector('[data-key="alt"]'),
    q: document.querySelector('[data-key="q"]'),
  };
  // Without a keyboard, keep the switcher visible so the cards can be tapped.
  const touchOnly = matchMedia("(hover: none)").matches;
  let current = 0;
  let selected = 1;
  let open = false;
  let successTimer;

  function select(index) {
    selected = (index + tabs.length) % tabs.length;
    cards.forEach((card, i) => {
      card.classList.toggle("is-selected", i === selected);
      card.setAttribute("aria-pressed", String(i === selected));
    });
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

  function show() {
    open = true;
    clearTimeout(successTimer);
    switcher.hidden = false;
    shade.hidden = false;
    success.hidden = true;
    select(current + 1);
    status.textContent = text.opened;
  }

  function hide(confirmed) {
    open = false;
    switcher.hidden = true;
    shade.hidden = true;
    success.hidden = !confirmed;
    status.textContent = confirmed ? text.switched(tabs[current].title) : text.cancelled;
    clearTimeout(successTimer);
    successTimer = setTimeout(() => {
      success.hidden = true;
      if (touchOnly) show();
    }, 1400);
  }

  function confirm(index) {
    current = index;
    updateBrowser();
    hide(true);
  }

  function press(key, down) {
    keycaps[key]?.classList.toggle("is-pressed", down);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Alt") {
      press("alt", true);
      if (open) event.preventDefault();
      return;
    }
    // event.code, because Option+Q types "œ" on a Mac.
    if (event.altKey && event.code === "KeyQ" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      press("q", true);
      if (!open) show();
      else select(selected + (event.shiftKey ? -1 : 1));
      return;
    }
    if (!open) return;
    const columns = getComputedStyle(switcher).gridTemplateColumns.split(" ").length;
    const moves = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: selected >= columns ? -columns : 0,
      ArrowDown: selected + columns < tabs.length ? columns : 0,
    };
    if (event.key in moves) select(selected + moves[event.key]);
    else if (event.key === "Enter") confirm(selected);
    else if (event.key === "Escape") hide(false);
    else return;
    event.preventDefault();
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyQ") press("q", false);
    if (event.key !== "Alt") return;
    press("alt", false);
    if (open) {
      event.preventDefault();
      confirm(selected);
    }
  });

  window.addEventListener("blur", () => {
    press("alt", false);
    press("q", false);
    if (open && !touchOnly) hide(false);
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => confirm(index));
    card.addEventListener("mouseenter", () => select(index));
    card.addEventListener("focus", () => select(index));
  });

  updateBrowser();
  if (touchOnly) show();
})();

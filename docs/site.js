(() => {
  "use strict";

  // Focus-scoped simulation: no global shortcuts and no access to real tabs.
  const en = document.documentElement.lang.startsWith("en");
  const text = en
    ? {
        titles: ["Friday side project", "Moodboard", "aydengen / quick-tab", "Deep focus"],
        alt: (title) => `Simulated tab: ${title}`,
        selected: (title) => `Selected “${title}”. Enter to switch. Esc to cancel.`,
        switched: (title) => `Switched to “${title}”`,
        cancelled: "Cancelled",
      }
    : {
        titles: ["周五，做点喜欢的事", "下一点灵感", "aydengen / quick-tab", "Deep focus"],
        alt: (title) => `模拟标签页：${title}`,
        selected: (title) => `已选择「${title}」，Enter 切换，Esc 取消。`,
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
  const stage = document.querySelector("#demo-stage");
  const shade = document.querySelector("#demo-shade");
  const success = document.querySelector("#demo-success");
  const keycaps = Object.fromEntries(
    [...stage.querySelectorAll("[data-key]")].map((button) => [button.dataset.key, button])
  );
  let current = 0;
  let selected = 0;
  let gesture = null;
  let reverse = false;
  let successTimer;

  function select(index) {
    selected = (index + tabs.length) % tabs.length;
    cards.forEach((card, i) => {
      card.classList.toggle("is-selected", i === selected);
      card.setAttribute("aria-pressed", String(i === selected));
    });
    status.textContent = text.selected(tabs[selected].title);
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

  function show(index, physicalAlt) {
    gesture = physicalAlt ? "physical" : "virtual";
    clearTimeout(successTimer);
    switcher.hidden = false;
    shade.hidden = false;
    success.hidden = true;
    press("Alt", true);
    select(index);
  }

  function cycle(backward, physicalAlt = false) {
    const step = backward ? -1 : 1;
    if (!gesture) {
      show(current + step, physicalAlt);
      return;
    }
    if (physicalAlt) gesture = "physical";
    select(selected + step);
    if (cards.includes(document.activeElement)) {
      cards[selected].focus({ preventScroll: true });
    }
  }

  function hide(confirmed) {
    gesture = null;
    if (cards.includes(document.activeElement)) stage.focus({ preventScroll: true });
    switcher.hidden = true;
    shade.hidden = true;
    resetKeys();
    success.hidden = !confirmed;
    status.textContent = confirmed ? text.switched(tabs[current].title) : text.cancelled;
    if (confirmed) {
      successTimer = setTimeout(() => { success.hidden = true; }, 1400);
    }
  }

  function confirm(index) {
    current = index;
    updateBrowser();
    hide(true);
  }

  function press(key, down) {
    const button = keycaps[key];
    button.classList.toggle("is-pressed", down);
    if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", String(down));
  }

  function resetKeys() {
    reverse = false;
    Object.keys(keycaps).forEach((key) => press(key, false));
  }

  stage.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey) return;
    if (event.key === "Alt" || event.key === "Shift") {
      press(event.key, true);
    } else if (event.code === "KeyQ") {
      event.preventDefault();
      if (event.repeat) return;
      press("KeyQ", true);
      press("Shift", reverse || event.shiftKey);
      cycle(reverse || event.shiftKey, event.altKey);
    } else if (event.key === "Escape" && gesture) {
      event.preventDefault();
      hide(false);
    } else if (event.key === "Enter" && gesture && !event.target.closest("[data-key]")) {
      event.preventDefault();
      confirm(selected);
    }
  });

  stage.addEventListener("keyup", (event) => {
    if (event.key === "Alt" && !event.altKey) {
      if (gesture === "physical") confirm(selected);
      else press("Alt", Boolean(gesture));
    } else if (event.key === "Shift") {
      press("Shift", reverse || event.shiftKey);
    } else if (event.code === "KeyQ") {
      press("KeyQ", false);
    }
  });

  function leaveDemo() {
    if (gesture) hide(false);
    else resetKeys();
  }

  window.addEventListener("blur", leaveDemo);
  stage.addEventListener("focusout", (event) => {
    if (!stage.contains(event.relatedTarget)) leaveDemo();
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => confirm(index));
    card.addEventListener("focus", () => select(index));
  });

  const keyActions = {
    Alt: () => gesture ? confirm(selected) : show(current, false),
    Shift: (event) => {
      reverse = !reverse;
      press("Shift", reverse || event.shiftKey);
    },
    KeyQ: (event) => cycle(reverse || event.shiftKey),
    Enter: () => { if (gesture) confirm(selected); },
  };
  Object.entries(keycaps).forEach(([key, button]) => {
    button.addEventListener("click", (event) => {
      if (event.detail) stage.focus({ preventScroll: true });
      keyActions[key](event);
    });
  });

  updateBrowser();
  switcher.hidden = true;
  shade.hidden = true;
})();

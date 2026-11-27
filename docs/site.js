(() => {
  "use strict";

  // Focus-scoped simulation: no global shortcuts and no access to real tabs.
  const en = document.documentElement.lang.startsWith("en");
  const text = en
    ? {
        alt: (title) => `Simulated tab: ${title}`,
        selected: (title) => `Selected “${title}”. Enter to switch. Esc to cancel.`,
        switched: (title) => `Switched to “${title}”`,
        cancelled: "Cancelled",
        guideCycle: "Hold Alt, press Q to switch",
        guideConfirm: "Press Q to keep cycling",
        guideDone: "You switched tabs!",
      }
    : {
        alt: (title) => `模拟标签页：${title}`,
        selected: (title) => `已选择「${title}」，Enter 切换，Esc 取消。`,
        switched: (title) => `已切换到「${title}」`,
        cancelled: "已取消",
        guideCycle: "按住 Alt，按 Q 切换",
        guideConfirm: "按 Q 继续选择",
        guideDone: "成功切换标签页！",
      };
  const addresses = [
    "notes.example / my-space",
    "design.example / inspiration",
    "github.com / aydengen / quick-tab",
    "music.example / deep-focus",
    "calendar.example / this-week",
    "fieldguide.example / city-walks",
  ];
  const switcher = document.querySelector("#switcher");
  const cards = [...switcher.querySelectorAll("[data-tab]")];
  const tabs = cards.map((card, i) => ({
    title: card.querySelector(".tab-title").textContent,
    address: addresses[i],
    image: card.querySelector(".tab-preview img").getAttribute("src"),
  }));
  const status = document.querySelector("#demo-status");
  const page = document.querySelector("#active-page");
  const stage = document.querySelector("#demo-stage");
  const help = document.querySelector("#demo-help");
  const guide = stage.querySelector(".demo-guide");
  const guideCopy = document.querySelector("#demo-guide-copy");
  const skip = guide.querySelector("button");
  const backdrop = document.querySelector(".demo-guide-backdrop");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const guideKey = "quicktab-demo-guide-seen";
  const shade = document.querySelector("#demo-shade");
  const success = document.querySelector("#demo-success");
  const keycaps = Object.fromEntries(
    [...stage.querySelectorAll("[data-key]")].map((button) => [button.dataset.key, button])
  );
  let current = 0;
  let selected = 0;
  let gesture = null;
  let successTimer;
  let guideAvailable = new URLSearchParams(location.search).get("guide") === "1" || !hasSeenGuide();
  let guideStep;
  let guideTimer;
  let openingPointer = false;

  function hasSeenGuide() {
    try {
      return localStorage.getItem(guideKey) === "1";
    } catch {
      return false;
    }
  }

  function rememberGuide() {
    try {
      localStorage.setItem(guideKey, "1");
    } catch {}
  }

  function showGuideStep(step, message) {
    guideStep = step;
    stage.dataset.guideStep = step;
    guideCopy.textContent = message;
  }

  function startGuide() {
    if (!guideAvailable) return false;
    guideAvailable = false;
    guide.hidden = false;
    help.hidden = true;
    stage.setAttribute("aria-describedby", guideCopy.id);
    showGuideStep("cycle", text.guideCycle);
    stage.classList.add("is-spotlight");
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    const { top, bottom } = stage.getBoundingClientRect();
    if (top < 0 || bottom > document.documentElement.clientHeight) {
      stage.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
    backdrop.hidden = false;
    stage.getBoundingClientRect();
    backdrop.classList.add("is-visible");
    scaleSpotlight();
    return true;
  }

  function scaleSpotlight() {
    const { x, y, width, height } = stage.getBoundingClientRect();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const availableWidth = 2 * Math.min(centerX, document.documentElement.clientWidth - centerX) - 16;
    const availableHeight = 2 * Math.min(centerY, document.documentElement.clientHeight - centerY);
    const fit = Math.min(1.12, availableWidth / stage.offsetWidth, availableHeight / stage.offsetHeight);
    stage.style.setProperty("--guide-scale", reducedMotion.matches || fit <= 0 ? 1 : fit);
  }

  function clearGuide() {
    guideStep = undefined;
    delete stage.dataset.guideStep;
    if (document.activeElement === skip) stage.focus({ preventScroll: true });
    stage.classList.remove("is-spotlight");
    stage.removeAttribute("aria-modal");
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-describedby", help.id);
    backdrop.hidden = true;
    guide.hidden = true;
    help.hidden = false;
  }

  function exitGuide() {
    if (!guideStep || guideStep === "closing") return;
    clearTimeout(guideTimer);
    if (gesture) hide(false);
    else resetKeys();
    guideStep = "closing";
    stage.style.removeProperty("--guide-scale");
    backdrop.classList.remove("is-visible");
    stage.getBoundingClientRect();
    const animations = [...stage.getAnimations(), ...backdrop.getAnimations()];
    Promise.allSettled(animations.map((animation) => animation.finished)).then(clearGuide);
  }

  function select(index) {
    selected = (index + tabs.length) % tabs.length;
    cards.forEach((card, i) => {
      card.classList.toggle("is-selected", i === selected);
      card.setAttribute("aria-pressed", String(i === selected));
    });
    const card = cards[selected];
    const left = card.offsetLeft;
    const right = left + card.offsetWidth;
    if (left < switcher.scrollLeft) {
      switcher.scrollLeft = left;
    } else if (right > switcher.scrollLeft + switcher.clientWidth) {
      switcher.scrollLeft = right - switcher.clientWidth;
    }
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
    if (guideStep === "done" || guideStep === "closing") return;
    if (guideStep === "cycle") {
      showGuideStep("confirm", text.guideConfirm);
      scaleSpotlight();
    }
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
    if (guideStep === "cycle" || guideStep === "confirm") {
      rememberGuide();
      showGuideStep("done", text.guideDone);
      scaleSpotlight();
      guideTimer = setTimeout(exitGuide, 950);
    }
  }

  function press(key, down) {
    const button = keycaps[key];
    button.classList.toggle("is-pressed", down);
    if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", String(down));
  }

  function resetKeys() {
    Object.keys(keycaps).forEach((key) => press(key, false));
  }

  function isQKey(event) {
    return event.key === "q" || event.key === "Q" || (event.altKey && event.code === "KeyQ");
  }

  stage.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape" && guideStep) {
      event.preventDefault();
      exitGuide();
    } else if (event.key === "Tab" && stage.classList.contains("is-spotlight")) {
      const buttons = [...stage.querySelectorAll("button")].filter((button) => button.getClientRects().length);
      const last = buttons.at(-1);
      if ((event.shiftKey && document.activeElement === stage) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : stage).focus();
      }
    } else if (event.key === "Alt") {
      press("Alt", true);
    } else if (isQKey(event)) {
      event.preventDefault();
      if (event.repeat) return;
      press("KeyQ", true);
      cycle(event.shiftKey, event.altKey);
    } else if (event.key === "Escape" && gesture) {
      event.preventDefault();
      hide(false);
    } else if (event.key === "Enter" && gesture && event.target !== skip) {
      event.preventDefault();
      confirm(selected);
    }
  });

  stage.addEventListener("keyup", (event) => {
    if (event.key === "Alt" && !event.altKey) {
      if (gesture === "physical") confirm(selected);
      else press("Alt", Boolean(gesture));
    } else if (isQKey(event)) {
      press("KeyQ", false);
    }
  });

  function leaveDemo() {
    if (guideStep) exitGuide();
    else if (gesture) hide(false);
    else resetKeys();
  }

  window.addEventListener("blur", leaveDemo);
  window.addEventListener("resize", () => {
    if (guideStep && guideStep !== "closing") scaleSpotlight();
  });
  document.addEventListener("pointerdown", (event) => {
    if (stage.contains(event.target)) return;
    openingPointer = false;
    if (guideStep) exitGuide();
  });
  stage.addEventListener("pointerdown", () => { openingPointer = guideAvailable; });
  document.addEventListener("pointerup", () => { openingPointer = false; });
  document.addEventListener("pointercancel", () => { openingPointer = false; });
  stage.addEventListener("focusin", () => {
    if (!openingPointer) startGuide();
  });
  stage.addEventListener("click", () => {
    if (startGuide()) stage.focus({ preventScroll: true });
  }, true);
  stage.addEventListener("focusout", (event) => {
    if (!stage.contains(event.relatedTarget)) leaveDemo();
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => confirm(index));
    card.addEventListener("focus", () => select(index));
  });

  const keyActions = {
    Alt: () => {
      if (gesture) confirm(selected);
      else if (!guideStep || guideStep === "cycle") show(current, false);
    },
    KeyQ: (event) => cycle(event.shiftKey),
  };
  Object.entries(keycaps).forEach(([key, button]) => {
    button.addEventListener("click", (event) => {
      if (event.detail) stage.focus({ preventScroll: true });
      keyActions[key](event);
    });
  });
  skip.addEventListener("click", () => {
    rememberGuide();
    exitGuide();
  });

  updateBrowser();
  switcher.hidden = true;
  shade.hidden = true;
})();

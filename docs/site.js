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
        guideAlt: "Press or tap Alt to get started.",
        guideCycle: "Release Alt, then press Q on its own. You can also tap Q.",
        guideConfirm: "Keep cycling with Q, or choose a card or tap Alt to switch.",
        guideDone: "You switched tabs!",
      }
    : {
        alt: (title) => `模拟标签页：${title}`,
        selected: (title) => `已选择「${title}」，Enter 切换，Esc 取消。`,
        switched: (title) => `已切换到「${title}」`,
        cancelled: "已取消",
        guideAlt: "按下或点击 Alt，开始体验。",
        guideCycle: "松开 Alt，单独按 Q 或点 Q 循环选择。",
        guideConfirm: "继续按 Q 循环选择，或点击卡片或 Alt 切换。",
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
  const spacer = document.querySelector(".demo-guide-spacer");
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
    showGuideStep("alt", text.guideAlt);
    return true;
  }

  function placeSpotlight() {
    stage.style.setProperty("--guide-width", `${spacer.clientWidth}px`);
    const width = stage.offsetWidth;
    const height = stage.offsetHeight;
    spacer.style.height = `${height}px`;
    const scale = Math.min(reducedMotion.matches ? 1 : 1.12, (innerWidth - 24) / width, (innerHeight - 24) / height);
    stage.style.transform = `translate(${(innerWidth - width * scale) / 2}px, ${(innerHeight - height * scale) / 2}px) scale(${scale})`;
  }

  function enterSpotlight() {
    showGuideStep("cycle", text.guideCycle);
    press("Alt", true);
    const { left, top, height, width } = stage.getBoundingClientRect();
    spacer.style.height = `${height}px`;
    spacer.hidden = false;
    stage.style.setProperty("--guide-width", `${width}px`);
    stage.style.transform = `translate(${left}px, ${top}px)`;
    stage.classList.add("is-spotlight");
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    document.documentElement.classList.add("demo-guide-open");
    backdrop.hidden = false;
    stage.getBoundingClientRect();
    backdrop.classList.add("is-visible");
    placeSpotlight();
    stage.focus({ preventScroll: true });
  }

  function clearGuide() {
    guideStep = undefined;
    delete stage.dataset.guideStep;
    if (document.activeElement === skip) stage.focus({ preventScroll: true });
    stage.classList.remove("is-spotlight");
    stage.style.removeProperty("transform");
    stage.style.removeProperty("--guide-width");
    stage.removeAttribute("aria-modal");
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-describedby", help.id);
    spacer.hidden = true;
    spacer.style.removeProperty("height");
    document.documentElement.classList.remove("demo-guide-open");
    backdrop.hidden = true;
    guide.hidden = true;
    help.hidden = false;
  }

  function exitGuide() {
    if (!guideStep || guideStep === "closing") return;
    clearTimeout(guideTimer);
    if (gesture) hide(false);
    else resetKeys();
    if (guideStep === "alt") {
      clearGuide();
      return;
    }
    guideStep = "closing";
    const { left, top } = spacer.getBoundingClientRect();
    stage.style.transform = `translate(${left}px, ${top}px)`;
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
    if (guideStep === "alt") {
      if (physicalAlt) enterSpotlight();
      else exitGuide();
    }
    if (guideStep === "cycle") {
      showGuideStep("confirm", text.guideConfirm);
      placeSpotlight();
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
    if (guideStep === "confirm") {
      rememberGuide();
      showGuideStep("done", text.guideDone);
      placeSpotlight();
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
      if (guideStep === "alt") enterSpotlight();
      press("Alt", true);
    } else if (isQKey(event)) {
      event.preventDefault();
      if (event.repeat) return;
      press("KeyQ", true);
      cycle(event.shiftKey, event.altKey);
    } else if (event.key === "Escape" && gesture) {
      event.preventDefault();
      hide(false);
    } else if (event.key === "Enter" && gesture) {
      event.preventDefault();
      confirm(selected);
    }
  });

  stage.addEventListener("keyup", (event) => {
    if (event.key === "Alt" && !event.altKey) {
      if (gesture === "physical") confirm(selected);
      else press("Alt", Boolean(gesture) || guideStep === "cycle");
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
    if (stage.classList.contains("is-spotlight") && guideStep !== "closing") placeSpotlight();
  });
  document.addEventListener("pointerdown", (event) => {
    if (stage.contains(event.target)) return;
    openingPointer = false;
    if (guideStep) exitGuide();
  });
  stage.addEventListener("pointerdown", () => { openingPointer = guideAvailable; });
  stage.addEventListener("pointercancel", () => { openingPointer = false; });
  stage.addEventListener("focusin", () => {
    if (startGuide() && !openingPointer) guide.scrollIntoView({ block: "nearest", behavior: "instant" });
  });
  stage.addEventListener("click", (event) => {
    if (!openingPointer && !startGuide()) return;
    openingPointer = false;
    startGuide();
    event.preventDefault();
    event.stopPropagation();
    stage.focus({ preventScroll: true });
    guide.scrollIntoView({ block: "nearest", behavior: "instant" });
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
      if (guideStep === "alt") enterSpotlight();
      else if (gesture) confirm(selected);
      else if (!guideStep) show(current, false);
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

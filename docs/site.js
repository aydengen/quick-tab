(() => {
  "use strict";

  // Page-scoped simulation: no access to real tabs.
  const en = document.documentElement.lang.startsWith("en");
  const text = en
    ? {
        alt: (title) => `Simulated tab: ${title}`,
        selected: (title) => `Selected “${title}”. Enter to switch. Esc to cancel.`,
        switched: (title) => `Switched to “${title}”`,
        cancelled: "Cancelled",
        guideCycle: "Press Q to switch tabs",
        guideConfirm: "Enter or click a card to switch",
        guideDone: "You switched tabs!",
        installReady: "Demo complete. You can now choose Add to Chrome.",
      }
    : {
        alt: (title) => `模拟标签页：${title}`,
        selected: (title) => `已选择「${title}」，Enter 切换，Esc 取消。`,
        switched: (title) => `已切换到「${title}」`,
        cancelled: "已取消",
        guideCycle: "按 Q 切换标签",
        guideConfirm: "回车或点击卡片切换",
        guideDone: "成功切换标签页！",
        installReady: "演示完成。现在可以选择「添加到 Chrome」。",
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
  const autoplayHint = help.querySelector(".autoplay-instruction");
  const guide = stage.querySelector(".demo-guide");
  const guideCopy = document.querySelector("#demo-guide-copy");
  const skip = guide.querySelector("button");
  const install = document.querySelector("#demo-install");
  const backdrop = document.querySelector(".demo-guide-backdrop");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const shade = document.querySelector("#demo-shade");
  const success = document.querySelector("#demo-success");
  const altKey = stage.querySelector('[data-key="Alt"]');
  const qKey = stage.querySelector('[data-key="KeyQ"]');
  let current = 0;
  let selected = 0;
  let gesture = null;
  let switchedTabs = false;
  let successTimer;
  let guideAvailable = new URLSearchParams(location.search).get("guide") === "1";
  let guideStep;
  let guideTimer;
  let openingPointer = false;
  let autoplayActive = false;
  let autoplayTimer;

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
    revealDemo();
    backdrop.hidden = false;
    stage.getBoundingClientRect();
    backdrop.classList.add("is-visible");
    scaleSpotlight();
    return true;
  }

  function revealDemo() {
    const { top, bottom, height } = stage.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight;
    if (top < 0 || bottom > viewportHeight) {
      stage.scrollIntoView({ block: height > viewportHeight ? "end" : "nearest", inline: "nearest", behavior: "instant" });
    }
  }

  function scaleSpotlight() {
    const { x, y, width, height } = stage.getBoundingClientRect();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const availableWidth = 2 * Math.min(centerX, document.documentElement.clientWidth - centerX) - 16;
    const availableHeight = 2 * Math.min(centerY, document.documentElement.clientHeight - centerY);
    const fit = Math.min(1.12, availableWidth / stage.offsetWidth, availableHeight / stage.offsetHeight);
    stage.style.setProperty("--guide-scale", reducedMotion.matches ? 1 : Math.max(1, fit));
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
    showInstallPrompt();
  }

  function showInstallPrompt() {
    if (!switchedTabs || !install.hidden) return;
    install.hidden = false;
    status.textContent = `${text.switched(tabs[current].title)} ${text.installReady}`;
  }

  function exitGuide() {
    if (!guideStep || guideStep === "closing") return;
    clearTimeout(guideTimer);
    if (gesture) hide(false);
    else qKey.classList.remove("is-pressed");
    guideStep = "closing";
    stage.style.removeProperty("--guide-scale");
    backdrop.classList.remove("is-visible");
    stage.getBoundingClientRect();
    const animations = [...stage.getAnimations(), ...backdrop.getAnimations()];
    Promise.allSettled(animations.map((animation) => animation.finished)).then(clearGuide);
  }

  function select(index, announce = true) {
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
    if (announce) status.textContent = text.selected(tabs[selected].title);
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

  function show(index, physicalAlt, announce = true) {
    gesture = physicalAlt ? "physical" : "virtual";
    clearTimeout(successTimer);
    switcher.hidden = false;
    shade.hidden = false;
    success.hidden = true;
    select(index, announce);
  }

  function advanceAutoplay(remaining, delay) {
    autoplayTimer = setTimeout(() => {
      if (remaining === 0) {
        confirm(selected);
        return;
      }
      select(selected + 1, false);
      advanceAutoplay(remaining - 1, remaining === 1 ? 500 : 320);
    }, delay);
  }

  function startAutoplayWhenVisible() {
    if (!autoplayActive || autoplayTimer !== undefined || document.hidden) return;
    const finishTab = 2;
    const stepsToFinish = (finishTab - selected + tabs.length) % tabs.length;
    advanceAutoplay(tabs.length + stepsToFinish, 700);
  }

  function stopAutoplay() {
    if (!autoplayActive) return false;
    autoplayActive = false;
    clearTimeout(autoplayTimer);
    autoplayTimer = undefined;
    autoplayHint.hidden = true;
    delete help.dataset.autoplay;
    qKey.classList.remove("is-pressed");
    return true;
  }

  function cycle(backward, physicalAlt = false) {
    if (guideStep === "done" || guideStep === "closing") return;
    if (stopAutoplay() && !stage.contains(document.activeElement)) {
      revealDemo();
      stage.focus({ preventScroll: true });
    }
    const step = backward ? -1 : 1;
    if (!gesture) {
      if (!guideStep && !startGuide()) revealDemo();
      if (!stage.contains(document.activeElement)) stage.focus({ preventScroll: true });
      show(current + step, physicalAlt);
      if (guideStep === "cycle") {
        showGuideStep("confirm", text.guideConfirm);
        scaleSpotlight();
      }
      return;
    }
    if (physicalAlt) gesture = "physical";
    select(selected + step);
    if (cards.includes(document.activeElement)) {
      cards[selected].focus({ preventScroll: true });
    }
  }

  function hide(confirmed) {
    stopAutoplay();
    gesture = null;
    if (cards.includes(document.activeElement)) stage.focus({ preventScroll: true });
    switcher.hidden = true;
    shade.hidden = true;
    qKey.classList.remove("is-pressed");
    success.hidden = !confirmed;
    status.textContent = confirmed ? text.switched(tabs[current].title) : text.cancelled;
    if (confirmed) {
      successTimer = setTimeout(() => { success.hidden = true; }, 1400);
    }
  }

  function confirm(index) {
    if (index !== current) switchedTabs = true;
    current = index;
    updateBrowser();
    hide(true);
    if (guideStep === "confirm") {
      showGuideStep("done", text.guideDone);
      scaleSpotlight();
      guideTimer = setTimeout(exitGuide, 950);
    } else if (!guideStep) {
      showInstallPrompt();
    }
  }

  function isQKey(event) {
    return event.key === "q" || event.key === "Q" || (event.altKey && event.code === "KeyQ");
  }

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.isComposing ||
        (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select")))) return;
    if (event.key === "Escape" && guideStep) {
      event.preventDefault();
      exitGuide();
    } else if (event.key === "Tab" && guideStep && stage.contains(target)) {
      const buttons = [...stage.querySelectorAll("button")].filter((button) => button.getClientRects().length);
      const last = buttons.at(-1);
      if ((event.shiftKey && document.activeElement === stage) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : stage).focus();
      }
    } else if (isQKey(event)) {
      event.preventDefault();
      if (event.repeat) return;
      cycle(event.shiftKey, event.altKey);
      if (gesture) qKey.classList.add("is-pressed");
    } else if (event.key === "Escape" && gesture) {
      event.preventDefault();
      hide(false);
    } else if (event.key === "Enter" && gesture && !target.closest?.("a, button:not([data-tab]), summary")) {
      event.preventDefault();
      confirm(selected);
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Alt" && !event.altKey) {
      if (gesture === "physical") confirm(selected);
    } else if (isQKey(event)) {
      qKey.classList.remove("is-pressed");
    }
  });

  function leaveDemo() {
    if (guideStep) exitGuide();
    else if (gesture) hide(false);
    else qKey.classList.remove("is-pressed");
  }

  window.addEventListener("blur", leaveDemo);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && autoplayTimer !== undefined) leaveDemo();
    else startAutoplayWhenVisible();
  });
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) stopAutoplay();
  });
  window.addEventListener("resize", () => {
    if (guideStep && guideStep !== "closing") scaleSpotlight();
  });
  document.addEventListener("pointerdown", (event) => {
    if (stage.contains(event.target)) return;
    openingPointer = false;
    leaveDemo();
  });
  stage.addEventListener("pointerdown", () => {
    stopAutoplay();
    openingPointer = guideAvailable;
  });
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
    card.addEventListener("focus", () => {
      stopAutoplay();
      select(index);
    });
  });

  altKey.addEventListener("click", () => {
    if (gesture) confirm(selected);
  });
  qKey.addEventListener("click", (event) => cycle(event.shiftKey));
  skip.addEventListener("click", exitGuide);

  updateBrowser();
  if (guideAvailable) {
    switcher.hidden = true;
    shade.hidden = true;
    return;
  }
  show(current + 1, false, false);
  if (reducedMotion.matches) return;
  autoplayActive = true;
  autoplayHint.hidden = false;
  help.dataset.autoplay = "";
  qKey.classList.add("is-pressed");
  startAutoplayWhenVisible();
})();

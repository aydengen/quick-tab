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
      }
    : {
        alt: (title) => `模拟标签页：${title}`,
        selected: (title) => `已选择「${title}」，Enter 切换，Esc 取消。`,
        switched: (title) => `已切换到「${title}」`,
        cancelled: "已取消",
        guideCycle: "按 Q 切换标签",
        guideConfirm: "回车或点击卡片切换",
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
  const altKey = stage.querySelector('[data-key="Alt"]');
  const qKey = stage.querySelector('[data-key="KeyQ"]');
  const params = new URLSearchParams(location.search);
  const variant = ["a", "b", "c"].find((option) => option === params.get("onboarding"));
  let current = 0;
  let selected = 0;
  let gesture = null;
  let successTimer;
  let guideAvailable = params.get("guide") === "1" || !hasSeenGuide();
  let guideStep;
  let guideTimer;
  let openingPointer = false;
  let replayTrigger;
  const onboarding = variant ? setupOnboarding() : null;

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
    if (guideStep || (!onboarding && !guideAvailable)) return false;
    guideAvailable = false;
    if (onboarding) {
      onboarding.confirm.hidden = true;
      onboarding.replay.setAttribute("aria-expanded", "true");
    }
    guide.hidden = false;
    help.hidden = true;
    stage.setAttribute("aria-describedby", guideCopy.id);
    showGuideStep("cycle", onboarding?.copy.cycle ?? text.guideCycle);
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
    if (onboarding) {
      onboarding.replay.setAttribute("aria-expanded", "false");
      const destination = onboarding.nextFocus ?? replayTrigger ?? onboarding.replay;
      onboarding.nextFocus = null;
      replayTrigger = null;
      if (stage.contains(document.activeElement)) destination.focus();
    }
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
    select(index);
  }

  function cycle(backward, physicalAlt = false) {
    if (guideStep === "done" || guideStep === "closing") return;
    const step = backward ? -1 : 1;
    if (!gesture) {
      if (!guideStep && !startGuide()) revealDemo();
      if (!stage.contains(document.activeElement)) stage.focus({ preventScroll: true });
      show(current + step, physicalAlt);
      if (guideStep === "cycle") {
        showGuideStep("confirm", onboarding?.copy.confirm ?? text.guideConfirm);
        if (onboarding) onboarding.confirm.hidden = false;
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
    current = index;
    updateBrowser();
    hide(true);
    if (guideStep === "confirm") {
      if (onboarding) {
        onboarding.confirm.hidden = true;
        onboarding.complete();
      } else {
        rememberGuide();
      }
      showGuideStep("done", text.guideDone);
      scaleSpotlight();
      guideTimer = setTimeout(exitGuide, 950);
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
      qKey.classList.add("is-pressed");
      cycle(event.shiftKey, event.altKey);
    } else if (event.key === "Escape" && gesture) {
      event.preventDefault();
      hide(false);
    } else if (event.key === "Enter" && gesture && event.target !== skip &&
        (!onboarding || !target.closest?.("button, a"))) {
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
  window.addEventListener("resize", () => {
    if (guideStep && guideStep !== "closing") scaleSpotlight();
  });
  document.addEventListener("pointerdown", (event) => {
    if (stage.contains(event.target)) return;
    openingPointer = false;
    leaveDemo();
  });
  stage.addEventListener("pointerdown", () => { openingPointer = guideAvailable; });
  document.addEventListener("pointerup", () => { openingPointer = false; });
  document.addEventListener("pointercancel", () => { openingPointer = false; });
  stage.addEventListener("focusin", () => {
    if (!onboarding && !openingPointer) startGuide();
  });
  stage.addEventListener("click", () => {
    if (!onboarding && startGuide()) stage.focus({ preventScroll: true });
  }, true);
  stage.addEventListener("focusout", (event) => {
    if (!stage.contains(event.relatedTarget)) leaveDemo();
  });

  cards.forEach((card, index) => {
    card.addEventListener("click", () => confirm(index));
    card.addEventListener("focus", () => select(index));
  });

  altKey.addEventListener("click", () => {
    if (gesture) confirm(selected);
  });
  qKey.addEventListener("click", (event) => cycle(event.shiftKey));
  skip.addEventListener("click", () => {
    if (!onboarding) rememberGuide();
    exitGuide();
  });

  function setupOnboarding() {
    const copy = en ? {
      preview: "Design preview", options: ["Try first", "Install first", "Step by step"],
      title: "Get back to the page you were just on.",
      replay: "Replay the demo", again: "Try again", open: "Try switching pages", close: "Close guide",
      cycle: "1. Press or click Q. Alt is already held for you.",
      confirm: "2. Click a page or use the button to switch.", switch: "Switch to this page",
      store: "Open Chrome Web Store", skip: "Skip to installation", next: "Next: Install", back: "Back",
      startOver: "Start over", after: "I've added it", before: "See what Chrome will ask you to click.",
      desktop: "Install in Chrome on a computer. On a managed account, ask a parent or administrator for help.",
      storeSteps: ["Add to Chrome", "Add extension"],
      installed: "Open two regular web pages. Hold Alt (Option ⌥ on Mac), press Q, then let go.",
      phases: ["Try", "Install", "Use"],
      a: ["Try it without installing", "Switch between sample pages. It won’t touch your real tabs.", "You switched pages. Ready to use it on your own tabs?"],
      b: ["Install in two clicks", "Chrome opens the store in a new tab. Then look for these two buttons:", "In the store", "In Chrome’s confirmation"],
      c: ["Try it once", "Use the sample pages below. You can also skip straight to installation.", "Add QuickTab to Chrome", "Try it on your own pages"],
    } : {
      preview: "方案预览", options: ["先体验", "先安装", "一步一步带着做"],
      title: "一键回到刚才看的网页。",
      replay: "重开大屏引导", again: "再练一次", open: "试着切一次网页", close: "关闭引导",
      cycle: "第 1 步：按或点 Q。Alt 已替你按住。",
      confirm: "第 2 步：点一张网页卡片，或用按钮切换。", switch: "切到这张网页",
      store: "打开 Chrome 应用商店", skip: "跳过，直接安装", next: "下一步：安装", back: "上一步",
      startOver: "从头再来", after: "我已添加", before: "先看看接下来要点哪两个按钮。",
      desktop: "请用电脑上的 Chrome 安装。若账号受限，请家长或管理员帮忙。",
      storeSteps: ["添加至 Chrome", "添加扩展程序"],
      installed: "打开两个普通网页。按住 Alt（Mac 上是 Option ⌥），按 Q，再松手。",
      phases: ["体验", "安装", "使用"],
      a: ["不用安装，先试一次", "用示例网页练习，不会碰你的真实标签页。", "切换成功。现在可以在你自己的网页上用了。"],
      b: ["打开商店后，点这两个按钮", "Chrome 会在新标签打开商店。接下来认准这两个按钮：", "在应用商店里", "在 Chrome 弹出的确认框里"],
      c: ["先试一次切换", "用下方的示例网页练习。也可以跳过，直接安装。", "把 QuickTab 添加到 Chrome", "换成你自己的网页试试"],
    };
    const hero = document.querySelector(".hero");
    const storeLink = hero.querySelector(".button-primary");
    hero.querySelector("h1").textContent = copy.title;
    hero.querySelector(".hero-intro").hidden = true;
    document.body.dataset.onboarding = variant;

    const chooser = document.createElement("nav");
    chooser.className = "onboard-chooser";
    chooser.setAttribute("aria-label", copy.preview);
    chooser.innerHTML = `<span>${copy.preview}</span>` + copy.options.map((label, i) => {
      const option = "abc"[i];
      return `<a href="?onboarding=${option}"${option === variant ? ' aria-current="page"' : ""}>${option.toUpperCase()} · ${label}</a>`;
    }).join("");
    hero.prepend(chooser);
    const languageLink = document.querySelector('.site-header [hreflang]');
    languageLink.href += `?onboarding=${variant}`;

    const install = `<a class="onboard-primary" data-install>${copy.store} <span aria-hidden="true">↗</span></a>`;
    const tryButton = `<button type="button" class="onboard-primary" data-try>${copy.open}</button>`;
    const help = `<p class="onboard-note">${copy.desktop}</p>`;
    const storeSteps = `<ol class="onboard-store-steps">${copy.storeSteps.map((label, i) =>
      `<li><span>${copy.b[i + 2]}</span><strong>${label}</strong></li>`).join("")}</ol>`;
    const panel = document.createElement("section");
    panel.className = "onboard-panel";
    panel.setAttribute("aria-label", copy.options["abc".indexOf(variant)]);
    const actions = (html) => `<div class="onboard-actions">${html}</div>`;
    const stepButton = (step, label) =>
      `<button type="button" class="onboard-secondary" data-next="${step}">${label}</button>`;

    if (variant === "a") {
      panel.innerHTML = `<h2>${copy.a[0]}</h2><p data-demo-intro>${copy.a[1]}</p><p class="onboard-success" role="status"></p>
        ${actions(`${tryButton}${install}`)}
        <p class="onboard-note">${copy.storeSteps.join(" → ")}</p>${help}`;
    } else if (variant === "b") {
      panel.innerHTML = `<h2>${copy.b[0]}</h2><p>${copy.b[1]}</p>${storeSteps}${actions(install)}${help}`;
    } else {
      panel.innerHTML = `<ol class="onboard-progress">${copy.phases.map((label, i) =>
        `<li><span aria-hidden="true">${i + 1}</span>${label}</li>`).join("")}</ol>
        <div data-step="1"><h2 tabindex="-1">${copy.c[0]}</h2><p>${copy.c[1]}</p>${actions(`${tryButton}${stepButton(2, copy.skip)}`)}</div>
        <div data-step="2" hidden><h2 tabindex="-1">${copy.c[2]}</h2><p>${copy.before}</p>${storeSteps}
          ${actions(`${install}${stepButton(3, copy.after)}${stepButton(1, copy.back)}`)}${help}</div>
        <div data-step="3" hidden><h2 tabindex="-1">${copy.c[3]}</h2><p>${copy.installed}</p>
          ${actions(`${stepButton(2, copy.back)}${stepButton(1, copy.startOver)}`)}</div>`;
    }
    hero.after(panel);

    const store = panel.querySelector("[data-install]");
    store.href = storeLink.href;
    store.target = storeLink.target;
    store.rel = storeLink.rel;
    if (variant === "a") store.className = "onboard-secondary";
    let step = 1;
    function goToStep(next, focus = true) {
      step = next;
      panel.querySelectorAll("[data-step]").forEach((item) => { item.hidden = Number(item.dataset.step) !== step; });
      panel.querySelectorAll(".onboard-progress li").forEach((item, i) => {
        if (i + 1 === step) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
      if (focus) panel.querySelector(`[data-step="${step}"] h2`).focus();
    }
    if (variant === "c") goToStep(1, false);
    panel.querySelectorAll("[data-next]").forEach((button) => {
      button.addEventListener("click", () => goToStep(Number(button.dataset.next)));
    });

    const toolbar = document.createElement("div");
    toolbar.className = "onboard-demo-bar";
    toolbar.innerHTML = `<button type="button" class="onboard-secondary" aria-controls="demo-stage" aria-expanded="false">${copy.replay}</button>`;
    backdrop.before(toolbar);
    const replay = toolbar.querySelector("button");
    const tryDemo = panel.querySelector("[data-try]");
    function openDemo(event) {
      if (startGuide()) {
        replayTrigger = event.currentTarget;
        stage.focus({ preventScroll: true });
      }
    }
    replay.addEventListener("click", openDemo);
    tryDemo?.addEventListener("click", openDemo);
    skip.textContent = copy.close;
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "onboard-primary";
    confirmButton.textContent = copy.switch;
    confirmButton.hidden = true;
    confirmButton.addEventListener("click", () => {
      stage.focus({ preventScroll: true });
      confirm(selected);
    });
    skip.before(confirmButton);

    return { copy, confirm: confirmButton, replay, nextFocus: null, complete() {
      if (variant === "a") {
        panel.querySelector("[data-demo-intro]").hidden = true;
        panel.querySelector(".onboard-success").textContent = copy.a[2];
        store.className = "onboard-primary";
        tryDemo.className = "onboard-secondary";
        tryDemo.textContent = copy.again;
        this.nextFocus = store;
      } else if (variant === "c" && step === 1) {
        const next = panel.querySelector('[data-next="2"]');
        next.textContent = copy.next;
        next.className = "onboard-primary";
        tryDemo.textContent = copy.again;
        tryDemo.className = "onboard-secondary";
        this.nextFocus = next;
      }
    } };
  }

  updateBrowser();
  switcher.hidden = true;
  shade.hidden = true;
})();

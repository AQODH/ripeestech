const root = document.documentElement;
let theme = 'light';
try { theme = localStorage.getItem('ripees-theme') === 'dark' ? 'dark' : 'light'; } catch {}
root.dataset.theme = theme;

function startPageFeatures() {
  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = themeButton?.querySelector('.theme-label');
  const themeIcon = themeButton?.querySelector('.theme-icon');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const orb = document.createElement('div');
  orb.className = 'light-orb';
  orb.setAttribute('aria-hidden', 'true');
  document.body.append(orb);

  const themeCopy = () => {
    if (!themeButton) return;
    const dark = root.dataset.theme === 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    if (themeLabel) themeLabel.textContent = dark ? 'Light mode' : 'Dark mode';
    if (themeIcon) themeIcon.textContent = dark ? '☼' : '◐';
    if (metaTheme) metaTheme.content = dark ? '#080b09' : '#f5f5ee';
  };

  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('ripees-theme', root.dataset.theme); } catch {}
    themeCopy();
    if (root.dataset.theme === 'dark') startOrb();
    else stopOrb();
  });
  themeCopy();

  const skipText = 'script,style,noscript,svg,button,input,textarea,select,option,dialog,[aria-hidden="true"],.light-word';
  const wrapText = (textNode) => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest(skipText) || !textNode.nodeValue?.trim()) return;
    const parentDisplay = getComputedStyle(parent).display;
    if (parentDisplay === 'flex' || parentDisplay === 'inline-flex') return;
    const parts = textNode.nodeValue.match(/\s+|[^\s]+/gu);
    if (!parts) return;
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (/^\s+$/u.test(part)) fragment.append(document.createTextNode(part));
      else {
        const word = document.createElement('span');
        word.className = 'light-word';
        word.textContent = part;
        fragment.append(word);
      }
    }
    textNode.replaceWith(fragment);
  };
  const wrapNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) { wrapText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches(skipText)) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(wrapText);
  };
  const main = document.querySelector('main');
  if (main) wrapNode(main);
  document.querySelectorAll('nav,footer').forEach(wrapNode);
  const textObserver = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) wrapNode(node);
    words = [...document.querySelectorAll('.light-word')];
  });
  if (main) textObserver.observe(main, { childList: true, subtree: true });

  let words = [...document.querySelectorAll('.light-word')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let orbFrame = 0, orbX = innerWidth * .18, orbY = innerHeight * .22, orbVX = 76, orbVY = 58, previousOrbTime = 0, lastWordUpdate = 0;
  const lightWords = (time) => {
    if (time - lastWordUpdate < 110) return;
    lastWordUpdate = time;
    const radius = 178;
    for (const word of words) {
      const rect = word.getBoundingClientRect();
      if (!rect.width || rect.bottom < -12 || rect.top > innerHeight + 12 || rect.right < -12 || rect.left > innerWidth + 12) {
        word.classList.remove('is-near', 'is-lit');
        continue;
      }
      const dx = rect.left + rect.width / 2 - orbX;
      const dy = rect.top + rect.height / 2 - orbY;
      const distance = Math.hypot(dx, dy);
      word.classList.toggle('is-near', distance < radius);
      word.classList.toggle('is-lit', distance < radius * .68);
    }
  };
  const animateOrb = (time) => {
    if (root.dataset.theme !== 'dark' || reducedMotion) { orbFrame = 0; return; }
    const dt = previousOrbTime ? Math.min((time - previousOrbTime) / 1000, .06) : 0;
    previousOrbTime = time;
    const radius = 10;
    orbX += orbVX * dt;
    orbY += orbVY * dt;
    if (orbX < radius || orbX > innerWidth - radius) { orbX = Math.max(radius, Math.min(innerWidth - radius, orbX)); orbVX *= -1; }
    if (orbY < radius || orbY > innerHeight - radius) { orbY = Math.max(radius, Math.min(innerHeight - radius, orbY)); orbVY *= -1; }
    orb.style.left = `${orbX}px`;
    orb.style.top = `${orbY}px`;
    lightWords(time);
    orbFrame = requestAnimationFrame(animateOrb);
  };
  function startOrb() {
    if (reducedMotion || orbFrame) return;
    previousOrbTime = 0;
    orbFrame = requestAnimationFrame(animateOrb);
  }
  function stopOrb() {
    if (orbFrame) cancelAnimationFrame(orbFrame);
    orbFrame = 0;
    words.forEach((word) => word.classList.remove('is-near', 'is-lit'));
  }
  if (root.dataset.theme === 'dark') startOrb();
  window.addEventListener('resize', () => { orbX = Math.min(orbX, innerWidth - 10); orbY = Math.min(orbY, innerHeight - 10); });

  const tourToggle = document.getElementById('tour-toggle');
  if (!tourToggle || !main) return;
  const dock = document.createElement('div');
  dock.id = 'tour-dock';
  dock.hidden = true;
  dock.innerHTML = '<span id="tour-status" role="status" aria-live="polite"></span><button type="button" id="tour-pause" data-tour-ui>Pause</button><button type="button" id="tour-stop" data-tour-ui>Stop</button>';
  document.body.append(dock);
  const status = dock.querySelector('#tour-status');
  const pauseButton = dock.querySelector('#tour-pause');
  const stopButton = dock.querySelector('#tour-stop');
  let tourState = 'idle', tourFrame = 0, previousTourTime = 0, restoreState = null, savedScrollBehavior = null;
  const speed = 52;
  const labelTour = (label) => {
    tourToggle.innerHTML = `${label} <span aria-hidden="true">${tourState === 'running' ? 'Ⅱ' : '↘'}</span>`;
    tourToggle.setAttribute('aria-pressed', String(tourState === 'running'));
  };
  function rememberAndReveal() {
    const details = [...main.querySelectorAll('details')];
    const foldButton = main.querySelector('.fold-btn');
    restoreState = { details: details.map((item) => item.open), foldWasOpen: foldButton?.getAttribute('aria-expanded') === 'true', foldButton };
    details.forEach((item) => { item.open = true; });
    if (foldButton?.getAttribute('aria-expanded') !== 'true') foldButton?.click();
  }
  function restoreRevealedContent() {
    if (!restoreState) return;
    const details = [...main.querySelectorAll('details')];
    details.forEach((item, index) => { item.open = Boolean(restoreState.details[index]); });
    if (restoreState.foldButton && !restoreState.foldWasOpen && restoreState.foldButton.getAttribute('aria-expanded') === 'true') restoreState.foldButton.click();
    restoreState = null;
  }
  function updateTourControls() {
    dock.hidden = tourState === 'idle';
    pauseButton.textContent = tourState === 'running' ? 'Pause' : tourState === 'paused' ? 'Resume' : 'Start again';
    stopButton.textContent = tourState === 'done' ? 'Hide' : 'Stop';
    labelTour(tourState === 'running' ? 'Pause auto tour' : tourState === 'paused' ? 'Resume auto tour' : tourState === 'done' ? 'Start auto tour again' : 'Start auto tour');
  }
  function finishTour(message, completed = false) {
    if (tourFrame) cancelAnimationFrame(tourFrame);
    tourFrame = 0;
    tourState = completed ? 'done' : 'idle';
    if (!completed) restoreRevealedContent();
    if (savedScrollBehavior !== null) { root.style.scrollBehavior = savedScrollBehavior; savedScrollBehavior = null; }
    status.textContent = message;
    updateTourControls();
  }
  function stepTour(time) {
    if (tourState !== 'running') { tourFrame = 0; return; }
    const dt = previousTourTime ? Math.min((time - previousTourTime) / 1000, .08) : 0;
    previousTourTime = time;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const next = Math.min(maxScroll, scrollY + speed * dt);
    window.scrollTo(0, next);
    if (next >= maxScroll - 1) { finishTour('You’ve reached the end. All sections are shown.', true); return; }
    tourFrame = requestAnimationFrame(stepTour);
  }
  function startTour() {
    if (tourFrame) cancelAnimationFrame(tourFrame);
    rememberAndReveal();
    tourState = 'running';
    status.textContent = 'Auto-scrolling through the full site.';
    window.scrollTo({ top: 0, behavior: 'instant' });
    previousTourTime = 0;
    updateTourControls();
    tourFrame = requestAnimationFrame(stepTour);
  }
  function resumeTour() {
    tourState = 'running';
    previousTourTime = 0;
    status.textContent = 'Auto-scrolling through the full site.';
    updateTourControls();
    tourFrame = requestAnimationFrame(stepTour);
  }
  function pauseTour() {
    if (tourState === 'running') {
      if (tourFrame) cancelAnimationFrame(tourFrame);
      tourFrame = 0;
      tourState = 'paused';
      status.textContent = 'Auto tour paused.';
      updateTourControls();
    } else if (tourState === 'paused') resumeTour();
    else if (tourState === 'done') startTour();
  }
  tourToggle.addEventListener('click', () => tourState === 'running' ? pauseTour() : tourState === 'paused' ? resumeTour() : startTour());
  pauseButton.addEventListener('click', pauseTour);
  stopButton.addEventListener('click', () => tourState === 'done' ? (dock.hidden = true) : finishTour('Auto tour stopped.'));
  const stopForUser = (event) => {
    if (tourState !== 'running') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('#tour-dock,#tour-toggle,#theme-toggle')) return;
    finishTour('Auto tour stopped so you can explore the page.');
  };
  window.addEventListener('wheel', stopForUser, { passive: true });
  window.addEventListener('touchstart', stopForUser, { passive: true });
  document.addEventListener('pointerdown', stopForUser, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (tourState === 'running' && !event.target.closest?.('#tour-dock,#tour-toggle,#theme-toggle')) finishTour('Auto tour stopped so you can explore the page.');
  });
}

document.addEventListener('DOMContentLoaded', startPageFeatures, { once: true });

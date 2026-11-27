/* RIPEES site motion + small interactions.
   Always on: phone menu, nav shadow, kampala clock fallbacks.
   Only when motion is allowed (not reduced-motion, GSAP loaded): smooth scroll, hero intro and parallax,
   headline word reveals, pinned product story, horizontal product gallery, stacked process cards, about-text reveal.
   Without any of it the page is a normal, fully readable page. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Always on ---- */
  const nav = $('.nav');
  const toggle = $('.nav-toggle');
  const closeMenu = () => { nav.removeAttribute('data-open'); toggle?.setAttribute('aria-expanded', 'false'); toggle?.setAttribute('aria-label', 'Open menu'); };
  toggle?.addEventListener('click', () => {
    const open = nav.toggleAttribute('data-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  $$('.nav-links a').forEach((a) => a.addEventListener('click', closeMenu));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('mo');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- Smooth scroll, in step with GSAP ---- */
  let lenis = null;
  if (window.Lenis) {
    try {
      lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id.length > 1 ? $(id) : null;
        if (id.length > 1 && !target) return;
        e.preventDefault();
        lenis.scrollTo(target || 0, { offset: target ? -80 : 0, duration: 1.3 });
      }));
      const sync = () => ($$('dialog[open]').length ? lenis.stop() : lenis.start());
      $$('dialog').forEach((d) => new MutationObserver(sync).observe(d, { attributes: true, attributeFilter: ['open'] }));
    } catch (err) { lenis = null; }
  }

  /* ---- Word split helper (keeps <em>, <br>) ---- */
  const split = (el) => {
    const out = [];
    const walk = (node) => [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (!t.trim()) { frag.append(t); return; }
          const o = document.createElement('span'); o.className = 'sw';
          const i = document.createElement('span'); i.className = 'si';
          i.textContent = t; o.append(i); frag.append(o); out.push(i);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
    });
    walk(el);
    return out;
  };

  /* ---- Hero: intro, floating parallax, giant word drift ---- */
  const heroH1 = $('.hero h1');
  if (heroH1) {
    const words = split(heroH1);
    gsap.set(words, { yPercent: 115 });
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to(words, { yPercent: 0, duration: 1.1, stagger: 0.07 }, 0.1)
      .from('.hero .eyebrow, .hero .lede, .hero-actions, .hero-contact', { y: 24, opacity: 0, duration: 0.9, stagger: 0.1 }, 0.5)
      .from('.core', { scale: 0.86, opacity: 0, y: 40, duration: 1.3 }, 0.2)
      .from('.chip', { scale: 0.7, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'back.out(1.6)' }, 0.8)
      .from('.hero-facts li', { y: 18, opacity: 0, duration: 0.8, stagger: 0.08 }, 1);
    setTimeout(() => gsap.to(words, { yPercent: 0, duration: 0.3 }), 6000);
  }
  gsap.to('.hero-word', { xPercent: -50, x: '-14vw', ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.core-stage', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  if (fine) {
    const stage = $('.core-stage');
    const qx = gsap.quickTo('.core', 'x', { duration: 0.8, ease: 'power3' });
    const qy = gsap.quickTo('.core', 'y', { duration: 0.8, ease: 'power3' });
    const chips = $$('.chip');
    $('.hero')?.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      qx(dx * 40); qy(dy * 30);
      chips.forEach((c, i) => gsap.to(c, { x: dx * (i % 2 ? -26 : 26), duration: 0.9, ease: 'power3', overwrite: 'auto' }));
    });
  }

  /* ---- Headline reveals ---- */
  const seen = [];
  $$('.reveal').forEach((h) => {
    const words = split(h);
    if (!words.length) return;
    gsap.set(words, { yPercent: 115 });
    seen.push(words);
    ScrollTrigger.create({ trigger: h, start: 'top 90%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.05 }) });
  });
  setTimeout(() => seen.forEach((w) => gsap.to(w, { yPercent: 0, duration: 0.4, overwrite: 'auto' })), 8000);

  /* ---- Soft arrivals ---- */
  $$('.tile, .faq-list details, .contact-links > *').forEach((el) => {
    gsap.from(el, { y: 30, opacity: 0, duration: 0.9, ease: 'power3.out', immediateRender: false, scrollTrigger: { trigger: el, start: 'top 93%', once: true } });
  });

  /* ---- About: words light up as you read ---- */
  const lead = $('.about-lead');
  if (lead) {
    const words = [];
    const text = lead.textContent;
    lead.textContent = '';
    text.split(/(\s+)/).forEach((t) => {
      if (!t.trim()) { lead.append(t); return; }
      const s = document.createElement('span'); s.className = 'w'; s.textContent = t; lead.append(s); words.push(s);
    });
    ScrollTrigger.create({
      trigger: lead, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (self) => { const n = Math.round(self.progress * words.length); words.forEach((w, i) => w.classList.toggle('lit', i < n)); },
    });
  }

  const mm = gsap.matchMedia();

  /* ---- Pinned product story (hero pattern: sticky product) ---- */
  mm.add('(min-width: 981px)', () => {
    const story = $('.story');
    const tabs = $$('[data-mode]', story);
    if (tabs.length < 3) return;
    const dots = $$('.story-rail li');
    let current = 0;
    ScrollTrigger.create({
      trigger: story,
      start: () => (story.offsetHeight > innerHeight ? 'top top' : 'center center'),
      end: '+=180%', pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => {
        const i = Math.min(2, Math.floor(self.progress * 3));
        dots.forEach((d, k) => d.classList.toggle('on', k <= i));
        if (i !== current) { current = i; tabs[i].click(); }
      },
    });
  });

  /* ---- Horizontal product gallery ---- */
  mm.add('(min-width: 981px)', () => {
    const view = $('.rail-viewport');
    const rail = $('.rail');
    if (!view || !rail) return;
    const dist = () => Math.max(0, rail.scrollWidth - innerWidth);
    if (dist() < 40) return;
    view.classList.add('pinned');
    gsap.to(rail, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.gallery', start: () => ($('.gallery').offsetHeight > innerHeight ? 'bottom bottom' : 'top top'), end: () => '+=' + dist(), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true },
    });
    return () => view.classList.remove('pinned');
  });

  /* ---- Process: cards pile up ---- */
  mm.add('(min-width: 981px)', () => {
    const wrap = $('.steps');
    const cards = wrap ? [...wrap.children] : [];
    if (cards.length < 2) return;
    wrap.classList.add('stack-on');
    cards.forEach((c, i) => {
      c.style.setProperty('--i', i);
      if (i === cards.length - 1) return;
      gsap.fromTo(c, { scale: 1, filter: 'brightness(1)' }, {
        scale: 0.94, filter: 'brightness(0.97)', ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top 85%', end: 'top ' + (140 + i * 24) + 'px', scrub: true },
      });
    });
    return () => wrap.classList.remove('stack-on');
  });

  const refresh = () => ScrollTrigger.refresh();
  addEventListener('load', refresh);
  if (document.fonts) document.fonts.ready.then(refresh);
})();

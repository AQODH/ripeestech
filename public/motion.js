(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));

/* 1 · floating pill header */
const header=$('header');
if(header){
  const spacer=document.createElement('div');spacer.className='nav-spacer';header.after(spacer);
  let on=false;
  const check=()=>{const next=scrollY>90;if(next===on)return;on=next;
    if(on){spacer.style.height=header.offsetHeight+'px';spacer.classList.add('on');header.classList.add('is-floating')}
    else{header.classList.remove('is-floating');spacer.classList.remove('on')}};
  addEventListener('scroll',check,{passive:true});check();
}

/* 2 · glow frame + scroll-scrubbed word reveal on the About section */
const about=$('#about');
let frame=null,words=[];
if(about){
  const stage=document.createElement('div');stage.className='stage';
  about.before(stage);stage.append(about);about.classList.add('glow-frame');frame=about;
  $$('p',about).forEach(p=>{
    const out=document.createDocumentFragment();
    p.textContent.split(/(\s+)/).forEach(t=>{
      if(!t.trim()){out.append(t);return}
      const s=document.createElement('span');s.className='w';s.textContent=t;out.append(s);words.push(s)});
    p.textContent='';p.append(out)});
  const chip=document.createElement('div');chip.className='frame-chip';chip.setAttribute('aria-hidden','true');
  chip.innerHTML='<svg viewBox="75 150 1895 450"><image href="/assets/ripees-logo.png" width="2079" height="756"/></svg>';
  about.append(chip);
}

/* shared scroll loop */
let ticking=false,lastLit=-1;
const update=()=>{ticking=false;
  if(!frame)return;
  const r=frame.getBoundingClientRect(),vh=innerHeight;
  if(reduce){frame.style.setProperty('--p',1);words.forEach(w=>w.classList.add('lit'));return}
  /* frame grows as its top travels from 95% to 35% of the viewport */
  frame.style.setProperty('--p',clamp((vh*.95-r.top)/(vh*.6)).toFixed(3));
  /* words light up while the frame moves from 70% to 15% of the viewport */
  const t=clamp((vh*.7-r.top)/(vh*.55)),n=Math.round(t*words.length);
  if(n!==lastLit){words.forEach((w,i)=>w.classList.toggle('lit',i<n));lastLit=n}
};
const req=()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}};
addEventListener('scroll',req,{passive:true});addEventListener('resize',req);update();

/* 3 · segmented pill + soft content swap */
const tabs=$('.showcase .tabs'),app=$('.showcase .app');
if(tabs&&app){
  const col=document.createElement('div');col.className='app-col';app.before(col);col.append(tabs,app);
  tabs.classList.add('seg');
  const labels={orders:'Orders',insights:'Sales',automation:'Automation'};
  $$('button',tabs).forEach(b=>{if(labels[b.dataset.mode])b.textContent=labels[b.dataset.mode]});
  const thumb=document.createElement('span');thumb.className='thumb';tabs.prepend(thumb);
  const place=()=>{const b=$('[aria-pressed=true]',tabs);if(!b)return;thumb.style.width=b.offsetWidth+'px';thumb.style.transform='translateX('+b.offsetLeft+'px)'};
  new MutationObserver(place).observe(tabs,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
  addEventListener('resize',place);document.fonts&&document.fonts.ready.then(place);place();
  if(typeof window.render==='function'&&!reduce){
    const base=window.render;let busy=0;
    window.render=mode=>{const ws=$('.workspace',app);
      if(!ws){base(mode);return}
      ws.classList.add('swap');clearTimeout(busy);
      busy=setTimeout(()=>{base(mode);requestAnimationFrame(()=>ws.classList.remove('swap'))},170)};
  }
}

/* 4 · column focus on the services row */
const services=$('.services');if(services)services.classList.add('cols');

/* 5 · fade-out collapse on the FAQ list */
const faq=$('.faq-list');
if(faq&&faq.children.length>3){
  const body=document.createElement('div');body.className='fold-body';
  faq.before(body);body.append(faq);
  const wrap=document.createElement('div');wrap.className='fold';body.before(wrap);wrap.append(body);
  const btn=document.createElement('button');btn.type='button';btn.className='fold-btn';btn.setAttribute('aria-expanded','false');
  btn.innerHTML='<span>See more questions</span><i aria-hidden="true">↓</i>';wrap.append(btn);
  const closedH=()=>{const kids=[...faq.children];return kids[2].offsetTop+kids[2].offsetHeight+kids[3].offsetHeight*.45};
  const collapse=()=>{body.style.maxHeight=closedH()+'px'};
  const set=open=>{wrap.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));
    btn.firstChild.textContent=open?'Show fewer':'See more questions';
    if(open){body.style.maxHeight=faq.scrollHeight+'px';setTimeout(()=>{if(wrap.classList.contains('open'))body.style.maxHeight='none'},750)}
    else{body.style.maxHeight=faq.scrollHeight+'px';requestAnimationFrame(()=>requestAnimationFrame(collapse))}};
  collapse();addEventListener('resize',()=>{if(!wrap.classList.contains('open'))collapse()});
  btn.addEventListener('click',()=>set(!wrap.classList.contains('open')));
  faq.addEventListener('toggle',e=>{if(e.target.open&&!wrap.classList.contains('open'))set(true)},true);
}
})();

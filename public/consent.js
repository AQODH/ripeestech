/* RIPEES — cookie choice + newsletter sign-up.
   Cookie choice is saved on this device only (cookie "ripees_consent" + localStorage).
   Optional tools (like analytics) must wait for window event "ripees:consent" with detail.analytics === true. */
(function(){
  var KEY='ripees_consent';
  function read(){try{var m=document.cookie.match(/(?:^|; )ripees_consent=([^;]*)/);if(m)return decodeURIComponent(m[1]);}catch(e){}try{return localStorage.getItem(KEY)||''}catch(e){return ''}}
  function save(v){
    try{document.cookie=KEY+'='+encodeURIComponent(v)+'; Max-Age=15552000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'')}catch(e){}
    try{localStorage.setItem(KEY,v)}catch(e){}
    window.dispatchEvent(new CustomEvent('ripees:consent',{detail:{analytics:v==='all'}}));
  }
  var box=document.getElementById('cookie');
  function show(){if(box){box.hidden=false;requestAnimationFrame(function(){box.classList.add('in')})}}
  function hide(){if(box){box.classList.remove('in');setTimeout(function(){box.hidden=true},300)}}
  var cur=read();
  if(!cur)setTimeout(show,900);else window.dispatchEvent(new CustomEvent('ripees:consent',{detail:{analytics:cur==='all'}}));
  if(box)box.addEventListener('click',function(e){var b=e.target.closest('[data-cookie]');if(!b)return;save(b.getAttribute('data-cookie'));hide()});
  var again=document.getElementById('cookie-settings');
  if(again)again.addEventListener('click',show);

  var form=document.getElementById('news-form');
  if(!form)return;
  form.addEventListener('submit',async function(e){
    e.preventDefault();
    var status=form.querySelector('.form-status'),btn=form.querySelector('button[type=submit]');
    var email=form.elements.email.value.trim(),ok=form.elements.consent.checked;
    function say(t,k){status.textContent=t;status.setAttribute('data-kind',k||'')}
    if(!/^\S+@\S+\.\S+$/.test(email)){say('Please enter a valid email address.','error');form.elements.email.focus();return}
    if(!ok){say('Please tick the box so we know you agree.','error');return}
    btn.disabled=true;say('Signing you up…');
    try{
      var r=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,consent:true,website:form.elements.website.value,source:'footer'})});
      var d=await r.json().catch(function(){return{}});
      if(r.ok){say('Thank you! You are on the list.','success');form.reset()}
      else say(d.error||'We could not sign you up. Please try again.','error');
    }catch(err){say('No connection. Please try again.','error')}
    btn.disabled=false;
  });
})();

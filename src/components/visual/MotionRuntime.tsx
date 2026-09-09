import { headers } from 'next/headers';

/**
 * Bewegungs-Laufzeit der Website.
 *
 * Bewusst ein einziges, sehr kleines Inline-Skript statt vieler Client
 * Components:
 *
 * - Es läuft vor dem ersten Zeichnen, dadurch gibt es kein Aufblitzen und
 *   keine Hydration-Konflikte.
 * - Ohne JavaScript wird `motion-ready` nie gesetzt – alle Inhalte sind dann
 *   sofort und vollständig sichtbar (progressive Enhancement).
 * - Bei `prefers-reduced-motion: reduce` bricht es sofort ab; es werden weder
 *   Beobachter angelegt noch Animationen gestartet.
 *
 * Aufgaben:
 * 1. Reveal beim Scrollen für alle `[data-reveal]`-Elemente.
 * 2. Dekorative Ebenen (`[data-ambient]`) nur animieren, solange sie sichtbar sind.
 * 3. Hochzählen echter, veröffentlichter Zahlen (`[data-countup]`).
 * 4. Scroll-Zustand für den Kopfbereich (`data-scrolled` am <html>).
 *
 * Das Skript trägt eine CSP-Nonce und ist damit die einzige erlaubte
 * Inline-Ausführung.
 */

const RUNTIME = `(function(){
var d=document,r=d.documentElement,w=window;
try{
if(!w.matchMedia||w.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if(!('IntersectionObserver' in w))return;
r.classList.add('motion-ready');

/* 1) Reveal ---------------------------------------------------------- */
var seen=new WeakSet();
var io=new IntersectionObserver(function(es){
  for(var i=0;i<es.length;i++){
    if(es[i].isIntersecting){es[i].target.classList.add('is-revealed');io.unobserve(es[i].target);}
  }
},{rootMargin:'0px 0px -8% 0px',threshold:0.04});

/* 2) Dekorative Ebenen nur bei Sichtbarkeit animieren ----------------- */
var ao=new IntersectionObserver(function(es){
  for(var i=0;i<es.length;i++){es[i].target.classList.toggle('is-inview',es[i].isIntersecting);}
},{rootMargin:'120px'});

/* 3) Zahlen hochzählen ------------------------------------------------ */
var nf=new Intl.NumberFormat('de-CH');
function count(el){
  var target=parseFloat(el.getAttribute('data-countup')||'');
  if(!isFinite(target)||target<=0)return;
  var pre=el.getAttribute('data-countup-prefix')||'';
  var suf=el.getAttribute('data-countup-suffix')||'';
  /* Der Endzustand ist immer exakt der gepflegte Text, nie eine Neuformatierung. */
  var fin=el.getAttribute('data-countup-final')||el.textContent;
  var dur=Math.min(1600,600+target/6),t0=0;
  function step(ts){
    if(!t0)t0=ts;
    var p=Math.min(1,(ts-t0)/dur);
    if(p>=1){el.textContent=fin;return;}
    el.textContent=pre+nf.format(Math.round(target*(1-Math.pow(1-p,3))))+suf;
    requestAnimationFrame(step);
  }
  el.textContent=pre+nf.format(0)+suf;
  requestAnimationFrame(step);
}
var co=new IntersectionObserver(function(es){
  for(var i=0;i<es.length;i++){
    if(es[i].isIntersecting){co.unobserve(es[i].target);count(es[i].target);}
  }
},{threshold:0.5});

function scan(){
  var n=d.querySelectorAll('[data-reveal],[data-ambient],[data-countup]');
  for(var i=0;i<n.length;i++){
    var el=n[i];
    if(seen.has(el))continue;
    seen.add(el);
    if(el.hasAttribute('data-reveal'))io.observe(el);
    if(el.hasAttribute('data-ambient'))ao.observe(el);
    if(el.hasAttribute('data-countup'))co.observe(el);
  }
}
scan();
new MutationObserver(scan).observe(r,{childList:true,subtree:true});

/*
  Sicherheitsnetz: Sollte die Beobachtung nicht greifen, wäre Inhalt dauerhaft
  unsichtbar. Deshalb wird nach 3 s geprüft, ob mindestens ein sichtbares
  Element eingeblendet wurde – falls nicht, werden alle Einblendungen
  abgeschaltet und sämtliche Inhalte dargestellt.
*/
setTimeout(function(){
  var pending=d.querySelectorAll('[data-reveal]:not(.is-revealed)'),broken=false;
  for(var i=0;i<pending.length;i++){
    var b=pending[i].getBoundingClientRect();
    if(b.top<w.innerHeight&&b.bottom>0){broken=true;break;}
  }
  if(broken)r.classList.add('motion-failsafe');
},3000);

/* 4) Scroll-Zustand des Kopfbereichs ---------------------------------- */
var ticking=false;
function onScroll(){
  if(ticking)return;
  ticking=true;
  requestAnimationFrame(function(){
    r.setAttribute('data-scrolled',(w.scrollY||0)>16?'true':'false');
    ticking=false;
  });
}
onScroll();
w.addEventListener('scroll',onScroll,{passive:true});
}catch(e){r.classList.add('motion-failsafe');}
})();`;

export async function MotionRuntime() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: RUNTIME }} />;
}

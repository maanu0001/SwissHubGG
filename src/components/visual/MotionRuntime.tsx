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
 * 1. Reveal beim Scrollen für alle `[data-reveal]`-Elemente (mehrere Varianten).
 * 2. Dekorative Ebenen (`[data-ambient]`) nur animieren, solange sie sichtbar sind.
 * 3. Hochzählen echter, veröffentlichter Zahlen (`[data-countup]`).
 * 4. Ebenen, die sich beim Scrollen langsamer bewegen (`[data-scroll-parallax]`).
 * 5. Lichtfläche, die der Maus folgt (`[data-spotlight]`) – nur Zeigegeräte.
 * 6. Maus-Parallaxe der Hero-Bühne (`[data-parallax-scene]`) – nur Zeigegeräte.
 * 7. Scroll-Zustand für den Kopfbereich (`data-scrolled` am <html>); pausiert,
 *    solange die mobile Navigation offen ist (`data-nav-open`).
 *
 * Scroll- und Zeigerereignisse laufen passiv und über genau einen
 * `requestAnimationFrame`-Durchlauf, damit nichts die Bedienung verzögert.
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
},{rootMargin:'0px 0px -10% 0px',threshold:0.01});

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

/* 4) Ebenen, die sich beim Scrollen langsamer bewegen -------------------- */
var layers=[];
var po=new IntersectionObserver(function(es){
  for(var i=0;i<es.length;i++){es[i].target.__vis=es[i].isIntersecting;}
  schedule();
},{rootMargin:'160px'});

function positionLayers(){
  var vh=w.innerHeight||0;
  for(var i=0;i<layers.length;i++){
    var el=layers[i];
    if(!el.__vis)continue;
    var b=el.getBoundingClientRect();
    /* −1 (unterhalb) bis 1 (oberhalb) – daraus ein sanfter Versatz. */
    var progress=(vh-(b.top+b.height/2))/(vh+b.height);
    var speed=parseFloat(el.getAttribute('data-scroll-parallax'))||12;
    el.style.setProperty('--parallax',(progress*speed*-1).toFixed(1)+'px');
  }
}

/* 5) Lichtfläche folgt der Maus – nur auf echten Zeigegeräten ------------ */
var fine=w.matchMedia('(hover: hover) and (pointer: fine)').matches;
function bindSpotlight(el){
  if(!fine||el.__spot)return;
  el.__spot=true;
  el.addEventListener('pointermove',function(e){
    var b=el.getBoundingClientRect();
    el.style.setProperty('--mx',(((e.clientX-b.left)/b.width)*100).toFixed(1)+'%');
    el.style.setProperty('--my',(((e.clientY-b.top)/b.height)*100).toFixed(1)+'%');
  },{passive:true});
}

/* 6) Maus-Parallaxe der Hero-Bühne -------------------------------------- */
function bindScene(scene){
  if(!fine||scene.__scene)return;
  scene.__scene=true;
  var pending=false,nx=0,ny=0;
  scene.addEventListener('pointermove',function(e){
    var b=scene.getBoundingClientRect();
    nx=((e.clientX-b.left)/b.width-0.5)*2;
    ny=((e.clientY-b.top)/b.height-0.5)*2;
    if(pending)return;
    pending=true;
    requestAnimationFrame(function(){
      scene.style.setProperty('--px',nx.toFixed(3));
      scene.style.setProperty('--py',ny.toFixed(3));
      pending=false;
    });
  },{passive:true});
  scene.addEventListener('pointerleave',function(){
    scene.style.setProperty('--px','0');
    scene.style.setProperty('--py','0');
  },{passive:true});
}

function scan(){
  var n=d.querySelectorAll('[data-reveal],[data-ambient],[data-countup],[data-scroll-parallax],[data-spotlight],[data-parallax-scene]');
  for(var i=0;i<n.length;i++){
    var el=n[i];
    if(seen.has(el))continue;
    seen.add(el);
    if(el.hasAttribute('data-reveal'))io.observe(el);
    if(el.hasAttribute('data-ambient'))ao.observe(el);
    if(el.hasAttribute('data-countup'))co.observe(el);
    if(el.hasAttribute('data-scroll-parallax')){layers.push(el);po.observe(el);}
    if(el.hasAttribute('data-spotlight'))bindSpotlight(el);
    if(el.hasAttribute('data-parallax-scene'))bindScene(el);
  }
  schedule();
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

/* 7) Ein einziger Scroll-Durchlauf für Kopfbereich und Parallaxe -------- */
var ticking=false;
function schedule(){
  if(ticking)return;
  ticking=true;
  requestAnimationFrame(function(){
    /* Bei offener mobiler Navigation ist die Seite fixiert und meldet 0.
       Der Kopfbereich darf sich davon nicht beeinflussen lassen, sonst
       verschiebt sich die Seite beim Schliessen. */
    if(r.getAttribute('data-nav-open')!=='true')r.setAttribute('data-scrolled',(w.scrollY||0)>16?'true':'false');
    positionLayers();
    ticking=false;
  });
}
schedule();
w.addEventListener('scroll',schedule,{passive:true});
w.addEventListener('resize',schedule,{passive:true});
}catch(e){r.classList.add('motion-failsafe');}
})();`;

export async function MotionRuntime() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: RUNTIME }} />;
}

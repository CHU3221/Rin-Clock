"use strict";

// Rin Clock — fixed 438 × 438 SVG coordinate system, responsive CSS display.
// Character artwork is loaded as native-resolution-independent SVG <image> files.
// Original source coordinate systems are preserved; the 438 unit clock viewBox is not a pixel resolution limit.
const CENTER = 219;
const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "rin-clock-settings-v1";
const LEGACY_KEY = "celestial-clock-settings-v1";
const DEFAULTS = Object.freeze({ showSecond: true, bold: false, showDate: true, sharpGlow: false, backgroundOff: false, autoHideSettings: false });
const COMPOSITION = Object.freeze({ minuteSize: 120, hourSize: 43, coreRadius: 50, minuteInset: 2, hourInset: 2 });
// Original artwork's padded viewBox (20 unit margin) is preserved in SVG assets.
// Coordinates are in each source SVG's own user units, not pixels.
const SPRITES = Object.freeze({
  minute: { sourceWidth: 742, sourceHeight: 1400, baseHeight: 1360, anchorX: 449.107 + 20, anchorY: 1360 + 20 },
  hour:   { sourceWidth: 400, sourceHeight: 448, baseHeight: 408, anchorX: 180.5 + 20, anchorY: 408 + 20 }
});
const state = { ...DEFAULTS };
const els = {};
let clockTimeout = null;
let settingsHideTimeout = null;
let lastDateKey = "";
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", weekday:"short" });

function init(){
  for (const id of [
    "clockSvg","minuteRotation","hourRotation","secondRotation","minuteAsset","hourAsset",
    "minuteIndicator","hourIndicator","minuteMark","hourMark","minuteOrbit","hourOrbit",
    "coreArtwork","coreRasterGlow","coreVectorGlow","sunIcon","moonIcon","dateLine","dateLabel",
    "settingsModal","openSettings","closeSettings","secondCheck","boldCheck","dateCheck","sharpGlowCheck","backgroundCheck","autoHideSettingsCheck"
  ]) els[id]=document.getElementById(id);
  loadSettings();
  buildStars();
  buildTicks();
  buildNumerals();
  layoutCharacters();
  bindSettings();
  reflectSettings();
  updateClock();
  scheduleClock();
}

function loadSettings(){
  try {
    // Only migrate second/bold from old versions; retired UI settings are ignored.
    const current=localStorage.getItem(STORAGE_KEY);
    const saved=JSON.parse(current ?? localStorage.getItem(LEGACY_KEY) ?? "{}");
    if (saved && typeof saved === "object") {
      if (typeof saved.showSecond === "boolean") state.showSecond=saved.showSecond;
      if (typeof saved.bold === "boolean") state.bold=saved.bold;
      if (typeof saved.showDate === "boolean") state.showDate=saved.showDate;
      if (typeof saved.sharpGlow === "boolean") state.sharpGlow=saved.sharpGlow;
      if (typeof saved.backgroundOff === "boolean") state.backgroundOff=saved.backgroundOff;
      if (typeof saved.autoHideSettings === "boolean") state.autoHideSettings=saved.autoHideSettings;
    }
  } catch (_) { /* Blocked storage or bad JSON: use defaults */ }
}
function saveSettings(){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch (_) { /* Storage may be unavailable */ }
}
function bindSettings(){
  const modal=els.settingsModal;
  const openModal=()=>{
    clearSettingsHideTimer();
    if (!modal.open) modal.showModal();
    document.body.dataset.settingsModalOpen="true";
  };
  els.openSettings.addEventListener("click",openModal);
  els.closeSettings.addEventListener("click",()=>modal.close());
  modal.addEventListener("close",()=>{
    document.body.dataset.settingsModalOpen="false";
    if (state.autoHideSettings) document.body.dataset.settingsCornerVisible="true";
    scheduleSettingsHide();
  });
  // The invisible 44px trigger stays hit-testable, so touch can also open settings.
  els.openSettings.addEventListener("pointerenter",()=>{
    clearSettingsHideTimer();
    document.body.dataset.settingsCornerVisible="true";
  });
  els.openSettings.addEventListener("pointerleave",scheduleSettingsHide);
  els.openSettings.addEventListener("blur",scheduleSettingsHide);
  document.addEventListener("keydown",event=>{
    if (event.key.toLowerCase()!=="s" || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    const target=event.target;
    if (target instanceof HTMLElement && (
      target.isContentEditable || target.matches('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"])')
    )) return;
    event.preventDefault();
    if (modal.open) modal.close();
    else openModal();
  });
  modal.addEventListener("click",event=>{
    const r=modal.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();
  });
  for (const [id,key] of [["secondCheck","showSecond"],["boldCheck","bold"],["dateCheck","showDate"],["sharpGlowCheck","sharpGlow"],["backgroundCheck","backgroundOff"],["autoHideSettingsCheck","autoHideSettings"]]) {
    els[id].addEventListener("change",()=>{
      state[key]=els[id].checked;
      reflectSettings();
      saveSettings();
    });
  }
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden){updateClock();scheduleClock();}
  });
}
function clearSettingsHideTimer(){
  if (settingsHideTimeout!==null) clearTimeout(settingsHideTimeout);
  settingsHideTimeout=null;
}
function scheduleSettingsHide(){
  clearSettingsHideTimer();
  if (!state.autoHideSettings || els.settingsModal.open) return;
  settingsHideTimeout=setTimeout(()=>{
    settingsHideTimeout=null;
    if (!els.settingsModal.open) document.body.dataset.settingsCornerVisible="false";
  },1800);
}
function reflectSettings(){
  els.secondCheck.checked=state.showSecond;
  els.boldCheck.checked=state.bold;
  els.dateCheck.checked=state.showDate;
  els.sharpGlowCheck.checked=state.sharpGlow;
  els.backgroundCheck.checked=state.backgroundOff;
  els.autoHideSettingsCheck.checked=state.autoHideSettings;
  els.secondRotation.style.display=state.showSecond?"":"none";
  els.minuteAsset.setAttribute("href",`/assets/rin-${state.bold?"bold":"plain"}.svg`);
  els.hourAsset.setAttribute("href",`/assets/kurimi-${state.bold?"bold":"plain"}.svg`);
  els.dateLine.hidden=!state.showDate;
  els.coreRasterGlow.style.display=state.sharpGlow?"none":"";
  els.coreVectorGlow.setAttribute("display",state.sharpGlow?"inline":"none");
  document.body.dataset.backgroundOff=String(state.backgroundOff);
  document.body.dataset.autoHideSettings=String(state.autoHideSettings);
  if (!state.autoHideSettings) {
    clearSettingsHideTimer();
    document.body.dataset.settingsCornerVisible="false";
  }
  document.body.dataset.dateVisible=String(state.showDate);
}
function layoutCharacters(){
  const m=placeAsset(els.minuteAsset,SPRITES.minute,COMPOSITION.minuteSize,COMPOSITION.minuteInset);
  const h=placeAsset(els.hourAsset,SPRITES.hour,COMPOSITION.hourSize,COMPOSITION.hourInset);
  els.minuteOrbit.setAttribute("r",(m+COMPOSITION.minuteSize*.54).toFixed(2));
  els.hourOrbit.setAttribute("r",(h+COMPOSITION.hourSize*.55).toFixed(2));
  els.minuteMark.setAttribute("transform",`translate(0 ${(-(m+COMPOSITION.minuteSize+9)).toFixed(2)})`);
  els.hourMark.setAttribute("transform",`translate(0 ${(-(h+COMPOSITION.hourSize+11)).toFixed(2)})`);
  els.coreArtwork.setAttribute("transform",`translate(${CENTER} ${CENTER}) scale(${(COMPOSITION.coreRadius/52).toFixed(5)})`);
}
function placeAsset(image,sprite,height,inset){
  const scale=height/sprite.baseHeight;
  const radius=COMPOSITION.coreRadius-inset;
  image.setAttribute("x",(CENTER-sprite.anchorX*scale).toFixed(3));
  image.setAttribute("y",(CENTER-radius-sprite.anchorY*scale).toFixed(3));
  image.setAttribute("width",(sprite.sourceWidth*scale).toFixed(3));
  image.setAttribute("height",(sprite.sourceHeight*scale).toFixed(3));
  return radius;
}
function updateClock(){
  const now=new Date();
  const second=now.getSeconds(),minute=now.getMinutes()+second/60;
  const minuteAngle=minute*6,hourAngle=((now.getHours()%12)+minute/60)*30;
  els.minuteRotation.setAttribute("transform",`rotate(${minuteAngle} ${CENTER} ${CENTER})`);
  els.hourRotation.setAttribute("transform",`rotate(${hourAngle} ${CENTER} ${CENTER})`);
  els.minuteIndicator.setAttribute("transform",`rotate(${minuteAngle} ${CENTER} ${CENTER}) translate(${CENTER} ${CENTER})`);
  els.hourIndicator.setAttribute("transform",`rotate(${hourAngle} ${CENTER} ${CENTER}) translate(${CENTER} ${CENTER})`);
  if(state.showSecond)els.secondRotation.setAttribute("transform",`rotate(${second*6} ${CENTER} ${CENTER})`);
  const day=now.getHours()>=6&&now.getHours()<18;
  els.sunIcon.style.display=day?"":"none";
  els.moonIcon.style.display=day?"none":"";
  const key=`${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  if(key!==lastDateKey){
    lastDateKey=key;
    els.dateLabel.dateTime=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    els.dateLabel.textContent=dateFormatter.format(now);
  }
}
function scheduleClock(){
  if(clockTimeout!==null)clearTimeout(clockTimeout);
  clockTimeout=setTimeout(()=>{
    if(!document.hidden)updateClock();
    scheduleClock();
  },1000-(Date.now()%1000)+12);
}
function buildStars(){
  const stars=[
    [56,58,1.8,.9],[84,104,1.4,.72],[118,74,2.1,.95],[164,39,1.2,.7],[256,52,1.6,.84],
    [318,86,1.4,.72],[372,62,2,.9],[386,124,1.3,.65],[64,168,1.2,.6],[103,298,1.7,.78],
    [61,352,1.3,.66],[141,384,1.9,.88],[219,348,1.2,.65],[301,370,1.7,.8],[352,316,1.4,.74],
    [382,246,1.1,.62],[337,184,1.8,.82],[235,118,1.2,.6],[191,94,1.2,.62],[282,282,1.5,.72]
  ];
  const frag=document.createDocumentFragment();
  for(const [x,y,r,opacity] of stars){
    const c=document.createElementNS(SVG_NS,"circle");
    c.setAttribute("cx",x);c.setAttribute("cy",y);c.setAttribute("r",r);
    c.setAttribute("fill","#fff");c.setAttribute("opacity",opacity);
    frag.appendChild(c);
  }
  document.getElementById("starsLayer").append(frag);
}
function buildTicks(){
  const frag=document.createDocumentFragment();
  for(let i=0;i<60;i++){
    const a=i*6*Math.PI/180,major=i%5===0,outer=198.5,inner=major?182.5:188.5;
    const l=document.createElementNS(SVG_NS,"line");
    l.setAttribute("x1",(CENTER+Math.sin(a)*outer).toFixed(2));
    l.setAttribute("y1",(CENTER-Math.cos(a)*outer).toFixed(2));
    l.setAttribute("x2",(CENTER+Math.sin(a)*inner).toFixed(2));
    l.setAttribute("y2",(CENTER-Math.cos(a)*inner).toFixed(2));
    l.setAttribute("stroke",major?"#d9b975":"#b9975c");
    l.setAttribute("stroke-opacity",major?".85":".42");
    l.setAttribute("stroke-width",major?"2.1":"1.1");
    l.setAttribute("stroke-linecap","round");
    frag.appendChild(l);
  }
  document.getElementById("ticksLayer").append(frag);
}
function buildNumerals(){
  const frag=document.createDocumentFragment();
  for(const [text,degrees] of [["XII",0],["III",90],["VI",180],["IX",270]]){
    const rad=degrees*Math.PI/180;
    const t=document.createElementNS(SVG_NS,"text");
    t.textContent=text;
    t.setAttribute("x",(CENTER+168*Math.sin(rad)).toFixed(2));
    t.setAttribute("y",(CENTER-168*Math.cos(rad)+4).toFixed(2));
    t.setAttribute("text-anchor","middle");
    t.setAttribute("fill","#d9b975");
    t.setAttribute("fill-opacity",".86");
    t.setAttribute("font-size","13");
    t.setAttribute("font-family","Georgia,Times New Roman,serif");
    t.setAttribute("letter-spacing","1.2");
    frag.appendChild(t);
  }
  document.getElementById("numeralsLayer").append(frag);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();

(() => {
  'use strict';
  const KEY='crownless-audio-enabled';
  let ctx=null;
  const on=()=>{try{return localStorage.getItem(KEY)==='true';}catch{return false;}};
  const ac=()=>ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
  function tone(frequency,endFrequency,duration,type,gain){
    if(!on()||!(window.AudioContext||window.webkitAudioContext))return;
    const c=ac(),now=c.currentTime,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(frequency,now);o.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);
    g.gain.setValueAtTime(gain,now);g.gain.exponentialRampToValueAtTime(0.0001,now+duration);
    o.connect(g).connect(c.destination);o.start(now);o.stop(now+duration);
  }
  const sounds={
    strike:()=>tone(760,180,.07,'sawtooth',.025),
    heavy:()=>tone(170,55,.16,'square',.045),
    guard:()=>tone(420,260,.09,'triangle',.03),
    dodge:()=>tone(520,980,.055,'sine',.018)
  };
  function sync(b){const active=on();b.textContent=active?'音 ON':'音 OFF';b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',active?'効果音を消す':'効果音を鳴らす');}
  const footer=document.querySelector('.footer');
  if(footer){
    const b=document.createElement('button');b.type='button';b.className='text-button';b.dataset.audioToggle='true';sync(b);
    b.addEventListener('click',async()=>{const next=!on();try{localStorage.setItem(KEY,String(next));}catch{}if(next){const c=ac();if(c.state==='suspended')await c.resume();tone(330,440,.08,'triangle',.02);}sync(b);});
    footer.append(b);
  }
  document.addEventListener('click',e=>{const a=e.target.closest('button[data-action]')?.dataset.action;if(a&&sounds[a])sounds[a]();},true);
})();

/* Optional, presentation-only atmosphere for the existing Canvas forest.
 * No new assets, renderer, persistent settings, location access or collision.
 * Deterministic motion and bounded sparks keep low-end phone cost predictable.
 */
(function(root,factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CrownlessForestEffects=api;
})(typeof globalThis==='object'?globalThis:this,function() {
  'use strict';
  function create(options={}) {
    let enabled=options.enabled!==false;
    let lastTime=0, sparks=[];
    let lastBurst='';
    function setEnabled(value) {
      enabled=!!value;
      if(!enabled) sparks=[];
      return enabled;
    }
    function burst(x,z,height,type='hit',now=(typeof performance==='object'?performance.now():Date.now())) {
      if(!enabled||![x,z,height].every(Number.isFinite)) return false;
      // An effect is a visual response, not a second gameplay event.
      const count=type==='discovery'?17:type==='victory'?20:8;
      const color=type==='discovery'?'#c8e8aa':type==='victory'?'#f5d188':'#fff0bd';
      for(let i=0;i<count;i++) {
        const angle=i*2.3999632;
        const speed=24+(i%5)*14;
        sparks.push({x,y:z-height,dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed-24,
          born:now,life:420+(i%4)*90,color});
      }
      if(sparks.length>48) sparks=sparks.slice(-48);
      lastBurst=type;
      return true;
    }
    function background(ctx,width,cameraX,time) {
      if(!enabled) return;
      ctx.save();
      // Distant canopy silhouette drifts slower than the physical ground.
      ctx.translate(-cameraX*.09,0);
      ctx.fillStyle='rgba(25,42,36,.17)';
      for(let i=0;i<10;i++) {
        const x=85+i*118,y=195;
        const top=56+(i%4)*13;
        ctx.beginPath();ctx.moveTo(x-35,y);ctx.lineTo(x,top);ctx.lineTo(x+35,y);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
      // The narrow, transparent moonbeams do not hide landmarks or fighters.
      const sway=Math.sin(time/2500)*13;
      ctx.fillStyle='rgba(255,238,195,.075)';
      for(const x of [width*.14,width*.78]) {
        ctx.beginPath();ctx.moveTo(x+sway-40,0);ctx.lineTo(x+sway+14,0);
        ctx.lineTo(x+sway+140,290);ctx.lineTo(x+sway+27,290);
        ctx.closePath();ctx.fill();
      }
    }
    function overlay(ctx,cameraX,width,time,hero,found,crafted) {
      if(!enabled) return;
      ctx.save();
      // Called while world is translated by -cameraX.
      for(const s of [{id:'traces',x:800,y:336},{id:'shrine',x:660,y:200},{id:'hollow',x:910,y:210}]) {
        if(found&&found.has(s.id)) continue;
        const glow=s.id==='hollow'&&!crafted?.08:.19;
        const radius=11+Math.sin(time/450+s.x)*2;
        const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,radius*3);
        g.addColorStop(0,`rgba(248,220,150,${glow})`);
        g.addColorStop(1,'rgba(248,220,150,0)');
        ctx.fillStyle=g;ctx.fillRect(s.x-radius*3,s.y-radius*3,radius*6,radius*6);
      }
      lastTime=time;
      for(const p of sparks) {
        const age=time-p.born, t=Math.max(0,1-age/p.life);
        if(t<=0) continue;
        const sec=age/1000;
        ctx.globalAlpha=t*.95;ctx.fillStyle=p.color;
        ctx.fillRect(Math.round(p.x+p.dx*sec),Math.round(p.y+p.dy*sec+32*sec*sec),2+Math.ceil(2*t),2+Math.ceil(2*t));
      }
      ctx.globalAlpha=1;
      sparks=sparks.filter(p=>time-p.born<p.life);
      ctx.translate(cameraX,0);
      // Layers are screen-space and can't alter combat/world coordinates.
      const drift=Math.sin(time/2300)*19;
      for(let row=0;row<3;row++) {
        const y=255+row*56;
        for(let i=0;i<4;i++) {
          const x=i*width/3-25+drift*(row%2?-1:1);
          const mist=ctx.createRadialGradient(x,y,2,x,y,68);
          mist.addColorStop(0,'rgba(219,238,215,.085)');
          mist.addColorStop(1,'rgba(219,238,215,0)');
          ctx.fillStyle=mist;ctx.fillRect(x-70,y-40,140,80);
        }
      }
      for(let i=0;i<12;i++) {
        const x=((i*79+Math.sin(time/(820+i*25)+i)*18-cameraX*.32)%(width+40)+width+40)%(width+40);
        const y=100+(i%6)*43+Math.sin(time/590+i)*6;
        ctx.globalAlpha=.2+Math.max(0,Math.sin(time/400+i*2))*.34;
        ctx.fillStyle='#e9e3a7';ctx.fillRect(Math.round(x),Math.round(y),2,2);
      }
      ctx.globalAlpha=1;
      if(hero) {
        const x=hero.x-cameraX, y=hero.z-hero.y-34;
        const halo=ctx.createRadialGradient(x,y,3,x,y,48);
        halo.addColorStop(0,'rgba(255,210,139,.13)');halo.addColorStop(1,'rgba(255,210,139,0)');
        ctx.fillStyle=halo;ctx.fillRect(x-48,y-48,96,96);
      }
      // Near framing is low-opacity so clues stay tappable and readable.
      ctx.fillStyle='rgba(16,36,26,.2)';
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,0);ctx.lineTo(0,130);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(width,0);ctx.lineTo(width-23,0);ctx.lineTo(width,143);ctx.closePath();ctx.fill();
      ctx.restore();
    }
    function reset() { sparks=[];lastTime=0;lastBurst=''; }
    function readout() { return {enabled,sparks:sparks.length,lastBurst}; }
    return {setEnabled,enabled:()=>enabled,background,overlay,burst,reset,readout};
  }
  return {create};
});

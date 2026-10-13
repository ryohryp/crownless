/* Bell-less tower interior, entirely original Canvas shapes, no assets or GPS. */
(function(root){
  'use strict';
  if(!root)return;
  const T=root.CrownlessTowerField,W=600,CELL=120;
  let active=null,previous=null;
  const center=n=>{const [col,row]=T.coords(n);return [col*CELL+60,row*CELL+60];};
  function ellipse(ctx,x,y,rx,ry,color){
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
  }
  function ruins(ctx,f,time){
    ctx.fillStyle='#17242c';ctx.fillRect(0,0,W,W);
    // Tower floor is a single joined stone interior, not forest scenery.
    for(let id=0;id<T.COUNT;id++){
      const [x,y]=center(id),col=id%5,row=Math.floor(id/5),wall=T.WALLS.includes(id);
      if(wall){
        ctx.fillStyle='#34414a';ctx.fillRect(x-59,y-59,118,118);
        ctx.fillStyle='#65716d';ctx.fillRect(x-57,y-58,114,8);
        ctx.fillStyle='#1e3039';ctx.fillRect(x-53,y-46,106,89);
        for(let k=0;k<3;k++){
          ctx.strokeStyle='#6573698c';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(x-43,y-20+k*25);ctx.lineTo(x+39,y-20+k*25);ctx.stroke();
        }
        ctx.fillStyle='#697671';ctx.fillRect(x-54,y+46,109,9);
      }else{
        ctx.fillStyle=(col+row)%2?'#4a5558':'#515c5c';
        ctx.fillRect(x-59,y-59,118,118);
        ctx.strokeStyle='#77837a5c';ctx.lineWidth=3;
        ctx.strokeRect(x-54,y-53,107,107);
        ctx.beginPath();ctx.moveTo(x-27,y-11);ctx.lineTo(x+6,y-16);
        ctx.lineTo(x+29,y-39);ctx.moveTo(x+8,y-18);ctx.lineTo(x+15,y+8);ctx.stroke();
        ellipse(ctx,x+35,y+29,13,5,'#2837409c');
      }
    }
    // Sealed passage disguised as a stone wall. It has no waypoint.
    {
      const [x,y]=center(T.SECRET);
      ctx.fillStyle=f.open?'#1d2a33':'#39474b';
      ctx.fillRect(x-55,y-54,110,108);
      ctx.strokeStyle='#a9a994';ctx.lineWidth=f.open?3:1;
      ctx.beginPath();ctx.moveTo(x+18,y-45);ctx.lineTo(x+2,y-15);
      ctx.lineTo(x+16,y+8);ctx.lineTo(x-9,y+46);ctx.stroke();
      if(f.open){
        ctx.fillStyle='#071923';ctx.fillRect(x-33,y-36,65,73);
        ctx.fillStyle='#af9f77';ctx.fillRect(x-38,y-38,9,77);
        ctx.fillStyle='#1a3442';ctx.fillRect(x-23,y+19,49,6);
        ctx.fillRect(x-15,y+32,36,6);
      }
    }
    // Bell fragment: the strange low ring leaks through the floor.
    {
      const [x,y]=center(T.ECHO);
      ellipse(ctx,x,y+12,38,20,'#142c36d8');
      ctx.fillStyle='#bda46c';ctx.beginPath();
      ctx.moveTo(x-32,y+13);ctx.lineTo(x-20,y-17);ctx.lineTo(x+12,y-24);
      ctx.lineTo(x+32,y+8);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#e0ce9a';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(x-34,y+16);ctx.quadraticCurveTo(x,y+35,x+35,y+10);ctx.stroke();
      const pulse=16+(Math.sin(time/470)+1)*10;
      ctx.beginPath();ctx.arc(x,y-4,pulse,0,Math.PI*2);
      ctx.strokeStyle='#eed8a654';ctx.lineWidth=3;ctx.stroke();
    }
    // A collapsed stair offers tactical focus, not more free treasure.
    {
      const [x,y]=center(T.CACHE);
      ctx.save();ctx.translate(x,y);
      ctx.rotate(-.28);
      for(let i=0;i<4;i++){
        ctx.fillStyle=i%2?'#9a957f':'#6e766f';
        ctx.fillRect(-33+i*7,-26+i*15,69-i*12,16);
      }ctx.restore();
    }
    // Stone sarcophagus is behind the hidden stair, not visible from the hall.
    {
      const [x,y]=center(T.RELIC);
      ellipse(ctx,x,y+30,47,18,'#142732');
      ctx.fillStyle=f.relic?'#626864':'#9b9a7d';
      ctx.fillRect(x-42,y-18,83,52);
      ctx.fillStyle='#49565c';ctx.fillRect(x-39,y-13,77,15);
      ctx.strokeStyle='#d0bb83';ctx.lineWidth=3;
      ctx.strokeRect(x-32,y-13,63,35);
      if(!f.relic){
        ellipse(ctx,x,y-19,8,6,'#ffe4a5');
        ellipse(ctx,x,y-19,25,21,'#eec97c36');
      }
    }
    // Upward stairs are locked until the physical guard has been defeated.
    {
      const [x,y]=center(T.STAIRS);
      ctx.fillStyle='#132630';ctx.fillRect(x-43,y-55,86,111);
      for(let i=0;i<5;i++){
        ctx.fillStyle=i%2?'#637376':'#87948b';
        ctx.fillRect(x-35+i*4,y+34-i*17,70-i*8,12);
      }
      if(!f.guard){ctx.strokeStyle='#ba8952';ctx.lineWidth=8;
        ctx.beginPath();ctx.moveTo(x-31,y-16);ctx.lineTo(x+31,y+26);
        ctx.moveTo(x+31,y-16);ctx.lineTo(x-31,y+26);ctx.stroke();}
    }
    // The guardian appears only when lit through exploration fog.
    if(!f.guard){
      const [x,y]=center(T.GUARD);
      ellipse(ctx,x,y+37,30,11,'#0c1c28b5');
      const bob=Math.sin(time/490)*2;
      ctx.fillStyle='#879aa0';ctx.fillRect(x-22,y-18+bob,44,45);
      ctx.fillStyle='#b5bcae';ctx.fillRect(x-16,y-31+bob,32,19);
      ctx.fillStyle='#23343b';ctx.fillRect(x-11,y-22+bob,22,5);
      ctx.fillStyle='#ead398';ctx.fillRect(x-8,y-20+bob,6,3);
      ctx.fillRect(x+4,y-20+bob,6,3);
      ctx.strokeStyle='#bebba5';ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(x+22,y-12);ctx.lineTo(x+38,y+36);ctx.stroke();
    }
    // Warm side torches make the halls feel different from green woodland.
    for(const id of [14,22]){
      const [x,y]=center(id);
      const n=Math.sin(time/250+id)*3;
      ctx.fillStyle='#282c2d';ctx.fillRect(x-42,y-45,7,48);
      ellipse(ctx,x-39,y-51+n,8,15,'#edbc69');
      ellipse(ctx,x-39,y-51+n,3,9,'#fff0b1');
      const glow=ctx.createRadialGradient(x-39,y-50,1,x-39,y-50,64);
      glow.addColorStop(0,'#e2b8753b');glow.addColorStop(1,'#e2b87500');
      ellipse(ctx,x-39,y-50,64,64,glow);
    }
  }
  function fog(ctx,f){
    ctx.save();ctx.fillStyle='#08151be9';ctx.fillRect(0,0,W,W);
    ctx.globalCompositeOperation='destination-out';
    for(let i=0;i<T.COUNT;i++){
      if(!T.visible(f,i))continue;
      const [x,y]=center(i),r=96;
      const g=ctx.createRadialGradient(x,y,30,x,y,r);
      g.addColorStop(0,'#000');g.addColorStop(.52,'#000');g.addColorStop(1,'#0000');
      ellipse(ctx,x,y,r,r,g);
    }
    ctx.restore();
  }
  function traveler(ctx,x,y,time){
    const sway=Math.sin(time/170)*2;
    ellipse(ctx,x,y+32,26,11,'#06161dc2');
    ctx.fillStyle='#a9845e';ctx.beginPath();
    ctx.moveTo(x-16,y-9+sway);ctx.lineTo(x+15,y-9+sway);
    ctx.lineTo(x+24,y+24);ctx.lineTo(x-20,y+24);ctx.closePath();ctx.fill();
    ellipse(ctx,x,y-20+sway,13,14,'#e5cda2');
    ctx.fillStyle='#394e45';ctx.fillRect(x-18,y-30+sway,36,10);
    ctx.strokeStyle='#dfd09e';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(x+16,y-3);ctx.lineTo(x+30,y-30);ctx.stroke();
  }
  function mount(scope){
    if(active?.raf)root.cancelAnimationFrame(active.raf);
    active=null;
    const section=scope?.querySelector?.('.tower-field'),canvas=section?.querySelector('.forest-world-canvas');
    if(!section||!canvas||!T)return;
    const f={pos:Number(section.dataset.fieldPos),seen:Number(section.dataset.fieldSeen),
      echo:section.dataset.towerEcho==='true',open:section.dataset.towerOpen==='true',
      relic:section.dataset.towerRelic==='true',guard:section.dataset.towerGuard==='true',
      cache:section.dataset.towerCache==='true'};
    if(!T.valid(f))return;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
    // Remove fog from a separate transparent layer, never from painted stone.
    // The mask changes only on player action, so compose it once per mount.
    const mist=root.document.createElement('canvas');mist.width=W;mist.height=W;
    const mistCtx=mist.getContext('2d');if(!mistCtx)return;
    fog(mistCtx,f);
    section.classList.add('world-painted');
    const worldspace=section.querySelector('.field-worldspace');
    const size=worldspace?.clientWidth||0;
    const last=previous;previous=f.pos;
    const start=last!==null&&T.adjacent(last,f.pos)?center(last):center(f.pos);
    const end=center(f.pos),zoom=1.62;
    const started=root.performance?.now?.()||0;
    const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const instance={raf:0};active=instance;
    let lastFrame=0;
    function frame(time){
      if(!canvas.isConnected||active!==instance)return;
      const t=reduced?1:Math.min(1,Math.max(0,(time-started)/400));
      if(time-lastFrame<45&&t<1){instance.raf=root.requestAnimationFrame(frame);return;}
      lastFrame=time;
      const ease=1-(1-t)**3;
      const x=start[0]+(end[0]-start[0])*ease,y=start[1]+(end[1]-start[1])*ease;
      if(worldspace&&size){
        const edge=size*(1-zoom);
        const tx=Math.max(edge,Math.min(0,size/2-x/W*size*zoom));
        const ty=Math.max(edge,Math.min(0,size/2-y/W*size*zoom));
        worldspace.style.transform='translate3d('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px,0) scale('+zoom+')';
      }
      ruins(ctx,f,time);ctx.drawImage(mist,0,0);traveler(ctx,x,y,time);
      const grad=ctx.createRadialGradient(300,300,100,300,300,420);
      grad.addColorStop(0,'#0c171a00');grad.addColorStop(1,'#09131d9f');
      ctx.fillStyle=grad;ctx.fillRect(0,0,W,W);
      // The tower is still after the step. Continuous redraws flash on phones.
      instance.raf=t<1?root.requestAnimationFrame(frame):0;
    }
    frame(started+50);
  }
  root.CrownlessTowerWorld={mount};
})(typeof window==='object'?window:null);

/* Star-fen walkable scene: water sounds suggested by ripples, not a grid UI.
 * Entirely local Canvas and DOM state; no sound, GPS, external assets. */
(function(root){
 'use strict';
 if(!root)return;
 const M=root.CrownlessFenField,W=600,CELL=120;
 let active=null,previous=null;
 const center=id=>{const [x,y]=M.coords(id);return [x*CELL+60,y*CELL+60];};
 function ellipse(ctx,x,y,rx,ry,color){
   ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
 }
 function scene(ctx,f,time){
   ctx.fillStyle='#0a222c';ctx.fillRect(0,0,W,W);
   for(let id=0;id<M.COUNT;id++){
     const [x,y]=center(id),water=M.WALLS.includes(id);
     if(water){
       ctx.fillStyle='#102f3c';ctx.fillRect(x-60,y-60,120,120);
       for(let k=0;k<4;k++){
         const rx=x+Math.sin(id*8+k*17)*50,ry=y+Math.cos(id*11+k*9)*46;
         ctx.beginPath();ctx.ellipse(rx,ry,19+Math.sin(time/520+id+k)*5,5,0,0,Math.PI*2);
         ctx.strokeStyle='#79bec454';ctx.lineWidth=2;ctx.stroke();
       }
       ellipse(ctx,x+30,y-23,10,5,'#42766c88');
     }else{
       ctx.fillStyle=(id%3===0)?'#37483c':'#3b5243';ctx.fillRect(x-60,y-60,120,120);
       ellipse(ctx,x,y+13,58,40,'#4d6142a9');
       ellipse(ctx,x-34,y-17,22,9,'#7a84535e');
       for(let i=0;i<6;i++){
         const dx=Math.sin(id*7+i*9)*48,dy=Math.cos(id*5+i*13)*43;
         ctx.strokeStyle=i%2?'#789565a9':'#637e55b8';ctx.lineWidth=2;
         ctx.beginPath();ctx.moveTo(x+dx,y+dy+10);ctx.lineTo(x+dx+Math.sin(time/650+id+i)*4,y+dy-10);ctx.stroke();
       }
       ellipse(ctx,x+30,y+25,17,6,'#142f30ad');
     }
   }
   // Reed bank: its moving tips imply a current underneath the mud.
   {
     const [x,y]=center(M.REEDS);
     for(let i=0;i<12;i++){
       const dx=(i-5.5)*8,bob=Math.sin(time/420+i)*6;
       ctx.strokeStyle=i%3?'#8ca175':'#c1b17e';ctx.lineWidth=3;
       ctx.beginPath();ctx.moveTo(x+dx,y+35);ctx.quadraticCurveTo(x+dx+bob,y-15,x+dx+bob*2,y-43+(i%3)*10);ctx.stroke();
       ellipse(ctx,x+dx+bob*2,y-38+(i%3)*10,3,8,'#685f417e');
     }
     if(!f.sound){
       const [rx,ry]=center(M.SHOAL);
       ctx.strokeStyle='#a9d5ca7d';ctx.lineWidth=3;
       ctx.beginPath();ctx.arc(rx,ry,17+Math.sin(time/370)*7,0,Math.PI*2);ctx.stroke();
     }
   }
   // The shoal is invisible as a passage until reeds and sound are examined.
   {
     const [x,y]=center(M.SHOAL);
     ctx.fillStyle='#16404a';ctx.fillRect(x-57,y-57,114,114);
     for(let i=0;i<5;i++){
       ctx.strokeStyle='#83bdc478';ctx.lineWidth=2;
       ctx.beginPath();ctx.ellipse(x,y,19+i*12+(Math.sin(time/500+i)*3),9+i*8,0,0,Math.PI*2);ctx.stroke();
     }
     if(f.shoal){
       for(let i=0;i<4;i++){
         ellipse(ctx,x-34+i*22,y+31-i*19,15,9,'#82977b');
         ellipse(ctx,x-34+i*22,y+28-i*19,9,4,'#bdc39c');
       }
     }else{
       for(let i=0;i<5;i++){
         ellipse(ctx,x-31+i*16+Math.sin(time/420+i)*5,y+35,14,25,i%2?'#446a54':'#375c4d');
       }
     }
   }
   // Fallen star: a gold-blue light that becomes a dull altar after discovery.
   {
     const [x,y]=center(M.STAR);
     ellipse(ctx,x,y+27,43,18,'#081e27bb');
     ellipse(ctx,x,y+8,39,25,'#61706c');
     ellipse(ctx,x,y+1,29,14,'#8d9e8f');
     if(!f.star){
       const glow=ctx.createRadialGradient(x,y-10,0,x,y-10,62);
       glow.addColorStop(0,'#b4f3fac4');glow.addColorStop(1,'#8cdbdf00');
       ellipse(ctx,x,y-10,62,62,glow);
       const gleam=Math.sin(time/450)*5;
       ctx.fillStyle='#e9ffef';ctx.beginPath();
       ctx.moveTo(x,y-45+gleam);ctx.lineTo(x+9,y-14);ctx.lineTo(x,y);ctx.lineTo(x-9,y-14);ctx.closePath();ctx.fill();
     }
   }
   // Wraith is a deliberate optional danger on the *dry* route.
   if(!f.wraith){
     const [x,y]=center(M.WRAITH),float=Math.sin(time/380)*6;
     ellipse(ctx,x,y+33,30,10,'#061d27a3');
     const fog=ctx.createRadialGradient(x,y+float-10,3,x,y+float-10,50);
     fog.addColorStop(0,'#a8e2d3a5');fog.addColorStop(1,'#8fc8da00');
     ellipse(ctx,x,y+float-10,50,55,fog);
     ctx.fillStyle='#b6e8e0b4';ctx.beginPath();ctx.moveTo(x,y-38+float);
     ctx.quadraticCurveTo(x+33,y-16+float,x+24,y+30+float);
     ctx.quadraticCurveTo(x+8,y+14+float,x,y+31+float);
     ctx.quadraticCurveTo(x-8,y+14+float,x-24,y+30+float);
     ctx.quadraticCurveTo(x-31,y-16+float,x,y-38+float);ctx.fill();
     ellipse(ctx,x-9,y-10+float,3,4,'#203e46');
     ellipse(ctx,x+9,y-10+float,3,4,'#203e46');
   }
   // Accessible herb island and the unmistakably dry exit.
   {
     const [x,y]=center(M.HERBS);
     for(let i=0;i<4;i++){
       ctx.strokeStyle=f.herbs?'#586b52':'#98c99e';ctx.lineWidth=4;
       ctx.beginPath();ctx.moveTo(x-19+i*12,y+21);
       ctx.lineTo(x-25+i*13,y-25+(i%2)*7);ctx.stroke();
       ellipse(ctx,x-23+i*13,y-27+(i%2)*7,7,12,f.herbs?'#617a59':'#91c4a2');
     }
   }
   {
     const [x,y]=center(M.EXIT);
     ctx.fillStyle='#a2956e';ctx.fillRect(x-27,y-27,10,65);ctx.fillRect(x+17,y-27,10,65);
     ctx.fillRect(x-31,y-31,62,10);
     ellipse(ctx,x,y+30,35,12,'#344a3f');
   }
 }
 function fog(ctx,f){
   ctx.save();ctx.fillStyle='#071d27ea';ctx.fillRect(0,0,W,W);
   ctx.globalCompositeOperation='destination-out';
   for(let i=0;i<M.COUNT;i++){
     if(!M.visible(f,i))continue;
     const [x,y]=center(i);
     const g=ctx.createRadialGradient(x,y,28,x,y,106);
     g.addColorStop(0,'#000');g.addColorStop(.5,'#000');g.addColorStop(1,'#0000');
     ellipse(ctx,x,y,106,106,g);
   }
   ctx.restore();
 }
 function hero(ctx,x,y,time){
   const swing=Math.sin(time/180)*2;
   ellipse(ctx,x,y+32,24,9,'#081d24ac');
   ctx.fillStyle='#977c57';ctx.beginPath();ctx.moveTo(x-18,y-4+swing);
   ctx.lineTo(x+14,y-6+swing);ctx.lineTo(x+22,y+23);ctx.lineTo(x-18,y+24);ctx.closePath();ctx.fill();
   ellipse(ctx,x,y-20+swing,13,14,'#e4cca5');
   ctx.fillStyle='#334a42';ctx.fillRect(x-18,y-31+swing,36,9);
   ctx.strokeStyle='#dad5ac';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+17,y);ctx.lineTo(x+29,y-33);ctx.stroke();
 }
 function mount(scope){
   if(active?.raf)root.cancelAnimationFrame(active.raf);
   active=null;
   const section=scope?.querySelector?.('.fen-field'),canvas=section?.querySelector('.forest-world-canvas');
   if(!section||!canvas||!M)return;
   const f={pos:Number(section.dataset.fieldPos),seen:Number(section.dataset.fieldSeen),
     sound:section.dataset.fenSound==='true',shoal:section.dataset.fenShoal==='true',
     star:section.dataset.fenStar==='true',wraith:section.dataset.fenWraith==='true',
     herbs:section.dataset.fenHerbs==='true'};
   if(!M.valid(f))return;
   const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
   // Cut holes from a separate fog layer. destination-out on the main
   // canvas would erase the illuminated terrain as well as the fog.
   const mist=root.document.createElement('canvas');mist.width=W;mist.height=W;
   const mistCtx=mist.getContext('2d');if(!mistCtx)return;
   section.classList.add('world-painted');
   const worldspace=section.querySelector('.field-worldspace'),size=worldspace?.clientWidth||0;
   const last=previous;previous=f.pos;
   const start=last!==null&&M.adjacent(last,f.pos)?center(last):center(f.pos),end=center(f.pos);
   const zoom=1.65,started=root.performance?.now?.()||0;
   const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
   const inst={raf:0};active=inst;let lastFrame=0;
   function frame(time){
     if(!canvas.isConnected||active!==inst)return;
     inst.raf=root.requestAnimationFrame(frame);
     if(time-lastFrame<45)return;lastFrame=time;
     const t=reduced?1:Math.min(1,Math.max(0,(time-started)/430));
     const ease=1-(1-t)**3;
     const x=start[0]+(end[0]-start[0])*ease,y=start[1]+(end[1]-start[1])*ease;
     if(worldspace&&size){
       const edge=size*(1-zoom);
       const tx=Math.max(edge,Math.min(0,size/2-x/W*size*zoom));
       const ty=Math.max(edge,Math.min(0,size/2-y/W*size*zoom));
       worldspace.style.transform='translate3d('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px,0) scale('+zoom+')';
     }
     scene(ctx,f,time);fog(mistCtx,f);ctx.drawImage(mist,0,0);hero(ctx,x,y,time);
     const dark=ctx.createRadialGradient(300,300,120,300,300,425);
     dark.addColorStop(0,'#071d2300');dark.addColorStop(1,'#08151ca8');
     ctx.fillStyle=dark;ctx.fillRect(0,0,W,W);
   }
   frame(started+50);
 }
 root.CrownlessFenWorld={mount};
})(typeof window==='object'?window:null);

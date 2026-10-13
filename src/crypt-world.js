/* Grey-Crown Crypt: moving torchlight, cast shadows and a sealed archive.
 * This is drawn terrain, not a reskinned menu or a real-world map. */
(function(root){
 'use strict';
 if(!root)return;
 const C=root.CrownlessCryptField,W=600,CELL=120;
 let active=null,previous=null;
 const center=id=>{const [x,y]=C.coords(id);return [x*CELL+60,y*CELL+60];};
 function ellipse(ctx,x,y,rx,ry,color){
   ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
 }
 function scene(ctx,f,time){
   ctx.fillStyle='#16151d';ctx.fillRect(0,0,W,W);
   for(let id=0;id<C.COUNT;id++){
     const [x,y]=center(id),wall=C.WALLS.includes(id);
     if(wall){
       ctx.fillStyle='#292733';ctx.fillRect(x-60,y-60,120,120);
       ctx.fillStyle='#3f3942';ctx.fillRect(x-58,y-56,116,13);
       ctx.fillStyle='#1b1a24';ctx.fillRect(x-54,y-40,108,84);
       ctx.strokeStyle='#66545c';ctx.lineWidth=3;
       for(let k=0;k<3;k++){
         ctx.beginPath();ctx.moveTo(x-52,y-34+k*30);
         ctx.lineTo(x+52,y-34+k*30);ctx.stroke();
       }
       ctx.fillStyle='#4b434b';ctx.fillRect(x-56,y+46,112,11);
     }else{
       ctx.fillStyle=id%2?'#47414a':'#51464c';ctx.fillRect(x-60,y-60,120,120);
       ctx.strokeStyle='#8a777055';ctx.lineWidth=2;
       ctx.beginPath();ctx.moveTo(x-58,y-58);ctx.lineTo(x+57,y-58);
       ctx.moveTo(x-58,y+55);ctx.lineTo(x+57,y+55);
       ctx.moveTo(x-4,y-58);ctx.lineTo(x+5,y+55);ctx.stroke();
       ellipse(ctx,x+27,y+21,23,8,'#201c2a5e');
     }
   }
   // The two braziers are separated by the tomb floor. Reaching the
   // second one first only reveals an unlit inscription; no free shortcut.
   for(const [id,lit,accent] of [[C.FIRST,f.first,'#e8a565'],[C.SECOND,f.second,'#c6a8e4']]){
     const [x,y]=center(id),pulse=Math.sin(time/260+id)*4;
     ellipse(ctx,x,y+26,35,11,'#1b1921');
     ctx.fillStyle='#776a63';ctx.fillRect(x-21,y+4,42,24);
     ctx.fillStyle='#b0a08d';ctx.fillRect(x-28,y-2,56,12);
     ctx.strokeStyle='#cabbb1';ctx.lineWidth=3;
     ctx.beginPath();ctx.moveTo(x-26,y+5);ctx.lineTo(x+26,y+5);ctx.stroke();
     if(lit){
       const g=ctx.createRadialGradient(x,y-15,2,x,y-15,95);
       g.addColorStop(0,accent+'b8');g.addColorStop(1,'#b86b5000');
       ellipse(ctx,x,y-15,95,95,g);
       ctx.fillStyle=accent;ctx.beginPath();
       ctx.moveTo(x-13,y-7);ctx.quadraticCurveTo(x-4,y-45+pulse,x+3,y-48+pulse);
       ctx.quadraticCurveTo(x+25,y-15+pulse,x+8,y-6);ctx.closePath();ctx.fill();
       ellipse(ctx,x,y-9,7,15,'#fff0bc');
     }else{
       ellipse(ctx,x,y-3,17,6,'#201a23');
       ctx.strokeStyle='#c5aa845c';ctx.beginPath();ctx.arc(x,y-4,31,0,Math.PI*2);ctx.stroke();
     }
   }
   // The sealed slab opens through *two separate discoveries*, not a
   // hidden-tile click. There is never a gold navigation mark on this tile.
   {
     const [x,y]=center(C.SEAL);
     ctx.fillStyle=f.second?'#11151d':'#302934';ctx.fillRect(x-56,y-55,112,110);
     if(f.second){
       ctx.fillStyle='#14131d';ctx.fillRect(x-32,y-49,64,97);
       ctx.fillStyle='#806c60';ctx.fillRect(x-45,y-49,12,100);
       ctx.fillRect(x+33,y-49,12,100);
       ctx.strokeStyle='#dbb68a';ctx.lineWidth=3;
       ctx.beginPath();ctx.moveTo(x-22,y+27);ctx.lineTo(x+22,y-28);ctx.stroke();
     }else{
       ctx.strokeStyle='#a39086';ctx.lineWidth=5;ctx.strokeRect(x-38,y-43,76,88);
       ctx.beginPath();ctx.moveTo(x-25,y-30);ctx.lineTo(x+25,y+31);
       ctx.moveTo(x+25,y-30);ctx.lineTo(x-25,y+31);ctx.stroke();
       for(const [dx,lit] of [[-18,f.first],[18,f.second]]){
         ellipse(ctx,x+dx,y+8,7,7,lit?'#f5c78d':'#4a3c45');
       }
     }
   }
   // A carved epitaph: knowledge and scrap, never a finished weapon.
   {
     const [x,y]=center(C.ARCHIVE);
     ellipse(ctx,x,y+28,43,16,'#15141b');
     ctx.fillStyle='#8a7d76';ctx.fillRect(x-38,y-43,76,80);
     ctx.fillStyle='#a79a88';ctx.fillRect(x-32,y-37,64,8);
     ctx.strokeStyle=f.archive?'#5e5b61':'#e2c08d';ctx.lineWidth=3;
     ctx.beginPath();ctx.moveTo(x-23,y-8);ctx.lineTo(x+23,y-8);
     ctx.moveTo(x-18,y+5);ctx.lineTo(x+19,y+5);
     ctx.moveTo(x-11,y+19);ctx.lineTo(x+12,y+19);ctx.stroke();
     if(!f.archive){
       const glow=ctx.createRadialGradient(x,y,1,x,y,60);
       glow.addColorStop(0,'#f1d1a466');glow.addColorStop(1,'#f1d1a400');
       ellipse(ctx,x,y,60,60,glow);
     }
   }
   // The arch continues into the existing deeper crypt, with its own king.
   {
     const [x,y]=center(C.EXIT);
     ctx.fillStyle='#7b6968';ctx.fillRect(x-43,y-48,86,98);
     ctx.fillStyle='#17141d';ctx.beginPath();ctx.moveTo(x-30,y+46);
     ctx.lineTo(x-30,y-13);ctx.arc(x,y-13,30,Math.PI,0);
     ctx.lineTo(x+30,y+46);ctx.closePath();ctx.fill();
     ctx.strokeStyle='#a69379';ctx.lineWidth=6;
     ctx.beginPath();ctx.arc(x,y-13,30,Math.PI,0);ctx.stroke();
     ellipse(ctx,x,y+40,27,7,'#aa927054');
   }
 }
 function fog(ctx,f){
   ctx.clearRect(0,0,W,W);
   ctx.save();ctx.fillStyle='#0c0b14f0';ctx.fillRect(0,0,W,W);
   ctx.globalCompositeOperation='destination-out';
   for(let id=0;id<C.COUNT;id++){
     if(!C.visible(f,id))continue;
     const [x,y]=center(id),g=ctx.createRadialGradient(x,y,28,x,y,100);
     g.addColorStop(0,'#000');g.addColorStop(.55,'#000');g.addColorStop(1,'#0000');
     ellipse(ctx,x,y,100,100,g);
   }
   ctx.restore();
 }
 function hero(ctx,x,y,time){
   const sway=Math.sin(time/180)*2;
   ellipse(ctx,x,y+31,24,9,'#0c0b14b8');
   ctx.fillStyle='#916f62';ctx.beginPath();ctx.moveTo(x-17,y-5+sway);
   ctx.lineTo(x+15,y-5+sway);ctx.lineTo(x+23,y+23);ctx.lineTo(x-18,y+23);ctx.closePath();ctx.fill();
   ellipse(ctx,x,y-21+sway,13,14,'#e5c9a7');
   ctx.fillStyle='#443c4c';ctx.fillRect(x-18,y-31+sway,36,9);
   ctx.strokeStyle='#f0d39d';ctx.lineWidth=4;
   ctx.beginPath();ctx.moveTo(x+16,y);ctx.lineTo(x+27,y-31);ctx.stroke();
 }
 function mount(scope){
   if(active?.raf)root.cancelAnimationFrame(active.raf);
   active=null;
   const section=scope?.querySelector?.('.crypt-field'),canvas=section?.querySelector('.forest-world-canvas');
   if(!section||!canvas||!C)return;
   const f={pos:Number(section.dataset.fieldPos),seen:Number(section.dataset.fieldSeen),
     first:section.dataset.cryptFirst==='true',second:section.dataset.cryptSecond==='true',
     archive:section.dataset.cryptArchive==='true'};
   if(!C.valid(f))return;
   const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
   const mist=root.document.createElement('canvas');mist.width=W;mist.height=W;
   const mistCtx=mist.getContext('2d');if(!mistCtx)return;
   section.classList.add('world-painted');
   const space=section.querySelector('.field-worldspace'),size=space?.clientWidth||0;
   const last=previous;previous=f.pos;
   const start=last!==null&&C.adjacent(last,f.pos)?center(last):center(f.pos),end=center(f.pos);
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
     if(space&&size){
       const edge=size*(1-zoom);
       const tx=Math.max(edge,Math.min(0,size/2-x/W*size*zoom));
       const ty=Math.max(edge,Math.min(0,size/2-y/W*size*zoom));
       space.style.transform='translate3d('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px,0) scale('+zoom+')';
     }
     scene(ctx,f,time);fog(mistCtx,f);ctx.drawImage(mist,0,0);hero(ctx,x,y,time);
     const shade=ctx.createRadialGradient(300,300,120,300,300,425);
     shade.addColorStop(0,'#0d0b1600');shade.addColorStop(1,'#0d0b16a8');
     ctx.fillStyle=shade;ctx.fillRect(0,0,W,W);
   }
   frame(started+50);
 }
 root.CrownlessCryptWorld={mount};
})(typeof window==='object'?window:null);

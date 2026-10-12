/* A tiny, dependency-free 2D game scene for the first forest expedition.
   The engine owns navigation/rewards; Canvas only paints fantasy terrain.
   No raw GPS points, network assets, tile buttons rendered as boxes, or saves. */
(function(root){
  'use strict';
  if(!root || !root.document) return;
  const F=root.CrownlessField;
  const W=600, CELL=120;
  let previous=null, active=null;
  function random(seed){
    let n=seed>>>0;
    return function(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  }
  function ellipse(ctx,x,y,rx,ry,color){
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
  }
  function line(ctx,pts,width,color){
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.strokeStyle=color;ctx.lineWidth=width;
    ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  }
  const center=id=>[(id%5+.5)*CELL,(Math.floor(id/5)+.5)*CELL];
  function ground(ctx){
    const g=ctx.createLinearGradient(0,0,W,W);
    g.addColorStop(0,'#233e38');g.addColorStop(.5,'#324f3b');g.addColorStop(1,'#101f25');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,W);
    const r=random(891);
    for(let i=0;i<490;i++){
      const x=r()*W,y=r()*W,rad=6+r()*36;
      ellipse(ctx,x,y,rad,rad*.43,i%3===0?'#51684b32':i%3===1?'#142b2d36':'#6b735046');
    }
    // A winding, broad woodland trail rather than lines between squares.
    const trails=[
      [[60,540],[180,540],[300,540],[420,540],[540,540],[540,420],[540,300],[540,180],[540,60]],
      [[180,540],[180,420]],[[420,540],[420,420],[420,300],[420,180]]
    ];
    for(const track of trails){
      line(ctx,track,80,'#091b1d66');
      line(ctx,track,64,'#736c4e63');
      line(ctx,track,47,'#86785865');
      line(ctx,track,29,'#8a806063');
    }
    const r2=random(4821);
    for(let i=0;i<570;i++){
      const x=r2()*W,y=r2()*W;ellipse(ctx,x,y,1+r2()*2,1+r2(),i%4===0?'#b4aa765a':'#172d2599');
    }
  }
  function stump(ctx,x,y,size,seed){
    const r=random(seed);
    ellipse(ctx,x+3,y+11,size*.66,size*.28,'#071c1999');
    ctx.save();ctx.translate(x,y);
    ctx.rotate((r()-.5)*.2);
    ctx.fillStyle='#40352b';
    ctx.fillRect(-size*.24,-size*.3,size*.48,size*.68);
    ellipse(ctx,0,-size*.27,size*.25,size*.12,'#89744b');
    ellipse(ctx,0,-size*.27,size*.13,size*.065,'#5e472f');
    ctx.restore();
  }
  function tree(ctx,x,y,size,seed){
    const r=random(seed);
    ellipse(ctx,x+size*.17,y+size*.52,size*.7,size*.27,'#09191c9e');
    // Exposed roots show these as massive forest trees, not abstract buttons.
    for(let k=0;k<4;k++){
      const a=(k/4)*Math.PI*2+r()*.6;
      line(ctx,[[x,y+size*.2],[x+Math.cos(a)*size*.57,y+size*.25+Math.sin(a)*size*.24]],3,'#433b2c');
    }
    ellipse(ctx,x,y+size*.13,size*.18,size*.34,'#594638');
    const leaves=['#163f35','#205044','#295745','#32604a','#3a654c','#193d36'];
    for(let j=0;j<8;j++){
      const a=j/8*Math.PI*2+r()*.23;
      const x1=x+Math.cos(a)*size*.30,y1=y-size*.14+Math.sin(a)*size*.22;
      ellipse(ctx,x1,y1,size*(.28+r()*.05),size*(.25+r()*.05),leaves[(j+Math.floor(r()*3))%leaves.length]);
    }
    ellipse(ctx,x,y-size*.27,size*.34,size*.25,'#315d47');
    for(let k=0;k<9;k++){
      const dx=(r()-.5)*size*.75,dy=(r()-.5)*size*.48;
      ellipse(ctx,x+dx,y-size*.27+dy,size*(.035+r()*.05),size*.023,
        k%3===0?'#6c926476':'#153d3699');
    }
  }
  function stone(ctx,x,y,size,r){
    ctx.save();ctx.translate(x,y);ctx.rotate((r()-.5)*.65);
    ellipse(ctx,3,size*.18,size*.75,size*.32,'#09191cac');
    ctx.beginPath();
    ctx.moveTo(-size*.52,0);ctx.lineTo(-size*.29,-size*.49);ctx.lineTo(size*.22,-size*.55);
    ctx.lineTo(size*.55,-size*.06);ctx.lineTo(size*.36,size*.29);
    ctx.lineTo(-size*.22,size*.31);ctx.closePath();ctx.fillStyle='#5c6c60';ctx.fill();
    line(ctx,[[-size*.29,-size*.49],[0,-size*.12],[size*.55,-size*.06]],1.3,'#a9a88b66');
    ctx.restore();
  }
  function decorations(ctx){
    const r=random(21670);
    for(let id=0;id<25;id++){
      const [cx,cy]=center(id);
      const wall=F.WALLS.includes(id);
      if(wall){
        for(let k=0;k<5;k++){
          const xx=cx+(r()-.5)*94,yy=cy+(r()-.5)*91;
          tree(ctx,xx,yy,34+r()*20,id*73+k*41);
        }
        continue;
      }
      // Vary tree cover with trail clearance and location; no square boundaries.
      for(let k=0;k<3;k++){
        const dx=(r()-.5)*115,dy=(r()-.5)*113;
        if(Math.abs(dx)<23&&Math.abs(dy)<30)continue;
        tree(ctx,cx+dx,cy+dy,18+r()*15,id*29+k*160);
      }
      for(let k=0;k<3;k++){
        stone(ctx,cx+(r()-.5)*112,cy+(r()-.5)*111,4+r()*8,r);
      }
      for(let k=0;k<17;k++){
        const x=cx+(r()-.5)*117,y=cy+(r()-.5)*117;
        if(r()<.36){
          line(ctx,[[x,y],[x-2,y-3],[x-3,y-5]],.9,'#b1ad705f');
        }else{
          ellipse(ctx,x,y,1+r()*2,.9,r()<.5?'#b1b781a3':'#89996c93');
        }
      }
    }
  }
  function landmarks(ctx,cache,tracks,time){
    // Camp fire at the entrance: a tangible safe starting place.
    {
      const [x,y]=center(F.START);
      ellipse(ctx,x,y+8,43,21,'#151a1688');
      ellipse(ctx,x,y+2,29,15,'#655038');
      ellipse(ctx,x,y,17,11,'#251f1b');
      line(ctx,[[x-17,y+5],[x+15,y-5]],6,'#886a41');
      line(ctx,[[x-16,y-6],[x+15,y+7]],6,'#957147');
      ellipse(ctx,x,y-7,11,16,'#f0a45c');
      ellipse(ctx,x,y-8,6,11,'#ffe8a1');
    }
    // The cache is a fallen, moss-covered log with a flickering shard.
    {
      const [x,y]=center(F.CACHE);
      ctx.save();ctx.translate(x,y);ctx.rotate(-.32);
      ellipse(ctx,1,13,45,17,'#081c1c80');
      ctx.fillStyle='#5a4331';ctx.fillRect(-43,-8,83,19);
      ctx.fillStyle='#816343';ctx.fillRect(-40,-8,80,5);
      for(let t=-35;t<40;t+=18){
        line(ctx,[[t,0],[t-3,8]],2,'#3c352c');
        ellipse(ctx,t,-9,8,3,'#65734db2');
      }
      ctx.restore();
      if(!cache){
        const k=.8+.18*Math.sin(time/440);
        ellipse(ctx,x+16,y-18,11*k,11*k,'#f9cc77');
        ellipse(ctx,x+16,y-18,5,5,'#fff6ca');
        for(const [dx,dy] of [[0,-23],[-17,-4],[18,4]]){
          ellipse(ctx,x+16+dx,y-18+dy,2.2,2.2,'#ffeca9');
        }
      }
    }
    // Real tracks, laid as little heel/toe imprints in the trail.
    {
      const [x,y]=center(F.TRACKS);
      for(let k=0;k<3;k++){
        const xx=x-23+k*18,yy=y+17-k*16;
        ellipse(ctx,xx,yy,8,10,'#c0ad845e');
        for(let n=0;n<3;n++)ellipse(ctx,xx-7+n*7,yy-11-(n===1?4:0),3.3,4,'#d1bc8e84');
      }
      if(!tracks){ellipse(ctx,x+15,y-20,9,9,'#adbf8a66');}
    }
    // The wolf den is a physically distinct danger spot.
    {
      const [x,y]=center(F.DEN);
      ellipse(ctx,x,y+10,49,31,'#111a1acb');
      ctx.beginPath();
      ctx.moveTo(x-42,y+8);ctx.quadraticCurveTo(x-34,y-54,x+4,y-54);
      ctx.quadraticCurveTo(x+41,y-51,x+42,y+15);ctx.closePath();
      ctx.fillStyle='#58645a';ctx.fill();
      ellipse(ctx,x,y+15,29,33,'#0a1519');
      ellipse(ctx,x-11,y+8,3,2,'#d57c58');
      ellipse(ctx,x+12,y+8,3,2,'#d57c58');
    }
    // An arch gate invites curiosity, beyond the fog.
    {
      const [x,y]=center(F.EXIT);
      ellipse(ctx,x,y+30,48,20,'#0b1a1b99');
      ctx.fillStyle='#758575';ctx.fillRect(x-43,y-43,17,73);
      ctx.fillRect(x+24,y-43,17,73);
      ctx.fillRect(x-44,y-54,86,18);
      ctx.fillStyle='#a8a788';ctx.fillRect(x-39,y-51,78,5);
      ellipse(ctx,x-34,y-45,17,12,'#4e694c');ellipse(ctx,x+30,y-45,18,14,'#466843');
      const light=ctx.createRadialGradient(x,y-9,5,x,y-9,41);
      light.addColorStop(0,'#aac5ac66');light.addColorStop(1,'#c8d7bb00');
      ellipse(ctx,x,y-8,42,54,light);
    }
  }
  // The wolf is part of the world, not a floating button or text event.
  // It crouches in the den, sniffs, and visibly turns toward the hero when
  // the player enters an adjacent cell. The forest state owns the alert.
  function wolf(ctx,time,alert){
    const [cx,cy]=center(F.DEN);
    const sway=Math.sin(time/280),breath=Math.sin(time/390);
    const x=cx+(alert?8:2)+sway*(alert?2:4);
    const y=cy+25+(alert?4:0)+breath*1.5;
    ctx.save();ctx.translate(x,y);
    const facing=alert?1:-1;
    ctx.scale(facing,1);
    if(alert){
      const g=ctx.createRadialGradient(-4,0,4,-4,0,64);
      g.addColorStop(0,'#e688484b');g.addColorStop(1,'#d8672500');
      ellipse(ctx,-4,-7,60,54,g);
      ellipse(ctx,-3,22,42,10,'#140f1090');
    } else ellipse(ctx,-3,23,35,8,'#081417a3');
    // Walking paws, shoulders and furry back have an unmistakably canine outline.
    ctx.fillStyle='#202d2e';
    for(const foot of [[-27,3],[-12,8],[13,8],[22,3]]){
      ctx.fillRect(foot[0],foot[1],8,24);
      ellipse(ctx,foot[0]+4,foot[1]+24,8,3,'#65726c');
    }
    // Wagging tail becomes stiff as soon as the wolf notices the traveler.
    ctx.save();ctx.translate(-28,-17);
    ctx.rotate((alert?-.55:-.95)+(!alert?sway*.17:0));
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-22,-15);ctx.lineTo(-30,-26);
    ctx.lineTo(-34,-9);ctx.lineTo(-17,-2);ctx.closePath();
    ctx.fillStyle='#596967';ctx.fill();ctx.restore();
    ellipse(ctx,-6,-15,31,21,'#4a5856');
    ellipse(ctx,-1,-22,23,13,'#6c756b');
    ellipse(ctx,12,-11,17,18,'#5b6862');
    // Head is forward and raised when alerted; visible eyes face the player.
    ctx.save();ctx.translate(21,alert?-23:-17);
    ctx.rotate(alert?.08:-.12);
    ctx.beginPath();
    ctx.moveTo(-17,-13);ctx.lineTo(-18,-34);ctx.lineTo(-4,-25);
    ctx.lineTo(4,-34);ctx.lineTo(16,-13);ctx.closePath();
    ctx.fillStyle='#596967';ctx.fill();
    ctx.beginPath();ctx.moveTo(-11,-15);ctx.lineTo(-11,-25);ctx.lineTo(-2,-19);
    ctx.lineTo(6,-26);ctx.lineTo(10,-14);ctx.closePath();
    ctx.fillStyle='#ae9c80';ctx.fill();
    ellipse(ctx,0,-8,19,17,'#77827a');
    ctx.beginPath();ctx.moveTo(7,-8);ctx.lineTo(30,0);ctx.lineTo(15,8);
    ctx.lineTo(4,6);ctx.closePath();
    ctx.fillStyle='#c4bb9f';ctx.fill();
    ellipse(ctx,28,0,5,4,'#202726');
    ellipse(ctx,8,-10,4.5,3.2,alert?'#ff9f55':'#f2d2a0');
    ellipse(ctx,8,-10,2,2,'#211b1c');
    if(alert){
      line(ctx,[[12,8],[19,10],[25,6]],1.4,'#e0c7a4');
      // Breathing wisps around its muzzle, animated separately from the hero.
      ellipse(ctx,34+Math.sin(time/430)*4,0,5,3,'#d7e9ca55');
    }
    ctx.restore();ctx.restore();
    if(alert){
      const bob=3*Math.sin(time/260);
      // This in-world exclamation follows the creature and stays under fog.
      ctx.save();
      ctx.fillStyle='#2b2317ef';
      ctx.beginPath();ctx.arc(cx+23,cy-49+bob,13,0,Math.PI*2);ctx.fill();
      ctx.lineWidth=2;ctx.strokeStyle='#f0c37c';ctx.stroke();
      ctx.font='bold 24px sans-serif';ctx.textAlign='center';
      ctx.fillStyle='#ffe1a7';ctx.fillText('!',cx+23,cy-41+bob);
      ctx.restore();
    }
  }
  function fogLayer(seen){
    // Fog is a single continuous veil. Punch overlapping SOFT circles around
    // what the traveler has seen; never expose grid-cell boundaries.
    // Unknown trees below are generic distant silhouettes independent of
    // actual wall/loot/encounter placement.
    const mask=root.document.createElement('canvas');
    mask.width=mask.height=W;
    const ctx=mask.getContext('2d');
    if(!ctx)return null;
    ctx.fillStyle='#102827';ctx.fillRect(0,0,W,W);
    const r=random(30867);
    for(let i=0;i<63;i++){
      const x=r()*W,y=r()*W,size=10+r()*37;
      ellipse(ctx,x+size*.16,y+size*.48,size*.6,size*.21,'#071c1d5f');
      ctx.fillStyle='#1b3934bb';
      ctx.fillRect(x-2,y-size*.1,4,size*.45);
      ellipse(ctx,x,y-size*.2,size*.48,size*.32,
        i%3===0?'#30514898':'#23453e99');
      ellipse(ctx,x-size*.18,y-size*.26,size*.29,size*.21,
        i%4===0?'#40635154':'#153b3580');
    }
    for(let i=0;i<150;i++){
      const x=r()*W,y=r()*W;
      ellipse(ctx,x,y,13+r()*35,4+r()*12,i%3===0?'#b8cdb813':'#8caaa812');
    }
    ctx.globalCompositeOperation='destination-out';
    for(let i=0;i<25;i++){
      if(!(seen&(1<<i)))continue;
      const [x,y]=center(i);
      const light=ctx.createRadialGradient(x,y,24,x,y,112);
      light.addColorStop(0,'#000000ff');
      light.addColorStop(.36,'#000000ff');
      light.addColorStop(.77,'#000000e8');
      light.addColorStop(1,'#00000000');
      ctx.fillStyle=light;
      ctx.fillRect(x-113,y-113,226,226);
    }
    ctx.globalCompositeOperation='source-over';
    return mask;
  }
  function steps(ctx,pos,seen,time){
    const ns=F.neighbors(pos).filter(n=>(seen&(1<<n))&&!F.WALLS.includes(n));
    for(const n of ns){
      const [x,y]=center(n),s=1+Math.sin(time/350+n)*.1;
      const g=ctx.createRadialGradient(x,y,5,x,y,45*s);
      g.addColorStop(0,'#eac4894d');g.addColorStop(1,'#c6aa5200');
      ellipse(ctx,x,y,45*s,45*s,g);
      ctx.strokeStyle='#f4dfa48c';ctx.lineWidth=2.1;
      ctx.setLineDash([3,8]);ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
  }
  function hero(ctx,x,y,time,walking){
    const bob=Math.sin(time/120)*(walking?3:1);
    const sway=Math.sin(time/200)*2;
    const light=ctx.createRadialGradient(x,y,4,x,y,74);
    light.addColorStop(0,'#f7d89b3d');light.addColorStop(.6,'#f6bd6040');
    light.addColorStop(1,'#f2c46b00');ellipse(ctx,x,y,74,74,light);
    ellipse(ctx,x+3,y+25,22,8,'#07191cb3');
    ctx.save();ctx.translate(x,y+bob);
    // Silhouette with swinging boots, hood, a readable red cloak and lantern.
    ctx.fillStyle='#25362e';
    ctx.fillRect(-10,11+sway,8,19);
    ctx.fillRect(6,11-sway,8,19);
    ctx.beginPath();
    ctx.moveTo(-17,-9);ctx.lineTo(13,-11);ctx.lineTo(22,23);
    ctx.lineTo(-23,23);ctx.closePath();
    ctx.fillStyle='#873f35';ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12,-9);ctx.lineTo(12,-11);ctx.lineTo(14,14);
    ctx.lineTo(-11,14);ctx.closePath();ctx.fillStyle='#c27753';ctx.fill();
    ctx.fillStyle='#d6b98a';ctx.fillRect(-8,-28,17,18);
    ctx.fillStyle='#344c40';ctx.fillRect(-12,-30,23,10);
    ctx.fillStyle='#2f453b';ctx.fillRect(-11,-34,20,8);
    ctx.fillStyle='#f8d39b';ctx.fillRect(-4,-18,4,3);
    ctx.fillStyle='#806942';ctx.fillRect(-11,2,23,5);
    ctx.fillStyle='#e2dfcc';ctx.save();ctx.translate(19,-3);
    ctx.rotate(.26);ctx.fillRect(0,-23,4,39);ctx.restore();
    ctx.fillStyle='#d5a463';ctx.fillRect(-23,5,8,10);
    ellipse(ctx,-19,10,8,8,'#e4a45d');
    ellipse(ctx,-19,10,3,4,'#fff4bd');
    ctx.restore();
  }
  function staticWorld(){
    const off=root.document.createElement('canvas');off.width=off.height=W;
    const ctx=off.getContext('2d');
    if(!ctx)return null;
    ground(ctx);decorations(ctx);
    return off;
  }
  function mount(scope){
    const section=scope&&scope.querySelector&&scope.querySelector('.forest-field');
    const canvas=section&&section.querySelector('.forest-world-canvas');
    if(active&&active.raf)root.cancelAnimationFrame(active.raf);
    active=null;
    if(!section||!canvas||typeof canvas.getContext!=='function'||!F)return;
    let ctx;
    try{ctx=canvas.getContext('2d',{alpha:false});}catch{return;}
    if(!ctx)return;
    const pos=Number(section.dataset.fieldPos),seen=Number(section.dataset.fieldSeen);
    if(!F.valid({pos,seen,cache:section.dataset.fieldCache==='true',tracks:section.dataset.fieldTracks==='true'}))return;
    const cache=section.dataset.fieldCache==='true',tracks=section.dataset.fieldTracks==='true';
    const wolfStatus=F.wolfAwareness({pos,seen,cache,tracks});
    const base=staticWorld();
    if(!base)return;
    const mist=fogLayer(seen);
    if(!mist)return;
    section.classList.add('world-painted');
    const worldspace=section.querySelector('.field-worldspace');
    const size=worldspace?.clientWidth||0;
    const zoom=1.58;
    function camera(x,y){
      if(!worldspace||!size)return;
      // Once noticed, compose BOTH figures into the frame while the traveler
      // finishes the step. Do not let the wolf be clipped above the camera.
      const [wolfX,wolfY]=center(F.DEN);
      const focusX=wolfStatus==='alert'?(x+wolfX)*.5:x;
      const focusY=wolfStatus==='alert'?(y+wolfY)*.5:y;
      const targetX=size*.5-(focusX/W)*size*zoom;
      const targetY=size*.5-(focusY/W)*size*zoom;
      const edge=size*(1-zoom);
      const shiftX=Math.max(edge,Math.min(0,targetX));
      const shiftY=Math.max(edge,Math.min(0,targetY));
      worldspace.style.transform='translate3d('+shiftX.toFixed(2)+'px,'+
        shiftY.toFixed(2)+'px,0) scale('+zoom+')';
    }
    const last=previous;
    previous=pos;
    const start=last!==null&&last!==pos&&F.adjacent(last,pos)?center(last):center(pos);
    const end=center(pos);
    const startTime=root.performance&&root.performance.now?root.performance.now():0;
    const reduced=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state={raf:0,canvas};active=state;
    let lastFrame=0;
    function frame(time){
      if(!canvas.isConnected||active!==state)return;
      state.raf=root.requestAnimationFrame(frame);
      if(time-lastFrame<40)return;lastFrame=time;
      const t=reduced?1:Math.min(1,(time-startTime)/410);
      const ease=1-Math.pow(1-t,3);
      const x=start[0]+(end[0]-start[0])*ease;
      const y=start[1]+(end[1]-start[1])*ease;
      camera(x,y);
      ctx.drawImage(base,0,0);
      landmarks(ctx,cache,tracks,time);
      if(wolfStatus!=='hidden')wolf(ctx,time,wolfStatus==='alert');
      ctx.drawImage(mist,0,0);
      steps(ctx,pos,seen,time);
      hero(ctx,x,y,time,t<1);
      // A subtle outer vignette creates a continuous scene, not a board.
      const v=ctx.createRadialGradient(W/2,W/2,140,W/2,W/2,440);
      v.addColorStop(0,'#071c1800');v.addColorStop(1,'#08191699');
      ctx.fillStyle=v;ctx.fillRect(0,0,W,W);
    }
    frame(startTime+50);
  }
  root.CrownlessForestWorld={mount};
})(typeof window==='object'?window:null);

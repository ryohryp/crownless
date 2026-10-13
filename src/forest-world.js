/* A tiny, dependency-free 2D game scene for the first forest expedition.
   The engine owns navigation/rewards; Canvas only paints fantasy terrain.
   No raw GPS points, network assets, tile buttons rendered as boxes, or saves. */
(function(root){
  'use strict';
  if(!root || !root.document) return;
  const F=root.CrownlessField;
  const W=840, CELL=120;
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
  const center=id=>{const [col,row]=F.coords(id);return [(col+.5)*CELL,(row+.5)*CELL];};
  function ground(ctx,secret){
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
      [[180,540],[180,420]],[[420,540],[420,420],[420,300],[420,180]],
      [[540,540],[660,540],[780,540],[780,660],[780,780]],
      [[540,540],[540,660],[660,660],[780,660]],
      [[660,420],[660,540],[660,660]]
    ];
    if(secret) trails.push([[300,420],[300,300],[300,180]]);
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
  function decorations(ctx,secret){
    const r=random(21670);
    for(let id=0;id<F.COUNT;id++){
      const [cx,cy]=center(id);
      const wall=F.WALLS.includes(id)||(id===F.SECRET&&!secret);
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
  function landmarks(ctx,cache,tracks,treasure,wolfDefeated,secret,shrine,glade,foxFled,foxCache,time,foxRun){
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
    // A small treasure chest glints between two mossy trees. Once found it
    // remains visibly open; returning here cannot award its loot twice.
    {
      const [x,y]=center(F.TREASURE);
      ellipse(ctx,x+1,y+19,44,18,'#071715ae');
      ctx.save();ctx.translate(x,y);ctx.rotate(-.10);
      ctx.fillStyle='#37251b';ctx.fillRect(-35,-2,70,33);
      ctx.fillStyle='#a57a43';ctx.fillRect(-32,-2,65,26);
      ctx.fillStyle='#563e2a';ctx.fillRect(-25,2,50,17);
      ctx.fillStyle='#d1a45d';ctx.fillRect(-34,8,69,5);
      ctx.fillStyle='#c7a56a';ctx.fillRect(-6,-8,13,38);
      if(treasure){
        // A lid lifted backward, dark empty cavity, scattered golden light.
        ctx.fillStyle='#483323';ctx.fillRect(-36,-34,71,23);
        ctx.fillStyle='#967044';ctx.fillRect(-32,-30,64,12);
        ctx.fillStyle='#101b1c';ctx.fillRect(-26,1,54,16);
        ellipse(ctx,16,15,4,3,'#d3ac6b');
      }else{
        ctx.fillStyle='#6d4b2e';ctx.fillRect(-36,-17,71,19);
        ctx.fillStyle='#cba261';ctx.fillRect(-32,-16,64,6);
        ctx.fillStyle='#fbe1a2';ctx.fillRect(-5,-12,11,19);
        const glow=ctx.createRadialGradient(x,y-17,1,x,y-17,48);
        glow.addColorStop(0,'#ffdda68a');glow.addColorStop(1,'#f6c66c00');
        ellipse(ctx,0,-17,49,44,glow);
        const wave=.5+.5*Math.sin(time/450);
        ellipse(ctx,0,-31-wave*6,3+wave*2,3+wave*2,'#fff5c1');
      }
      ctx.restore();
    }
    // Tangled vines masquerade as an impenetrable wall. Once stepped into,
    // the brambles split and the traversable shortcut stays physically open.
    {
      const [x,y]=center(F.SECRET);
      if(!secret){
        const sway=Math.sin(time/440)*4;
        ellipse(ctx,x,y+20,51,24,'#0b241db8');
        for(let k=0;k<6;k++){
          const px=x+(k-2.5)*17;
          const py=y+((k%2)*10)-7;
          ellipse(ctx,px+sway*(k%2?-.6:.6),py,22,28,k%2?'#224b36':'#28523c');
          ellipse(ctx,px+sway*(k%2?-.6:.6)-5,py-12,13,8,'#4f715075');
          line(ctx,[[px-9,py+16],[px+sway,py+1],[px+8,py-24]],3,'#6e7249c9');
        }
        // Faint light leaks through the moving branches, not a square marker.
        const g=ctx.createRadialGradient(x,y-10,1,x,y-10,35);
        g.addColorStop(0,'#b4e4c181');g.addColorStop(1,'#8bc8ad00');
        ellipse(ctx,x,y-11,38,40,g);
      } else {
        ellipse(ctx,x,y+9,33,19,'#6d7658a6');
        for(const side of [-1,1]){
          ellipse(ctx,x+side*45,y-2,24,40,'#224c38');
          ellipse(ctx,x+side*34,y-30,26,24,'#315d43');
          line(ctx,[[x+side*35,y-30],[x+side*27,y+1]],4,'#8a875bb0');
        }
        for(let k=0;k<4;k++)ellipse(ctx,x+(k-1.5)*9,y-14+(k%2)*15,3,5,'#a6ba8c73');
      }
    }
    // An ancient resting shrine: bright cyan while unclaimed, unlit stone
    // afterward. It is found by walking to it, never by opening a text menu.
    {
      const [x,y]=center(F.SHRINE);
      ellipse(ctx,x,y+27,48,19,'#081819a8');
      ctx.fillStyle='#617265';ctx.fillRect(x-32,y-20,13,45);
      ctx.fillRect(x+20,y-20,13,45);
      ctx.fillStyle='#8a9984';ctx.fillRect(x-36,y-30,72,15);
      ellipse(ctx,x,y+16,26,12,'#6c796c');
      ctx.fillStyle='#465a50';ctx.fillRect(x-20,y-16,41,33);
      ctx.fillStyle='#9bac93';ctx.fillRect(x-16,y-15,32,5);
      ellipse(ctx,x-21,y-24,13,8,'#497a50');
      ellipse(ctx,x+23,y-24,14,9,'#376e4b');
      const light=shrine?'#566f6966':'#bbf6e6';
      if(!shrine){
        const aura=ctx.createRadialGradient(x,y-20,2,x,y-20,53);
        aura.addColorStop(0,'#b6f5e5bc');aura.addColorStop(1,'#57c9b500');
        ellipse(ctx,x,y-19,51,54,aura);
      }
      line(ctx,[[x-9,y],[x,y+7],[x+9,y],[x,y-10],[x-9,y]],3,light);
      ellipse(ctx,x,y,shrine?3:5,shrine?3:5,light);
      if(!shrine){
        const bob=Math.sin(time/480)*5;
        for(const [dx,dy] of [[-22,-33],[23,-40],[9,-55]]){
          ellipse(ctx,x+dx,y+dy+bob,3,4,'#c4fcf0');
        }
      }
    }
    // A distant moss-covered stone ring rewards following the winding
    // eastward trail. The wider forest is not only empty padding.
    {
      const [x,y]=center(F.GLADE);
      ellipse(ctx,x,y+17,63,32,'#0c261eb2');
      for(let k=0;k<7;k++){
        const t=k*Math.PI*2/7;
        const sx=x+40*Math.cos(t),sy=y+14*Math.sin(t);
        ctx.save();ctx.translate(sx,sy);
        ctx.rotate(Math.sin(t)*.18);
        ctx.fillStyle='#66786a';
        ctx.fillRect(-6,-18,13,26);
        ctx.fillStyle='#8b9e87';
        ctx.fillRect(-6,-18,13,4);
        ctx.restore();
      }
      ellipse(ctx,x,y-7,20,9,'#486a53');
      if(!glade){
        const g=ctx.createRadialGradient(x,y-17,3,x,y-17,53);
        g.addColorStop(0,'#d1ecb882');g.addColorStop(1,'#b0d5a900');
        ellipse(ctx,x,y-17,53,50,g);
        ellipse(ctx,x,y-16+Math.sin(time/360)*4,5,6,'#d9f1c3');
      }
    }
    // A suspicious rustle on the quiet westward dead end first looks like
    // another dangerous beast. It turns out to be a harmless white fox.
    // On approach the animal flees one step deeper, where it has hidden a
    // traveller's pouch. All positions are real cells, not floating UI.
    function whiteFox(id,peeking,runT=1){
      const [destX,destY]=center(id);
      const [fromX,fromY]=center(F.FOX);
      const x=fromX+(destX-fromX)*runT,y=fromY+(destY-fromY)*runT;
      if(peeking){
        // The important mystery beat: rustling leaves and ONE amber eye.
        // No animal silhouette until the player really approaches.
        const sway=Math.sin(time/240)*5;
        ellipse(ctx,x,y+20,42,15,'#0b261ab0');
        for(let i=0;i<5;i++){
          ellipse(ctx,x-33+i*16+sway*(i%2?.6:-.6),y+3+(i%2)*12,23,26,
            i%2?'#28543b':'#1f4537');
        }
        const amber=ctx.createRadialGradient(x+16,y-14,1,x+16,y-14,24);
        amber.addColorStop(0,'#f9c67c8e');amber.addColorStop(1,'#f9c67c00');
        ellipse(ctx,x+16,y-14,24,24,amber);
        ellipse(ctx,x+16,y-14,2.5,2,'#ffd69a');
        return;
      }
      const breath=Math.sin(time/390)*2;
      const wag=Math.sin(time/220)*10;
      ctx.save();ctx.translate(x,y+breath);
      ellipse(ctx,0,21,31,11,'#071d17a0');
      // Wagging pale tail, warm ears, pointed muzzle and bright amber eyes.
      ctx.save();ctx.translate(-21,0);ctx.rotate(wag*Math.PI/550);
      ellipse(ctx,-13,4,26,13,'#dce3d3');
      ellipse(ctx,-29,3,8,9,'#f7f4da');
      ctx.restore();
      ellipse(ctx,3,0,27,17,'#bac9bd');
      ellipse(ctx,16,-15,20,17,'#edf0de');
      ctx.beginPath();ctx.moveTo(4,-23);ctx.lineTo(8,-43);ctx.lineTo(18,-25);
      ctx.lineTo(22,-43);ctx.lineTo(30,-18);ctx.closePath();
      ctx.fillStyle='#d4dbcd';ctx.fill();
      ellipse(ctx,29,-9,15,9,'#f2f0da');
      ellipse(ctx,37,-8,3,2,'#493e37');
      ellipse(ctx,18,-18,3.3,3,'#b17d4a');
      ellipse(ctx,19,-18,1.5,1.5,'#ffe5a4');
      ellipse(ctx,10,19,6,11,'#b8c5b9');
      ellipse(ctx,24,18,6,10,'#d6dcd0');
      ctx.restore();
    }
    if(!foxFled)whiteFox(F.FOX,true);
    else if(!foxCache)whiteFox(F.FOX_NEST,false,foxRun);
    // The small leather bag appears only after the fox has moved out.
    if(foxFled){
      const [x,y]=center(F.FOX_NEST);
      ellipse(ctx,x+2,y+22,30,13,'#071b19a3');
      ctx.save();ctx.translate(x+1,y+6);ctx.rotate(-.13);
      ctx.fillStyle='#745139';ctx.fillRect(-20,-4,39,27);
      ctx.fillStyle='#a27a4e';ctx.fillRect(-18,-13,35,14);
      ctx.fillStyle='#4b3126';ctx.fillRect(-6,-9,14,13);
      ctx.fillStyle='#d3b57b';ctx.fillRect(-2,-2,6,6);
      if(!foxCache){
        const gleam=.5+.5*Math.sin(time/380);
        ellipse(ctx,4,-20-gleam*7,4+gleam*2,5+gleam,'#ffe5a2');
      }else{
        ctx.fillStyle='#122822';ctx.fillRect(-13,2,27,17);
      }
      ctx.restore();
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
      if(!wolfDefeated){
        ellipse(ctx,x-11,y+8,3,2,'#d57c58');
        ellipse(ctx,x+12,y+8,3,2,'#d57c58');
      }
      // A defeated wolf leaves only an unlit, empty entrance.
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
    // All forty-nine cells use the game's number-safe visibility check.
    // Bitwise shifts would wrap at cell 32 and hide discoveries at the edge.
    for(let i=0;i<F.COUNT;i++){
      if(!F.visible({seen},i))continue;
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
  function staticWorld(secret){
    const off=root.document.createElement('canvas');off.width=off.height=W;
    const ctx=off.getContext('2d');
    if(!ctx)return null;
    ground(ctx,secret);decorations(ctx,secret);
    return off;
  }
  function mount(scope){
    const section=scope&&scope.querySelector&&scope.querySelector('.forest-field:not(.tower-field):not(.fen-field)');
    const canvas=section&&section.querySelector('.forest-world-canvas');
    if(active&&active.raf)root.cancelAnimationFrame(active.raf);
    active=null;
    if(!section||!canvas||typeof canvas.getContext!=='function'||!F)return;
    let ctx;
    try{ctx=canvas.getContext('2d',{alpha:false});}catch{return;}
    if(!ctx)return;
    const pos=Number(section.dataset.fieldPos),seen=Number(section.dataset.fieldSeen);
    if(!F.valid({pos,seen,cache:section.dataset.fieldCache==='true',tracks:section.dataset.fieldTracks==='true',secret:section.dataset.fieldSecret==='true',shrine:section.dataset.fieldShrine==='true'}))return;
    const cache=section.dataset.fieldCache==='true',tracks=section.dataset.fieldTracks==='true';
    const treasure=section.dataset.fieldTreasure==='true',wolfDefeated=section.dataset.fieldWolf==='true';
    const secret=section.dataset.fieldSecret==='true',shrine=section.dataset.fieldShrine==='true';
    const glade=section.dataset.fieldGlade==='true';
    const foxFled=section.dataset.fieldFox==='true',foxCache=section.dataset.fieldFoxCache==='true';
    const wolfStatus=F.wolfAwareness({pos,seen,cache,tracks,treasure,wolf:wolfDefeated,secret,shrine});
    const base=staticWorld(secret);
    if(!base)return;
    const mist=fogLayer(seen);
    if(!mist)return;
    section.classList.add('world-painted');
    const worldspace=section.querySelector('.field-worldspace');
    const size=worldspace?.clientWidth||0;
    const zoom=2.1;
    function camera(x,y){
      if(!worldspace||!size)return;
      // Once noticed, compose BOTH figures into the frame while the traveler
      // finishes the step. Do not let the wolf be clipped above the camera.
      const [wolfX,wolfY]=center(F.DEN);
      const focusX=wolfStatus==='alert'?(x+wolfX)*.5:x;
      // Reveal the shrine as an actual new vista when the hidden passage
      // opens, framing both the traveler and the blue stone above the vines.
      const shrineVista=secret&&!shrine&&pos===F.SECRET;
      const focusY=wolfStatus==='alert'?(y+wolfY)*.5:
        shrineVista?(y+center(F.SHRINE)[1])*.5:y;
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
      // The first fox encounter includes a brief dash toward the old tree.
      // A reload displays the settled fox there rather than replaying it.
      const firstFoxEncounter=last===10&&pos===F.FOX&&foxFled&&!foxCache;
      const foxRun=firstFoxEncounter?Math.min(1,Math.max(0,(time-startTime)/800)):1;
      landmarks(ctx,cache,tracks,treasure,wolfDefeated,secret,shrine,glade,foxFled,foxCache,time,foxRun);
      if(wolfStatus==='watching'||wolfStatus==='alert')wolf(ctx,time,wolfStatus==='alert');
      ctx.drawImage(mist,0,0);
      // Traversable destinations are deliberately not highlighted. Read the
      // paths, rustling foliage and fog; invisible HTML hit targets still work.
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

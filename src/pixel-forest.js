/* Crownless forest scene. Presentation only: world positions and bridge heights
 * come from the combat scene. Candidate art never becomes a collision mask.
 * Original PNGs are preserved; the rectangles are reviewed atlas source bounds.
 */
(function(root) {
  'use strict';
  const frames = {
    oak: [0, 0, 660, 610], pine: [685, 0, 325, 610],
    arch: [1000, 65, 536, 545], rocks: [0, 695, 550, 329],
    wall: [565, 680, 580, 344], shrine: [1180, 610, 356, 414]
  };
  function create() {
    const backdrop = new Image(), atlas = new Image();
    backdrop.src = 'assets/action-forest/terrain.png';
    atlas.src = 'assets/action-forest/objects.png';
    const ready = img => img.complete && img.naturalWidth > 0;
    const floor = document.createElement('canvas');
    floor.width = 1050; floor.height = 240;
    const g = floor.getContext('2d');
    let seed = 719;
    function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    g.fillStyle = '#565b42'; g.fillRect(0, 0, 1050, 240);
    // Authored path connects the entry clearing, bridge and far ruin; textured
    // once, never thousands of random calls in each animation frame.
    for(let x=0;x<1050;x+=3) {
      const y=108+Math.sin(x/155)*44;
      g.fillStyle='#8d8265';g.fillRect(x,Math.round(y-44),3,90);
      g.fillStyle='#737452';g.fillRect(x,Math.round(y-48),3,5);
    }
    for(let i=0;i<7000;i++) {
      const x=Math.floor(random()*1050/2)*2,y=Math.floor(random()*240/2)*2;
      const pathY=108+Math.sin(x/155)*44;
      const onPath=Math.abs(y-pathY)<44;
      const colors=onPath?['#9c9071','#80785c','#afa080','#746e54']:['#4c563d','#63694b','#717552','#455138'];
      g.fillStyle=colors[Math.floor(random()*colors.length)];
      g.fillRect(x,y,2+Math.floor(random()*4),1+Math.floor(random()*2));
    }
    // Broad soft canopy shadows, kept behind actors for readable silhouettes.
    for(const [x,y,r] of [[110,50,110],[390,110,85],[735,70,100],[990,180,75]]) {
      const shadow=g.createRadialGradient(x,y,0,x,y,r);
      shadow.addColorStop(0,'rgba(25,38,24,.32)');shadow.addColorStop(1,'rgba(25,38,24,0)');
      g.fillStyle=shadow;g.fillRect(x-r,y-r,r*2,r*2);
    }
    function sprite(ctx, name, x, z, height, alpha = 1) {
      if (!ready(atlas)) return false;
      const [sx,sy,sw,sh] = frames[name], w = height * sw / sh;
      ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlas,sx,sy,sw,sh,Math.round(x-w/2),Math.round(z-height),Math.round(w),height);
      ctx.restore(); return true;
    }
    function background(ctx, width, cameraX, wave) {
      ctx.fillStyle = '#c7c2a4'; ctx.fillRect(0,0,width,420);
      if (ready(backdrop)) {
        // Uniform scale, distant parallax. The handoff image is scenery only.
        const w = Math.max(1050, width + 230), h = w * backdrop.naturalHeight / backdrop.naturalWidth;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(backdrop,-cameraX*.22,195-h*.62,w,h);
      }
      const mist=ctx.createLinearGradient(0,70,0,220);
      mist.addColorStop(0,'rgba(223,218,192,0)'); mist.addColorStop(1,'rgba(210,209,183,.55)');
      ctx.fillStyle=mist;ctx.fillRect(0,70,width,150);
      if(wave%3===2) {ctx.fillStyle='rgba(25,31,43,.18)';ctx.fillRect(0,0,width,210);}
    }
    let bridge;
    function stoneBridge(heightAt) {
      // One reusable surface, baked once. Smaller flush stones follow the
      // actual walkable curve; they are not stacked, bevelled cubes.
      const tile=document.createElement('canvas');
      tile.width=600;tile.height=336;
      const b=tile.getContext('2d');
      b.scale(2,2);b.translate(-430,-185);
      let stoneSeed=2801;
      const rand=()=>{stoneSeed=(stoneSeed*1664525+1013904223)>>>0;return stoneSeed/4294967296;};
      const edge=(z,reverse=false)=>{
        for(let i=0;i<=150;i++) {
          const x=reverse?730-i*2:430+i*2;
          b.lineTo(x,z-heightAt(x,280));
        }
      };
      b.fillStyle='rgba(30,37,26,.22)';b.fillRect(430,345,300,6);
      b.beginPath();b.moveTo(430,345);edge(345);b.lineTo(730,345);b.closePath();
      b.fillStyle='#525848';b.fill();
      b.save();b.clip();
      for(let y=301;y<345;y+=7) for(let x=430-(y%2)*9;x<730;x+=23) {
        b.fillStyle=rand()>.5?'#5f6351':'#626653';b.fillRect(x,y,22,6);
      }
      b.restore();
      b.beginPath();b.moveTo(430,235);edge(235);edge(345,true);b.closePath();
      b.fillStyle='#737864';b.fill();
      b.save();b.clip();
      for(let z=235,row=0;z<345;z+=7,row++) {
        for(let x=414+(row%2)*9;x<730;) {
          const end=Math.min(730,x+12+Math.floor(rand()*13));
          const from=Math.max(430,x);
          const h1=heightAt(from,280),h2=heightAt(end,280);
          b.beginPath();b.moveTo(from,z-h1);b.lineTo(end-.6,z-h2);
          b.lineTo(end-.6,z+6.3-h2);b.lineTo(from,z+6.3-h1);b.closePath();
          b.fillStyle=['#8b8b75','#93907b','#84866f','#8e8c76'][Math.floor(rand()*4)];b.fill();
          // Reuse the ruin atlas's weathered stone grain, clipped into each
          // slab. The bridge shares the shrine's material without another PNG.
          b.save();b.clip();b.globalAlpha=.32;
          b.drawImage(atlas,985,818,34,25,from,z-Math.max(h1,h2),end-from,7+Math.abs(h1-h2));
          b.restore();
          // Occasional worn edges, rather than a bright bevel on every slab.
          if(rand()>.65) {
            b.strokeStyle='rgba(187,180,151,.3)';b.lineWidth=.5;
            b.beginPath();b.moveTo(from+1,z+.7-h1);b.lineTo(end-2,z+.7-h2);b.stroke();
          }
          x=end;
        }
      }
      for(let i=0;i<1700;i++) {
        const x=430+rand()*300,z=235+rand()*110;
        const rim=z<244||z>333;
        b.fillStyle=rim&&rand()>.3?'rgba(65,82,45,.5)':rand()>.5?'rgba(48,55,41,.14)':'rgba(207,195,158,.14)';
        b.fillRect(x,z-heightAt(x,280),rim?1+rand()*4:.6+rand(),.5+rand());
      }
      b.restore();
      b.strokeStyle='rgba(172,167,139,.6)';b.lineWidth=.8;
      b.beginPath();b.moveTo(430,345);edge(345);b.stroke();
      return tile;
    }
    function ground(ctx, heightAt) {
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(floor,0,190);
      if(!bridge) bridge=stoneBridge(heightAt);
      ctx.drawImage(bridge,430,185,300,168);
      for(const [name,x,z,h] of [
        ['oak',55,224,235],['pine',350,207,205],['oak',510,203,185],
        ['pine',760,208,225],['wall',140,208,53],['wall',805,208,46]
      ]) sprite(ctx,name,x,z,h);
    }
    function site(ctx, spot, found, crafted, traced, near, time) {
      const x=spot.x,z=spot.z;
      if(spot.id==='hollow') sprite(ctx,'arch',x,z,145);
      if(spot.id==='shrine') {
        if(!sprite(ctx,'shrine',x,z,86)) {ctx.fillStyle='#a29e83';ctx.fillRect(x-14,z-53,28,53);}
      } else if(spot.id==='traces') {
        ctx.fillStyle=found?'#4e4b39':'#d4c4a0';
        for(let i=0;i<5;i++) {ctx.fillRect(x-16+i*7,z-12+(i%2)*6,5,3);ctx.fillRect(x-15+i*7,z-15+(i%2)*6,2,2);}
      } else if(!found && !crafted) {
        ctx.strokeStyle='#555036';ctx.lineWidth=3;
        for(let i=0;i<5;i++) {ctx.beginPath();ctx.moveTo(x-25+i*10,z);ctx.lineTo(x+21-i*9,z-58);ctx.stroke();}
      }
      if(!found) {
        ctx.fillStyle='#e0c99a';
        const bob=Math.round(Math.sin(time/650)*2);
        ctx.fillRect(x-2,z-25+bob,4,4);
      }
      // Context labels appear near the player; silhouettes invite discovery
      // without giant permanent labels covering the scenery or combatants.
      if(near) {
        const label=found?spot.label:spot.clue;
        ctx.font='bold 11px sans-serif';ctx.textAlign='center';
        const w=ctx.measureText(label).width+16;
        ctx.fillStyle='rgba(29,35,27,.88)';ctx.fillRect(x-w/2,z-104,w,22);
        ctx.fillStyle=found?'#b6ba9e':'#f5ebcc';ctx.fillText(label,x,z-89);
      }
    }
    function trail(ctx,found) {
      if(!found.has('traces')) return;
      for(let i=0;i<9;i++) {
        const x=810+i*11,z=350-i*12;
        ctx.fillStyle='#c7b68e';ctx.fillRect(x,z,4,3);ctx.fillRect(x+4,z+5,3,3);
      }
    }
    function foreground(ctx,cameraX,width,time,player) {
      // Border dressing stays outside the walkable field, never a fake wall.
      for(const [name,x,h] of [['rocks',90,52],['wall',385,35],['rocks',720,44],['oak',1040,190]]) {
        sprite(ctx,name,x,443,h,player&&Math.abs(player.x-x)<80?.35:.88);
      }
      ctx.save();ctx.translate(cameraX,0);
      const shade=ctx.createLinearGradient(0,0,0,420);
      shade.addColorStop(0,'rgba(25,32,27,.16)');shade.addColorStop(.55,'rgba(25,32,27,0)');shade.addColorStop(1,'rgba(21,29,22,.24)');
      ctx.fillStyle=shade;ctx.fillRect(0,0,width,420);
      for(let i=0;i<12;i++) {
        const x=((i*137+time*.004-cameraX*.5)%(width+30)+width+30)%(width+30);
        const y=110+(i*41)%270+Math.sin(time/1600+i)*5;
        ctx.fillStyle='rgba(237,226,179,.38)';ctx.fillRect(Math.round(x),Math.round(y),2,2);
      }
      ctx.restore();
    }
    return {background,ground,site,trail,foreground,ready:()=>ready(backdrop)&&ready(atlas)};
  }
  root.CrownlessPixelForest={create};
})(typeof window==='object'?window:globalThis);

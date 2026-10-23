/* Hand-authored pixel parts. One silhouette/animation rig, palette variants,
 * and independent equipment layers; no image downloads or per-frame atlases. */
(function(root) {
  'use strict';
  const parts = {
    torso: [
      '....oooo....','..ooaaaaoo..','.oabbccbbao.','oabbccccbbao',
      'oabccccccbao','oabcbccbcbao','.oabbccbbao.','.oabbbbbao..',
      '.oaabbbbao..','.oaaabbbao..','.odddddddo..','.odcdddcdo..',
      '.oaabbbao...','..oooooo....'
    ],
    head: [
      '...oooooo...','..oaaaaaao..','.oabbbbbbao.','.oabccccbao.',
      '.oabccccbbo.','.oabctocbo..','..obctocbo..','..obccccbo..',
      '...obbttbo..','....ooooo...'
    ],
    hair: [
      '....oooo....','..oohhhhoo..','.ohhiiihhho.','ohhiijjiiho.',
      'ohiijiiihhho','ohhiihiihho.','.ohhoohhho..','.oho..oho...',
      '..oo...o....'
    ],
    hood: [
      '....oooo....','...oaaaao...','..oabbbaao..','.oabbccbaao.',
      'oabcbcccbao.','oabcooocbao.','oabo...obao.', 'oao.....oao.',
      '.oo.....oo..'
    ],
    ears: ['oo..........oo','oboo......oobo','.obbo....obbo.','..ooo....ooo..'],
    arm: ['.ooo..','oaaao.','oabba.','.obbo.','.obbo.','.otto.','otccto','.otto.'],
    boot: ['.oooo.','oaaabo','oaabbo','.obbo.','.obbo.','.obbo.','oabbbo','occcbo','oooooo'],
    sword: ['..................oo','...............oocco','............oocccbo.','..o......oocccboo...',
      '.odo..oocccboo......','odddoocccboo........','.oddccboo...........','..oddoo.............',
      '.oddo...............','..oo................'],
    stone: ['..oooo..','.oabbbo.','oabccbbo','oabbcbbo','.oaabao.','..oooo..']
  };
  const schemes = {
    traveler: {o:'#252c32',a:'#374751',b:'#587887',c:'#88a8af',d:'#bd9c67',t:'#bb8565',h:'#70818b',i:'#bbc8c5',j:'#e1e0ce'},
    companion: {o:'#242e29',a:'#344638',b:'#60725b',c:'#96a17b',d:'#ac9064',t:'#bb8565',h:'#333e3d',i:'#63726b',j:'#99a38b'},
    enemy: {o:'#2b3027',a:'#424b34',b:'#6f8150',c:'#a4b478',d:'#9a784e',t:'#627344',h:'#3d4531',i:'#65734b',j:'#9a9f66'}
  };
  const cache = new Map();
  function tile(name, scheme, skin) {
    const key=name+':'+scheme+':'+skin;
    if(cache.has(key)) return cache.get(key);
    const rows=parts[name], colors={...schemes[scheme]};
    if(skin) { colors.a='#99674f'; colors.b='#d5a17b'; colors.c='#f1c59a'; }
    const image=document.createElement('canvas');
    image.width=Math.max(...rows.map(row=>row.length));image.height=rows.length;
    const g=image.getContext('2d');
    rows.forEach((row,y)=>[...row].forEach((symbol,x)=>{
      if(colors[symbol]) {g.fillStyle=colors[symbol];g.fillRect(x,y,1,1);}
    }));
    cache.set(key,image);return image;
  }
  function draw(ctx,f,{role='enemy',crafted=false,burst=false}={}) {
    const scheme=schemes[role]?role:'enemy';
    const moving=f.state==='WALK'||f.state==='RUN';
    const stride=moving?Math.round(Math.sin(f.animTime*1.4)*2):0;
    const bob=moving?Math.abs(stride):0;
    const attacking=f.state==='ATTACK'||f.state==='SPECIAL';
    const reach=attacking?(Math.sin(f.animTime*6)>0?9:4):0;
    const part=(name,x,y,skin=false)=>ctx.drawImage(tile(name,scheme,skin),Math.round(x),Math.round(y));
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.scale(2,2);
    // Back arm and legs sit behind the coat. Their local motion also works
    // during the caller's jump, knockdown, flip and facing transformations.
    part('arm',-9,-20-bob);
    part('boot',-6-stride,-9);
    part('boot',2+stride,-9-Math.abs(stride));
    part('torso',-6,-23-bob);
    if(scheme==='enemy') part('ears',-7,-27-bob);
    part('head',-6,-30-bob,scheme!=='enemy');
    part(scheme==='traveler'?'hair':'hood',-6,-33-bob);
    part('arm',3+reach,-21-bob,scheme!=='enemy');
    // Equipment is composed after the hand, so forging changes every pose.
    if(crafted||f.heldWeapon?.type==='katana') part('sword',6+reach,-25-bob);
    else if(f.heldWeapon) part('stone',7+reach,-19-bob);
    if(f.state==='HURT'||f.state==='DOWN'||f.state==='DEAD') {
      ctx.fillStyle='#f2d1a0';ctx.fillRect(0,-25-bob,3,1);
    }
    if(burst) {ctx.fillStyle='#bb5247';ctx.fillRect(0,-24-bob,4,1);}
    ctx.restore();
  }
  root.CrownlessPixelActors={draw,parts:Object.keys(parts)};
})(typeof window==='object'?window:globalThis);

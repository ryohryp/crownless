/* Hand-authored pixel parts. One silhouette/animation rig, palette variants,
 * and independent equipment layers; no image downloads or per-frame atlases. */
(function(root) {
  'use strict';
  const parts = {
    torso: [
      '...aabbaa...','..abbccbaa..','.abccccbbaa.',
      '.abccbcbbba.','.abbcbbbbaa.','.abbbbbbaaa.',
      '..abbbbbaa..','..dddddddd..','..dddggddd..',
      '..abbbbbaa..','.aabbbbaa...','.aaaabbaa...'
    ],
    head: [
      '...tttttt...','..tsssssst..','.tssuuussst.',
      '.tssuuuusst.','.tssuuuusst.','.tssuuuusst.',
      '..tssssssst.','..tssesest..','..tssussst..',
      '...tsssst...','....tttt....'
    ],
    hair: [
      '.....hh.....','...hhiiih...', '..hiiijjih..',
      '.hiiijjjiih.','.hiijjjiiih.','hiijjiiiihh.',
      'hiiiiiihihh.','.hhiiih.hhh.','..hhh...hh..'
    ],
    hood: [
      '....aaa.....','..aabbbaa...','.abbcccbbaa.',
      '.abcccccbba.','abcccccbbbaa','abccbbbbbbaa',
      'abbbaaabbbba','.aba....aba.','..aa.....aa.'
    ],
    cape: ['...aaaaaa.....','..aabbbbaa....','.aabbbbbbaa...',
      '.aabbbbbaaa...','aaabbbbaaaa...','aaabbbaaaaa...',
      'aaaabaaaaaa...','aaaabaaaaaaa..','aaaaabaaaaaa..',
      'aaaabaaaaaaa..','.aaaaa..aaa...','..aaa....a....'],
    ears: ['tt............tt','.sst........tss.','..sst......tss..','...tt......tt...'],
    neck: ['tttt','ssss','tsss'],
    sleeve: ['aaaaaa','abbbba','abccba','abbbba'],
    arm: ['.aaa.','abbba','abcca','.abba','.ddd.','.dgd.','..dd.'],
    boot: ['.ddd.','.dgd.','.ddd.','ddggd','ooooo'],
    sword: ['..................oo','...............oocco','............oocccbo.','..o......oocccboo...',
      '.odo..oocccboo......','odddoocccboo........','.oddccboo...........','..oddoo.............',
      '.oddo...............','..oo................'],
    stone: ['..oooo..','.oabbbo.','oabccbbo','oabbcbbo','.oaabao.','..oooo..']
  };
  const schemes = {
    traveler: {o:'#29313a',a:'#374853',b:'#537c91',c:'#8eabb8',d:'#654e3d',g:'#a48b64',s:'#dfb48b',t:'#b78466',u:'#f1cf9f',e:'#343c42',h:'#6f7c88',i:'#adbcc0',j:'#e0ded0'},
    companion: {o:'#29332a',a:'#394c39',b:'#698260',c:'#9db587',d:'#624c38',g:'#ac9265',s:'#ddb18a',t:'#ae7c60',u:'#efd0a1',e:'#343c36',h:'#41493b',i:'#6d7b54',j:'#a7ac76'},
    enemy: {o:'#2e3428',a:'#494b38',b:'#7b7851',c:'#aaa072',d:'#5c4935',g:'#a48b64',s:'#8caa69',t:'#57764c',u:'#b1c582',e:'#343c30',h:'#454d32',i:'#6e7e4b',j:'#a5ab6a'}
  };
  const cache = new Map();
  function tile(name, scheme) {
    const key=name+':'+scheme;
    if(cache.has(key)) return cache.get(key);
    const rows=parts[name], colors={...schemes[scheme]};
    if(name==='sword') Object.assign(colors,{o:'#35414a',b:'#819da5',c:'#d0d9cb',d:'#ad8c51'});
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
    const stride=moving?Math.round(Math.sin(f.animTime*1.4)):0;
    const bob=moving?Math.abs(stride):0;
    const attacking=f.state==='ATTACK'||f.state==='SPECIAL';
    const reach=attacking?(Math.sin(f.animTime*6)>0?5:2):0;
    const part=(name,x,y)=>ctx.drawImage(tile(name,scheme),Math.round(x),Math.round(y));
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.scale(2,2);
    // Back arm and legs sit behind the coat. Their local motion also works
    // during the caller's jump, knockdown, flip and facing transformations.
    part('cape',-8,-17-bob);
    part('arm',-8,-16-bob);
    part('boot',-5-stride,-5);
    part('boot',1+stride,-5-Math.abs(stride));
    part('neck',-2,-20-bob);
    part('torso',-6,-17-bob);
    if(scheme==='enemy') part('ears',-8,-25-bob);
    part('head',-6,-29-bob);
    part(scheme==='traveler'?'hair':'hood',-6,-31-bob);
    if(reach) part('sleeve',4,-15-bob);
    part('arm',4+reach,-16-bob);
    // Equipment is composed after the hand, so forging changes every pose.
    if(crafted||f.heldWeapon?.type==='katana') part('sword',6+reach,-21-bob);
    else if(f.heldWeapon) part('stone',7+reach,-15-bob);
    if(f.state==='HURT'||f.state==='DOWN'||f.state==='DEAD') {
      ctx.fillStyle=schemes[scheme].e;ctx.fillRect(0,-22-bob,3,1);
    }
    if(burst) {ctx.fillStyle='#bb5247';ctx.fillRect(0,-21-bob,4,1);}
    ctx.restore();
  }
  root.CrownlessPixelActors={draw,parts:Object.keys(parts)};
})(typeof window==='object'?window:globalThis);

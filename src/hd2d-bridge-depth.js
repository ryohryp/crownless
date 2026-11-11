/* Optional depth study. Projected 3D slab/stone geometry shares one camera
 * with sprites and interactive clues. No collision or gameplay changes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CrownlessBridgeDepth=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const BRIDGE={left:430,right:730,back:235,front:345};
  const nearScenery=Object.freeze([
    {type:'frontRail',z:345},
    {type:'rock',x:258,z:379,size:21},
    {type:'rock',x:830,z:396,size:25},
    {type:'grass',x:183,z:369,size:17},
    {type:'grass',x:774,z:383,size:21}
  ]);
  function depthScale(z){return Math.max(.7,Math.min(1.2,.76+(z-210)*.0021));}
  function project(x,z,h,cameraX,width){
    const scale=depthScale(z),middle=width/2;
    return {x:middle+(x-cameraX-middle)*scale,y:185+(z-210)*1.025-h*scale,scale};
  }
  function hitTestSite(tap,rect,width,cameraX,heightAt,sites){
    if(!tap||!rect||!(rect.width>0)||!(rect.height>0))return null;
    const x=(tap.x-rect.left)*width/rect.width,y=(tap.y-rect.top)*420/rect.height;
    if(x<0||x>width||y<0||y>420)return null;
    return sites.find(s=>{const p=project(s.x,s.z,heightAt(s.x,s.z),cameraX,width);
      return Math.abs(x-p.x)<=53*p.scale&&y>=p.y-110*p.scale&&y<=p.y+20*p.scale;})||null;
  }
  function create(){
    const distant=typeof Image==='function'?new Image():null;
    if(distant)distant.src='assets/action-forest/bridge-hd2d-candidate-v1.webp';
    function ready(){return !!(distant&&distant.complete&&distant.naturalWidth);}
    // World scene is already translated by -cameraX. Undo only for projection.
    function pt(x,z,h,cam,w){const p=project(x,z,h,cam,w);return{x:p.x+cam,y:p.y};}
    function poly(ctx,points,fill,line){
      ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
      ctx.closePath();ctx.fillStyle=fill;ctx.fill();
      if(line){ctx.strokeStyle=line;ctx.lineWidth=.8;ctx.stroke();}
    }
    function face(ctx,cam,w,vertices,fill,line){poly(ctx,vertices.map(v=>pt(v[0],v[1],v[2],cam,w)),fill,line);}
    function texturedFace(ctx,cam,w,vertices,uv,fill){
      const ps=vertices.map(v=>pt(v[0],v[1],v[2],cam,w));
      if(!ready()){poly(ctx,ps,fill);return;}
      const minX=Math.min(...ps.map(p=>p.x)),minY=Math.min(...ps.map(p=>p.y));
      const maxX=Math.max(...ps.map(p=>p.x)),maxY=Math.max(...ps.map(p=>p.y));
      ctx.save();ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);
      for(let i=1;i<ps.length;i++)ctx.lineTo(ps[i].x,ps[i].y);
      ctx.closePath();ctx.clip();
      ctx.drawImage(distant,uv[0],uv[1],uv[2],uv[3],minX,minY,
        Math.max(1,maxX-minX),Math.max(1,maxY-minY));
      ctx.fillStyle='rgba(71,69,57,.12)';ctx.fillRect(minX,minY,maxX-minX,maxY-minY);
      ctx.restore();
    }
    function background(ctx,w,cam,wave){
      const sky=ctx.createLinearGradient(0,0,0,420);
      sky.addColorStop(0,'#d9bbaa');sky.addColorStop(.5,'#9b9990');sky.addColorStop(1,'#343f40');
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,420);
      if(ready()){
        // Crop only the skyline/ruins; the painted bridge cannot remain fixed
        // beneath moving 3D geometry. The skyline moves much more slowly.
        ctx.globalAlpha=.92;
        ctx.drawImage(distant,0,0,distant.naturalWidth,275,-90-cam*.12,-8,1390,243);
        ctx.globalAlpha=1;
      }
      const mist=ctx.createLinearGradient(0,195,0,420);
      mist.addColorStop(0,'rgba(91,92,84,.1)');mist.addColorStop(.5,'rgba(47,55,55,.55)');
      mist.addColorStop(1,'rgba(27,39,43,.96)');ctx.fillStyle=mist;ctx.fillRect(0,195,w,225);
      ctx.fillStyle='rgba(37,45,45,.31)';ctx.beginPath();ctx.moveTo(-70-cam*.28,280);
      for(let x=-40;x<w+120;x+=35)ctx.lineTo(x-cam*.28,264+Math.sin(x*.023)*19);
      ctx.lineTo(w+80,420);ctx.lineTo(-80,420);ctx.fill();
      if(wave%3===2){ctx.fillStyle='rgba(27,30,41,.15)';ctx.fillRect(0,0,w,420);}
    }
    function railing(ctx,cam,w,z,heightAt){
      for(let x=430;x<730;x+=30){
        const e=Math.min(730,x+30),a=heightAt(x,290),b=heightAt(e,290);
        face(ctx,cam,w,[[x,z,a+17],[e,z,b+17],[e,z+7,b+17],[x,z+7,a+17]],'#aca187','#494d47');
        face(ctx,cam,w,[[x,z+7,a+17],[e,z+7,b+17],[e,z+7,b+10],[x,z+7,a+10]],'#67695e');
        if((x-430)%60===0){
          face(ctx,cam,w,[[x,z,a+26],[x+10,z,a+26],[x+10,z+8,a-1],[x,z+8,a-1]],
            '#89897b','#56584f');
        }
      }
    }
    function ground(ctx,cam,w,heightAt){
      // Physically projected stone slabs converge in the distance. A proper
      // floor/contact geometry replaces the static painted bridge surface.
      for(const [left,right] of [[0,430],[730,1050]]){
        // A single continuous masonry surface avoids the telltale staircase
        // texture-repeat pattern of tiled strips. Edges still converge with
        // perspective because each floor has its own projected quadrilateral.
        texturedFace(ctx,cam,w,[[left,210,0],[right,210,0],[right,410,0],[left,410,0]],
          [270,352,800,91], '#827b68');
      }
      // Shore strips retain the old collision lanes before/after bridge.
      for(const [start,end] of [[210,235],[345,410]]){
        texturedFace(ctx,cam,w,[[430,start,0],[730,start,0],[730,end,0],[430,end,0]],
          [360,start===210?341:398,730,72],'#68685d');
      }
      // Elevated bridge face with two deep openings beneath the deck.
      for(let x=430;x<730;x+=15){
        face(ctx,cam,w,[[x,345,heightAt(x,290)],[x+15,345,heightAt(x+15,290)],
          [x+15,345,heightAt(x+15,290)-68],[x,345,heightAt(x,290)-68]],
          Math.floor(x/15)%3===0?'#494e49':'#606156','#343b38');
      }
      for(const [start,end] of [[473,568],[603,692]]){
        const a=pt(start,345,-59,cam,w),b=pt(end,345,-59,cam,w);
        const arch=pt((start+end)/2,345,4,cam,w);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(arch.x,arch.y-22,b.x,b.y);
        ctx.lineTo(b.x,b.y+90);ctx.lineTo(a.x,a.y+90);ctx.closePath();
        ctx.fillStyle='#263137';ctx.fill();ctx.strokeStyle='rgba(191,169,135,.42)';
        ctx.lineWidth=2.5;ctx.stroke();
      }
      // Actual walkable height sampled from the unchanged combat heightAt.
      for(let z=235;z<345;z+=11){
        const row=Math.floor((z-235)/11);
        for(let x=430;x<730;x+=25){const a=heightAt(x,290),b=heightAt(x+25,290);
          texturedFace(ctx,cam,w,[[x,z,a],[x+25,z,b],[x+25,z+11,b],[x,z+11,a]],
            [240+(x-430)/300*825,350+row*2.4,69,10], '#a29b83');
        }
      }
      // The rear rail sits behind people; the front rail is drawn separately
      // in the same z-sorted queue as actors, so it genuinely occludes feet.
      railing(ctx,cam,w,235,heightAt);
    }
    function scenery(ctx,cam,w,heightAt,o){
      if(o.type==='frontRail'){railing(ctx,cam,w,345,heightAt);return;}
      const p=pt(o.x,o.z,0,cam,w),s=depthScale(o.z);
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
      if(o.type==='rock'){
        ctx.fillStyle='rgba(20,27,24,.3)';ctx.beginPath();ctx.ellipse(3,2,o.size+10,7,0,0,Math.PI*2);ctx.fill();
        poly(ctx,[{x:-o.size,y:-3},{x:-o.size*.68,y:-o.size*.69},
          {x:o.size*.48,y:-o.size*.91},{x:o.size,y:-4},{x:o.size*.7,y:0}],
        '#767769','#383d3b');
        ctx.strokeStyle='#b4a58b';ctx.lineWidth=3;ctx.beginPath();
        ctx.moveTo(-o.size*.6,-o.size*.47);ctx.lineTo(o.size*.21,-o.size*.73);ctx.stroke();
      }else{
        ctx.strokeStyle='#556b50';ctx.lineWidth=3;
        for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(i*2,0);
          ctx.quadraticCurveTo(i*4,-o.size*.46,i*5,-o.size*.8);ctx.stroke();}
      }
      ctx.restore();
    }
    function entity(ctx,x,z,height,cam,w,draw){
      const p=pt(x,z,height,cam,w),s=depthScale(z);
      ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
      ctx.translate(-x,-(z-height));draw();ctx.restore();
    }
    function shadow(ctx,x,z,height,cam,w,jump){
      const p=pt(x,z,height,cam,w),s=depthScale(z);
      const shade=Math.max(.09,.42-Math.max(0,jump)*.0025);
      const radial=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,24*s);
      radial.addColorStop(0,`rgba(18,22,20,${shade})`);
      radial.addColorStop(1,'rgba(18,22,20,0)');
      ctx.fillStyle=radial;ctx.beginPath();ctx.ellipse(p.x,p.y,24*s,9*s,0,0,Math.PI*2);ctx.fill();
    }
    function foreground(ctx,cam,w,t){
      ctx.save();ctx.translate(cam,0);
      const drift=Math.sin(t/1900)*14;
      for(const x of [w*.17,w*.9]){
        const haze=ctx.createRadialGradient(x+drift,353,2,x+drift,353,110);
        haze.addColorStop(0,'rgba(217,201,181,.11)');haze.addColorStop(1,'rgba(217,201,181,0)');
        ctx.fillStyle=haze;ctx.fillRect(x+drift-110,244,220,176);
      }
      ctx.restore();
    }
    return {ready,background,ground,scenery,entity,shadow,foreground,project,hitTestSite,nearScenery};
  }
  return {create,project,depthScale,hitTestSite,nearScenery,BRIDGE};
});

/* Rebuilt painterly castle approach: same expedition mechanics, no distorted
 * image-on-mesh ground and no unrelated flat vector castle. The existing
 * environment painting is separated into far skyline, walkable ground and
 * depth-masked near parapet. Visual-only camera; physics and saves untouched.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CrownlessBridgeReprise=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const SOURCE='assets/action-forest/bridge-hd2d-candidate-v1.webp';
  const HEIGHT=420, WORLD_WIDTH=1050;
  const FAR_PARALLAX=.075, ACTOR_SCALE=.78, FOOT_LIFT=40;
  // The front boundary of the *painted* bridge. Characters cannot appear in
  // front of the masonry without being masked by its parapet.
  const parapetY=x=>271-44*Math.max(0,Math.min(1,x/WORLD_WIDTH));
  function depthScale(z){return Math.max(.7,Math.min(1.2,.76+(z-210)*.0021));}
  function project(x,z,physicalHeight,cam,width){
    const scale=depthScale(z),middle=width/2;
    const visualRise=Math.max(0,physicalHeight)*.13;
    return {x:middle+(x-cam-middle)*scale,
      y:185+(z-210)*1.025-visualRise*scale-FOOT_LIFT,scale};
  }
  function composition(cameraX,viewportWidth){
    const width=Math.max(1,viewportWidth);
    return {
      // Keep the painted castle's aspect ratio intact. The distant ruin is
      // brought into view by *cropping* the wide panorama, never squashing it.
      sky:{x:width*.68-(1210/1672)*WORLD_WIDTH-cameraX*FAR_PARALLAX,
        y:-7,width:WORLD_WIDTH,height:350*WORLD_WIDTH/1672},
      road:{x:0,y:180,width:WORLD_WIDTH,height:248},
      cameraX
    };
  }
  function hitTestSite(tap,rect,width,cameraX,heightAt,sites){
    if(!tap||!rect||!rect.width||!rect.height)return null;
    const x=(tap.x-rect.left)*width/rect.width;
    const y=(tap.y-rect.top)*HEIGHT/rect.height;
    if(x<0||y<0||x>width||y>HEIGHT)return null;
    return sites.find(site=>{
      const point=project(site.x,site.z,heightAt(site.x,site.z),cameraX,width);
      return Math.abs(x-point.x)<48*point.scale &&
        y>point.y-88*point.scale && y<point.y+24*point.scale;
    })||null;
  }
  function create(){
    const art=typeof Image==='function'?new Image():null;
    if(art)art.src=SOURCE;
    const ready=()=>!!(art&&art.complete&&art.naturalWidth>0&&art.naturalHeight>0);
    function skyline(ctx,width,cam,phase){
      const p=composition(cam,width).sky;
      const sun=ctx.createLinearGradient(0,0,0,240);
      sun.addColorStop(0,'#e5b6a0');sun.addColorStop(.55,'#d2aa8c');
      sun.addColorStop(1,'#75818a');
      ctx.fillStyle=sun;ctx.fillRect(0,0,width,HEIGHT);
      if(!ready())return;
      // Only the upper original landscape is sampled. The beautiful distant
      // castle remains a painting, not an unlit SVG cutout.
      ctx.save();ctx.beginPath();ctx.rect(0,0,width,216);ctx.clip();
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(art,0,0,1672,350,p.x,p.y,p.width,p.height);
      ctx.restore();
      if(phase%3===2){
        ctx.fillStyle='rgba(40,44,59,.15)';
        ctx.fillRect(0,0,width,216);
      }
    }
    function road(ctx){
      // World-space paint: a slab face never receives a cropped photo as an
      // affine texture. Natural source aspect stays constant at 1050/1672.
      if(!ready())return;
      const p=composition(0,1).road;
      ctx.save();ctx.imageSmoothingEnabled=true;
      ctx.drawImage(art,0,325,1672,395,p.x,p.y,p.width,p.height);
      ctx.restore();
    }
    function background(ctx,width,cam,wave){
      skyline(ctx,width,cam,wave||1);
      // Camera does not alter the far skyline at the same rate as the
      // walkable bridge. The following matches the existing world X.
      ctx.save();ctx.translate(-cam,0);
      road(ctx);
      ctx.restore();
      const haze=ctx.createLinearGradient(0,174,0,239);
      haze.addColorStop(0,'rgba(239,212,178,.07)');
      haze.addColorStop(.5,'rgba(219,207,185,.13)');
      haze.addColorStop(1,'rgba(219,207,185,0)');
      ctx.fillStyle=haze;ctx.fillRect(0,174,width,65);
      return ready();
    }
    function ground(){/* Ground is already painted in background. */ }
    function entity(ctx,x,z,height,cam,width,draw){
      const p=project(x,z,height,cam,width);
      const s=p.scale*ACTOR_SCALE;
      // Called while the world renderer is translated by -cameraX.
      ctx.save();ctx.translate(p.x+cam,p.y);ctx.scale(s,s);
      ctx.translate(-x,-(z-height));draw();ctx.restore();
    }
    function shadow(ctx,x,z,height,cam,width,jump){
      const p=project(x,z,height,cam,width);
      const k=p.scale*ACTOR_SCALE;
      const fade=Math.max(.10,.42-Math.max(0,jump)*.003);
      ctx.save();
      const radial=ctx.createRadialGradient(p.x+cam,p.y,2,p.x+cam,p.y,22*k);
      radial.addColorStop(0,'rgba(27,24,19,'+fade+')');
      radial.addColorStop(1,'rgba(27,24,19,0)');
      ctx.fillStyle=radial;ctx.beginPath();
      ctx.ellipse(p.x+cam,p.y,22*k,7*k,0,0,Math.PI*2);
      ctx.fill();ctx.restore();
    }
    function foreground(ctx,cam,width,time){
      if(!ready())return;
      // Accurate world-space front-wall mask, sampled from the SAME painting.
      // Overlays feet only where the painted parapet is physically in front.
      ctx.save();ctx.beginPath();ctx.moveTo(-8,parapetY(0));
      for(let x=0;x<=WORLD_WIDTH;x+=35)ctx.lineTo(x,parapetY(x));
      ctx.lineTo(WORLD_WIDTH,HEIGHT);ctx.lineTo(-8,HEIGHT);ctx.closePath();
      ctx.clip();road(ctx);ctx.restore();
      // The only screen-space effect is faint valley fog, never fake terrain.
      ctx.save();ctx.translate(cam,0);
      const drift=Math.sin(time/2400)*4;
      const mist=ctx.createRadialGradient(width*.78+drift,366,8,width*.78+drift,366,115);
      mist.addColorStop(0,'rgba(220,217,204,.13)');
      mist.addColorStop(1,'rgba(220,217,204,0)');
      ctx.fillStyle=mist;ctx.fillRect(width*.78-120,250,240,160);
      ctx.restore();
    }
    function scenery(){}
    return {ready,background,ground,entity,shadow,foreground,scenery,project,hitTestSite,
      nearScenery:[],composition};
  }
  return {SOURCE,HEIGHT,WORLD_WIDTH,FAR_PARALLAX,ACTOR_SCALE,FOOT_LIFT,
    parapetY,depthScale,project,composition,hitTestSite,create};
});
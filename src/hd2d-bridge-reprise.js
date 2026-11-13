/* Experimental portrait-first bridge: a single continuous world image.
 * The previous implementation sliced the same image into sky, road and
 * parapet with incompatible transforms. Those joins created rectangles and
 * the front-wall overlay erased the player's legs. Keep original play logic.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CrownlessBridgeReprise=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const SOURCE='assets/action-forest/bridge-hd2d-candidate-v1.webp';
  const HEIGHT=420,WORLD_WIDTH=1050,ART_WIDTH=1672,ART_HEIGHT=720;
  const CASTLE_X=1090;
  const FAR_PARALLAX=.25,ACTOR_SCALE=.82,FOOT_LIFT=45;
  function depthScale(z){return Math.max(.7,Math.min(1.2,.76+(z-210)*.0021));}
  function project(x,z,physicalHeight,cam,width){
    const scale=depthScale(z),middle=width/2;
    // Preserve live gameplay coordinates; only adjust the optical contact.
    const visualRise=Math.max(0,physicalHeight)*.13;
    return {x:middle+(x-cam-middle)*scale,
      y:185+(z-210)*1.025-visualRise*scale-FOOT_LIFT,scale};
  }
  function composition(cameraX,viewportWidth){
    const width=Math.max(1,viewportWidth),cam=Number.isFinite(cameraX)?Math.max(0,cameraX):0;
    const scale=HEIGHT/ART_HEIGHT;
    const paintedWidth=ART_WIDTH*scale;
    // Full image always covers even a wide virtual canvas. Do not crop and
    // rescale separate fragments; the castle and bridge need one perspective.
    // Track the exploratory camera gently without losing the castle at edges.
    const start=width*.69-CASTLE_X*scale;
    const desired=start-Math.max(0,cam-120)*FAR_PARALLAX;
    const x=Math.max(width-paintedWidth,Math.min(0,desired));
    return {
      panorama:{x,y:0,width:paintedWidth,height:HEIGHT},
      cameraX:cam
    };
  }
  function hitTestSite(tap,rect,width,cameraX,heightAt,sites){
    if(!tap||!rect||!(rect.width>0)||!(rect.height>0))return null;
    const x=(tap.x-rect.left)*width/rect.width;
    const y=(tap.y-rect.top)*HEIGHT/rect.height;
    if(x<0||x>width||y<0||y>HEIGHT)return null;
    return sites.find(site=>{
      const point=project(site.x,site.z,heightAt(site.x,site.z),cameraX,width);
      return Math.abs(x-point.x)<48*point.scale &&
        y>point.y-88*point.scale&&y<point.y+24*point.scale;
    })||null;
  }
  function create(){
    const art=typeof Image==='function'?new Image():null;
    if(art)art.src=SOURCE;
    const ready=()=>!!(art&&art.complete&&art.naturalWidth>0&&art.naturalHeight>0);
    function background(ctx,width,cam,wave){
      // Always fill the surface if the art has not yet loaded. No gaps.
      const sky=ctx.createLinearGradient(0,0,0,HEIGHT);
      sky.addColorStop(0,'#c6a293');sky.addColorStop(.55,'#897d78');
      sky.addColorStop(1,'#303d40');
      ctx.fillStyle=sky;ctx.fillRect(0,0,width,HEIGHT);
      if(!ready())return false;
      const scene=composition(cam,width).panorama;
      ctx.save();ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      // ONE image in ONE projection. No separate image fragments, wall mask,
      // hard horizon transition, right-hand column or texture stretching.
      ctx.drawImage(art,0,0,art.naturalWidth,art.naturalHeight,
        scene.x,scene.y,scene.width,scene.height);
      if((wave||1)%3===2){
        ctx.fillStyle='rgba(20,26,40,.13)';
        ctx.fillRect(0,0,width,HEIGHT);
      }
      ctx.restore();
      return true;
    }
    function ground(){
      // The bridge is already in the single continuous painted panorama.
      // No tiles or giant polygon bridge may be drawn on top.
    }
    function entity(ctx,x,z,height,cam,width,draw){
      const p=project(x,z,height,cam,width);
      const s=p.scale*ACTOR_SCALE;
      ctx.save();ctx.translate(p.x+cam,p.y);ctx.scale(s,s);
      ctx.translate(-x,-(z-height));draw();ctx.restore();
    }
    function shadow(ctx,x,z,height,cam,width,jump){
      const p=project(x,z,height,cam,width),k=p.scale*ACTOR_SCALE;
      const fade=Math.max(.1,.42-Math.max(0,jump)*.003);
      const xx=p.x+cam,yy=p.y;
      const radial=ctx.createRadialGradient(xx,yy,1,xx,yy,20*k);
      radial.addColorStop(0,'rgba(21,21,18,'+fade+')');
      radial.addColorStop(1,'rgba(21,21,18,0)');
      ctx.save();ctx.fillStyle=radial;ctx.beginPath();
      ctx.ellipse(xx,yy,20*k,6*k,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    function foreground(ctx,cam,width,time){
      // Crucial: never redraw the stone bridge AFTER actor rendering.
      // The former full-height mask painted over the player's body, making
      // them appear embedded in the wall. Only translucent near-camera fog.
      ctx.save();ctx.translate(cam,0);
      const drift=Math.sin(time/2400)*3;
      const fog=ctx.createRadialGradient(width*.82+drift,405,12,width*.82+drift,405,110);
      fog.addColorStop(0,'rgba(217,217,211,.07)');
      fog.addColorStop(1,'rgba(217,217,211,0)');
      ctx.fillStyle=fog;ctx.fillRect(width*.82-110,295,220,125);
      ctx.restore();
    }
    function scenery(){}
    return {ready,background,ground,entity,shadow,foreground,scenery,project,
      hitTestSite,nearScenery:[],composition};
  }
  return {SOURCE,HEIGHT,WORLD_WIDTH,ART_WIDTH,ART_HEIGHT,CASTLE_X,FAR_PARALLAX,
    ACTOR_SCALE,FOOT_LIFT,depthScale,project,composition,hitTestSite,create};
});
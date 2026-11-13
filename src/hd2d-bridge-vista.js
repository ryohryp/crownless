/* Opt-in castle approach vista. Art layers move at independent speeds in
 * the existing bridge camera, but never become collision or discovery state.
 * The bridge deck, feet, tap positions and parapet remain in BridgeDepth. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CrownlessBridgeVista=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const SOURCE=Object.freeze({
    castle:'assets/action-forest/vista-castle.svg',
    canyon:'assets/action-forest/vista-canyon.svg',
    canopy:'assets/action-forest/vista-canopy.svg'
  });
  const PARALLAX=Object.freeze({castle:.14,canyon:.32,canopy:.70});
  function placement(cameraX,viewportWidth){
    const cam=Math.max(0,Number.isFinite(cameraX)?cameraX:0);
    const width=Math.max(300,Number.isFinite(viewportWidth)?viewportWidth:390);
    return {
      castle:{x:width*.75-172-cam*PARALLAX.castle,y:8,width:354,height:218},
      canyon:{x:width*.50-440-cam*PARALLAX.canyon,y:122,width:780,height:304},
      canopy:{x:-152-cam*PARALLAX.canopy,y:-38,width:332,height:378}
    };
  }
  function create(){
    const image=(src)=>{
      if(typeof Image!=='function')return null;
      const output=new Image();
      output.src=src;
      return output;
    };
    const images=Object.fromEntries(Object.entries(SOURCE).map(([key,src])=>[key,image(src)]));
    const ready=(key)=>{const img=images[key];return !!(img&&img.complete&&img.naturalWidth>0&&img.naturalHeight>0);};
    function drawLayer(ctx,key,box){
      if(!ready(key))return false;
      ctx.save();
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(images[key],box.x,box.y,box.width,box.height);
      ctx.restore();
      return true;
    }
    function mountains(ctx,width,cam){
      // Far ridges shift less than castle or canyon. No random per-frame art.
      const ridges=[
        {factor:.055,base:185,peaks:[145,128,167,83,119,173,155,130,183],color:'#a4aab0'},
        {factor:.095,base:223,peaks:[196,173,208,131,168,189,153,193,221],color:'#6f8490'}
      ];
      for(const ridge of ridges){
        ctx.beginPath();
        const offset=-cam*ridge.factor;
        ctx.moveTo(-220+offset,ridge.base);
        ridge.peaks.forEach((peak,i)=>ctx.lineTo(-220+i*(width+440)/(ridge.peaks.length-1)+offset,peak));
        ctx.lineTo(width+240,ridge.base);
        ctx.closePath();
        ctx.fillStyle=ridge.color;
        ctx.fill();
      }
    }
    function background(ctx,viewportWidth,cameraX,wave,t){
      const width=Math.max(1,viewportWidth);
      const where=placement(cameraX,width);
      const dusk=(Math.max(0,wave-1)%3)===0;
      const sky=ctx.createLinearGradient(0,0,0,300);
      sky.addColorStop(0,dusk?'#c4a3a0':'#545b7b');
      sky.addColorStop(.42,dusk?'#f0b69a':'#8a7c90');
      sky.addColorStop(.8,dusk?'#e5c5a5':'#b3a9a7');
      sky.addColorStop(1,'#86989c');
      ctx.fillStyle=sky;
      ctx.fillRect(0,0,width,420);
      const sunX=width*.79-cameraX*.055;
      const glow=ctx.createRadialGradient(sunX,87,6,sunX,87,220);
      glow.addColorStop(0,dusk?'rgba(255,235,183,.83)':'rgba(241,217,206,.30)');
      glow.addColorStop(.28,dusk?'rgba(251,204,151,.49)':'rgba(203,188,208,.23)');
      glow.addColorStop(1,'rgba(242,200,161,0)');
      ctx.fillStyle=glow;
      ctx.fillRect(sunX-220,-120,440,440);
      mountains(ctx,width,cameraX);
      drawLayer(ctx,'castle',where.castle);
      drawLayer(ctx,'canyon',where.canyon);
      // A thin, transparent weather band blurs distance without covering
      // physically projected feet or being used as an interaction layer.
      const veil=ctx.createLinearGradient(0,145,0,315);
      veil.addColorStop(0,'rgba(241,213,177,0)');
      veil.addColorStop(.46,'rgba(222,219,202,.10)');
      veil.addColorStop(1,'rgba(190,209,205,.24)');
      ctx.fillStyle=veil;
      ctx.fillRect(0,145,width,170);
      // Subtle animated water glimmer is limited to the distant waterfall
      // region, not the solid bridge surface; reduced-motion can freeze it.
      if(Number.isFinite(t)){
        const shimmerX=where.canyon.x+780*.574;
        ctx.strokeStyle='rgba(241,248,239,.22)';
        ctx.lineWidth=2;
        const drift=Math.sin(t/850)*3;
        for(let n=0;n<5;n++){
          const x=shimmerX+n*5+drift;
          const y=290+n*13;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2,y+19);ctx.stroke();
        }
      }
      if(!dusk){
        ctx.fillStyle='rgba(26,30,47,.19)';
        ctx.fillRect(0,0,width,420);
      }
      return {layersReady:Object.keys(SOURCE).filter(ready),where};
    }
    function foreground(ctx,viewportWidth,cameraX,t){
      // Called while the main scene has translated by -cameraX; cancel it
      // before drawing the screen-space foreground. This keeps its parallax
      // independent of the projected bridge, whose near parapet is z-sorted.
      const where=placement(cameraX,viewportWidth);
      ctx.save();ctx.translate(cameraX,0);
      drawLayer(ctx,'canopy',where.canopy);
      const fog=ctx.createRadialGradient(viewportWidth*.83,390,8,viewportWidth*.83,390,160);
      fog.addColorStop(0,'rgba(224,223,204,.15)');
      fog.addColorStop(1,'rgba(224,223,204,0)');
      ctx.fillStyle=fog;
      ctx.fillRect(viewportWidth*.83-160,230,320,190);
      ctx.restore();
    }
    return {SOURCE,PARALLAX,ready,background,foreground,placement};
  }
  return {SOURCE,PARALLAX,placement,create};
});
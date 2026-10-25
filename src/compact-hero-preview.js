/* Human-selected still design + opt-in unapproved walk. Source PNGs stay
 * unchanged; cached 48px presentation grids keep real sprite-scale review. */
(function(root){
  'use strict';
  const source=Object.freeze({src:'assets/action-forest/hero-compact-candidate-v1.png',bounds:[456,239,374,869]});
  const walkBounds=[[81,152,362,657],[543,152,283,657],[939,152,348,657],[1402,152,288,647]];
  function create({animated=false}={}){
    const image=new Image();
    const walk=animated?new Image():null;
    if(walk)walk.src='assets/action-forest/hero-compact-walk-candidate-v1.png';
    const raster=document.createElement('canvas');
    raster.height=48;raster.width=Math.round(source.bounds[2]/source.bounds[3]*raster.height);
    let baked=false,lastFrame=null,walkFrames=null;
    image.src=source.src;
    const ready=()=>image.complete&&image.naturalWidth>0;
    const walkReady=()=>!!walk&&walk.complete&&walk.naturalWidth===1774&&walk.naturalHeight===887;
    function draw(ctx,f={state:'IDLE',animTime:0}){
      if(!ready())return false;
      if(!baked){
        const g=raster.getContext('2d');g.imageSmoothingEnabled=false;
        g.drawImage(image,...source.bounds,0,0,raster.width,raster.height);baked=true;
      }
      const height=44,width=raster.width*height/raster.height;
      ctx.save();ctx.imageSmoothingEnabled=false;
      if((f.state==='WALK'||f.state==='RUN')&&walkReady()){
        if(!walkFrames)walkFrames=walkBounds.map(bounds=>{
          const cell=document.createElement('canvas');cell.width=32;cell.height=56;
          const g=cell.getContext('2d'),w=bounds[2]/bounds[3]*48;g.imageSmoothingEnabled=false;
          g.drawImage(walk,...bounds,Math.round(16-w/2),4,Math.round(w),48);return cell;
        });
        lastFrame=Math.floor(Math.max(0,f.animTime)*(f.state==='RUN'?1.2:.8))%4;
        const scale=44/48;
        ctx.drawImage(walkFrames[lastFrame],-16*scale,-52*scale,32*scale,56*scale);
      }else{lastFrame=null;ctx.drawImage(raster,-width/2,-height,width,height);}
      ctx.restore();return true;
    }
    return {active:true,ready,draw,status:()=>({active:true,compact:true,stillReady:ready(),
      walkReady:walkReady(),lastFrame,reviewOnly:true,source:source.src,presentationHeight:48})};
  }
  root.CrownlessCompactHero={create};
})(typeof window==='object'?window:globalThis);

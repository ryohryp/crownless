/* Red-scarf protagonist: transparent four-frame pixel atlas.
 * Temporal frames only advance with simulation time; no idle cycling. */
(function(root){
  'use strict';
  const FRAME_W=96, FRAME_H=132, FOOT_X=48, FOOT_Y=124, COUNT=4;
  const SRC='assets/action-forest/hero-red-scarf-atlas.png';
  function create(){
    const mode=new URLSearchParams(location.search).get('actor');
    const active=mode!=='classic';
    const image=active?new Image():null;
    const walk=active&&mode!=='still'?new Image():null;
    let lastFrame=null;
    if(walk)walk.src=SRC;
    if(image)image.src=SRC;
    if(image&&(mode==='still'||mode==='walk')){
      const note=document.createElement('div');
      note.id='heroStillReviewNote';note.setAttribute('role','status');
      note.textContent=mode==='still'?'新主人公 · 静止画を確認中':'新主人公 · 歩行4コマを確認中';
      Object.assign(note.style,{position:'fixed',bottom:'58px',left:'8px',right:'8px',padding:'6px 8px',
        background:'#283027ee',color:'#f5ebce',fontSize:'11px',textAlign:'center',zIndex:'40',pointerEvents:'none'});
      document.body.append(note);
    }
    const ready=(asset)=>!!asset&&asset.complete&&asset.naturalWidth===FRAME_W*COUNT&&asset.naturalHeight===FRAME_H;
    function draw(ctx,f={state:'IDLE',animTime:0}){
      if(!ready(image))return false;
      ctx.save();ctx.imageSmoothingEnabled=false;
      const moving=f.state==='WALK'||f.state==='RUN';
      const useWalk=moving&&ready(walk);
      lastFrame=useWalk?Math.floor(Math.max(0,f.animTime)*(f.state==='RUN'?1.2:.8))%COUNT:null;
      const frame=lastFrame===null?3:lastFrame; // Four is the natural contact/idle pose.
      const size=76,scale=size/FRAME_H;
      ctx.drawImage(useWalk?walk:image,frame*FRAME_W,0,FRAME_W,FRAME_H,
        -FOOT_X*scale,-FOOT_Y*scale,FRAME_W*scale,FRAME_H*scale);
      ctx.restore();return true;
    }
    return {active,ready:()=>ready(image),draw,status:()=>({
      active,stillReady:ready(image),walkReady:ready(walk),lastFrame
    })};
  }
  root.CrownlessHeroStill={create};
})(typeof window==='object'?window:globalThis);

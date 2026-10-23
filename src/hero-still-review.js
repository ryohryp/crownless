/* Approved protagonist still + derived temporal walk. Frame time comes from
 * the fighter's simulation, so stopping/pausing never spins through poses. */
(function(root){
  'use strict';
  function create(){
    const mode=new URLSearchParams(location.search).get('actor');
    const active=mode!=='classic';
    const image=active?new Image():null;
    const walk=active&&mode!=='still'?new Image():null;
    let lastFrame=null;
    if(walk)walk.src='docs/assets/candidates/hero-walk-v1/walk.png';
    if(image){
      image.src='docs/assets/player-unarmed-approved-pixel-anchor-v1.png';
    }
    if(image&&(mode==='still'||mode==='walk')){
      const note=document.createElement('div');
      note.id='heroStillReviewNote';note.setAttribute('role','status');
      note.textContent=mode==='still'?'承認済みの主人公 · 静止画で比較':'歩行4コマを確認中 · 攻撃アニメは未作成';
      Object.assign(note.style,{position:'fixed',bottom:'58px',left:'8px',right:'8px',padding:'6px 8px',
        background:'#283027ee',color:'#f5ebce',fontSize:'11px',textAlign:'center',zIndex:'40',pointerEvents:'none'});
      document.body.append(note);
    }
    const ready=()=>!!image&&image.complete&&image.naturalWidth>0;
    function draw(ctx,f={state:'IDLE',animTime:0}){
      if(!ready())return false;
      ctx.save();ctx.imageSmoothingEnabled=false;
      const moving=f.state==='WALK'||f.state==='RUN';
      if(moving&&walk?.complete&&walk.naturalWidth===2048&&walk.naturalHeight===768){
        lastFrame=Math.floor(Math.max(0,f.animTime)*(f.state==='RUN'?1.2:.8))%4;
        const scale=80/768;
        ctx.drawImage(walk,lastFrame*512,0,512,768,-256*scale,-736*scale,512*scale,768*scale);
        ctx.restore();return true;
      }
      lastFrame=null;
      // Uniform reduction of the full coherent artwork. Crop is display-only;
      // the source/export remain unchanged and are not claimed as native 64px art.
      const height=64,width=height*820/1390;
      ctx.drawImage(image,110,100,820,1390,-width/2,-height,width,height);
      ctx.restore();return true;
    }
    return {active,ready,draw,status:()=>({active,stillReady:ready(),walkReady:!!walk&&walk.complete&&walk.naturalWidth===2048,lastFrame})};
  }
  root.CrownlessHeroStill={create};
})(typeof window==='object'?window:globalThis);

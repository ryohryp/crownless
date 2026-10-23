/* Opt-in art review only. One still is not an animation or an approved anchor. */
(function(root){
  'use strict';
  function create(){
    const active=new URLSearchParams(location.search).get('actor')==='still';
    const image=active?new Image():null;
    if(image){
      image.src='docs/assets/candidates/hero-still-v1/hero-review.png';
      const note=document.createElement('div');
      note.id='heroStillReviewNote';note.setAttribute('role','status');
      note.textContent='主人公の静止画候補 · 歩行・攻撃アニメは未作成';
      Object.assign(note.style,{position:'fixed',bottom:'58px',left:'8px',right:'8px',padding:'6px 8px',
        background:'#283027ee',color:'#f5ebce',fontSize:'11px',textAlign:'center',zIndex:'40',pointerEvents:'none'});
      document.body.append(note);
    }
    const ready=()=>!!image&&image.complete&&image.naturalWidth>0;
    function draw(ctx){
      if(!ready())return false;
      ctx.save();ctx.imageSmoothingEnabled=false;
      // Uniform reduction of the full coherent artwork. Crop is display-only;
      // the source/export remain unchanged and are not claimed as native 64px art.
      const height=64,width=height*820/1390;
      ctx.drawImage(image,110,100,820,1390,-width/2,-height,width,height);
      ctx.restore();return true;
    }
    return {active,ready,draw};
  }
  root.CrownlessHeroStill={create};
})(typeof window==='object'?window:globalThis);

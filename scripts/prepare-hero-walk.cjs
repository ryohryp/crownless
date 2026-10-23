'use strict';
// Atlas extraction/packing only. Preserve original generated art. Keep each
// connected figure intact rather than cutting the requested-but-misaligned grid.
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const zlib=require('node:zlib');
const folder=path.resolve(__dirname,'../docs/assets/candidates/hero-walk-v1');
const chunk=(type,payload)=>{const h=Buffer.alloc(6);h.writeUInt32LE(payload.length+6);h.writeUInt16LE(type,4);return Buffer.concat([h,payload]);};
(async()=>{
  const {data,info}=await sharp(path.join(folder,'source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info,visited=new Uint8Array(w*h),components=[];
  for(let i=0;i<w*h;i++){
    if(visited[i]||data[i*4+3]<220)continue;
    const pixels=[i];visited[i]=1;let x0=w,y0=h,x1=0,y1=0;
    for(let j=0;j<pixels.length;j++){
      const k=pixels[j],x=k%w,y=(k/w)|0;
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
      for(const n of [x?k-1:-1,x<w-1?k+1:-1,y?k-w:-1,y<h-1?k+w:-1]){
        if(n>=0&&!visited[n]&&data[n*4+3]>=220){visited[n]=1;pixels.push(n);}
      }
    }
    if(pixels.length>50000)components.push({pixels,x0,y0,x1,y1});
  }
  if(components.length!==4)throw Error('Expected exactly four complete foreground figures');
  components.sort((a,b)=>a.x0-b.x0);
  const cw=512,ch=768,pivot=[256,736],rawFrames=[],frames=[];
  for(let f=0;f<4;f++){
    const c=components[f],out=Buffer.alloc(cw*ch*4);
    const dx=pivot[0]-Math.round((c.x0+c.x1)/2),dy=pivot[1]-c.y1;
    const mask=new Set();
    // Retain original edge pixels around the opaque connected body, excluding
    // broad generated translucent halos and neighboring poses.
    for(const k of c.pixels)for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
      const x=k%w+ox,y=((k/w)|0)+oy;if(x>=0&&x<w&&y>=0&&y<h)mask.add(y*w+x);
    }
    for(const k of mask){const x=k%w+dx,y=((k/w)|0)+dy;if(x<0||x>=cw||y<0||y>=ch)throw Error('Frame clipping');data.copy(out,(y*cw+x)*4,k*4,k*4+4);}
    rawFrames.push(out);
    const name='frame-'+f+'.png';await sharp(out,{raw:{width:cw,height:ch,channels:4}}).png().toFile(path.join(folder,name));
    frames.push({index:f,durationMs:125,sourceBounds:[c.x0,c.y0,c.x1-c.x0+1,c.y1-c.y0+1],pivot});
  }
  await sharp({create:{width:cw*4,height:ch,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(rawFrames.map((input,i)=>({input,raw:{width:cw,height:ch,channels:4},left:i*cw,top:0}))).png().toFile(path.join(folder,'walk.png'));
  // Aseprite's documented RGBA layer/cel format, importable by Pixelorama.
  // This is source packaging, not a claim that an Aseprite license was used.
  const name=Buffer.from('Coherent body / walk'),layer=Buffer.alloc(18+name.length);
  layer.writeUInt16LE(3,0);layer[12]=255;layer.writeUInt16LE(name.length,16);name.copy(layer,18);
  const blocks=rawFrames.map((raw,i)=>{
    const cel=Buffer.alloc(20);cel[6]=255;cel.writeUInt16LE(2,7);cel.writeUInt16LE(cw,16);cel.writeUInt16LE(ch,18);
    const chunks=[...(i===0?[chunk(0x2004,layer)]:[]),chunk(0x2005,Buffer.concat([cel,zlib.deflateSync(raw)]))];
    const header=Buffer.alloc(16);header.writeUInt32LE(16+chunks.reduce((n,b)=>n+b.length,0));header.writeUInt16LE(0xf1fa,4);header.writeUInt16LE(chunks.length,6);header.writeUInt16LE(125,8);
    return Buffer.concat([header,...chunks]);
  });
  const header=Buffer.alloc(128);header.writeUInt32LE(128+blocks.reduce((n,b)=>n+b.length,0));header.writeUInt16LE(0xa5e0,4);header.writeUInt16LE(4,6);header.writeUInt16LE(cw,8);header.writeUInt16LE(ch,10);header.writeUInt16LE(32,12);header.writeUInt32LE(1,14);header.writeUInt16LE(125,18);
  await fs.writeFile(path.join(folder,'hero-walk.aseprite'),Buffer.concat([header,...blocks]));
  await fs.writeFile(path.join(folder,'frames.json'),JSON.stringify({cell:[cw,ch],pivot,frames},null,2));
  console.log(JSON.stringify({cell:[cw,ch],frames}));
})().catch(error=>{console.error(error);process.exitCode=1;});

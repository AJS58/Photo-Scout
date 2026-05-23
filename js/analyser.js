window.PhotoScoutAnalyser={
  async analyse(imageData){
    const metrics=await this.getImageMetrics(imageData);
    const faceInfo=await this.detectFacesIfAvailable(imageData);
    metrics.faceCount=faceInfo.count;
    metrics.hasFace=faceInfo.count>0;
    const decision=this.detectGenre(metrics);
    const genre=decision.genre;
    const data=window.PHOTO_SCOUT_RECOMMENDATIONS[genre];
    const score=Math.min(9.8,Math.max(6.2,data.scoreBase+decision.scoreBoost+(metrics.contrast-.18)*1.1+(metrics.brightness>.22&&metrics.brightness<.84?.35:-.18))).toFixed(1);
    return {
      genre:{type:genre,name:data.name,icon:data.icon,confidence:decision.confidence},
      overall:{score,verdict:`${data.name} is the most likely photographic use for this scene based on visible subject, colour, brightness and contrast cues. Use this as a planning note before returning with your main camera.`},
      lighting:this.lightingAdvice(metrics),
      settings:data.settings,
      tips:data.tips,
      metrics,
      subjects:decision.subjects,
      analysisNotes:decision.notes,
      candidates:decision.candidates
    };
  },

  getImageMetrics(imageData){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        const w=128,h=128;
        canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0,w,h);
        const px=ctx.getImageData(0,0,w,h).data;
        const regions={top:{},mid:{},bottom:{},centre:{},left:{},right:{}};
        const init=()=>({n:0,brightness:0,red:0,green:0,blue:0,blueSky:0,greenVeg:0,warm:0,dark:0,bright:0,sat:0});
        Object.keys(regions).forEach(k=>regions[k]=init());
        let brightness=0,blue=0,green=0,red=0,dark=0,bright=0,blueSky=0,greenVeg=0,warm=0,sat=0,skin=0,whiteGrey=0;
        const values=[],edgeValues=[];
        const luminance=new Float32Array(w*h);
        function add(rg,r,g,b,lum,saturation){
          rg.n++;rg.brightness+=lum;rg.red+=r/255;rg.green+=g/255;rg.blue+=b/255;rg.sat+=saturation;
          if(lum<.12)rg.dark++;if(lum>.9)rg.bright++;
          if(b>r*1.08&&b>g*1.02&&lum>.34&&saturation>.12)rg.blueSky++;
          if(g>r*1.04&&g>b*1.08&&lum>.18&&saturation>.15)rg.greenVeg++;
          if(r>g*1.05&&g>b*1.04&&lum>.25)rg.warm++;
        }
        for(let y=0;y<h;y++){
          for(let x=0;x<w;x++){
            const i=(y*w+x)*4,r=px[i],g=px[i+1],b=px[i+2];
            const max=Math.max(r,g,b),min=Math.min(r,g,b);
            const lum=(.2126*r+.7152*g+.0722*b)/255;
            const saturation=max===0?0:(max-min)/max;
            luminance[y*w+x]=lum;
            brightness+=lum;red+=r/255;green+=g/255;blue+=b/255;sat+=saturation;
            if(lum<.12)dark++;if(lum>.9)bright++;
            if(b>r*1.08&&b>g*1.02&&lum>.34&&saturation>.12)blueSky++;
            if(g>r*1.04&&g>b*1.08&&lum>.18&&saturation>.15)greenVeg++;
            if(r>g*1.05&&g>b*1.04&&lum>.25)warm++;
            if(r>95&&g>40&&b>20&&r>g&&g>b&&Math.abs(r-g)>15&&saturation>.18&&lum>.22&&lum<.82)skin++;
            if(saturation<.12&&lum>.25&&lum<.88)whiteGrey++;
            values.push(lum);
            if(y<h/3)add(regions.top,r,g,b,lum,saturation);
            else if(y<2*h/3)add(regions.mid,r,g,b,lum,saturation);
            else add(regions.bottom,r,g,b,lum,saturation);
            if(x>w*.33&&x<w*.67&&y>h*.25&&y<h*.75)add(regions.centre,r,g,b,lum,saturation);
            if(x<w/2)add(regions.left,r,g,b,lum,saturation); else add(regions.right,r,g,b,lum,saturation);
          }
        }
        const n=values.length;
        brightness/=n;red/=n;green/=n;blue/=n;sat/=n;
        const variance=values.reduce((s,v)=>s+(v-brightness)**2,0)/n;
        let edge=0,edgeN=0,horizonStrength=0,bestHorizon=0;
        for(let y=1;y<h-1;y++){
          let rowEdge=0;
          for(let x=1;x<w-1;x++){
            const c=luminance[y*w+x];
            const dx=Math.abs(c-luminance[y*w+x-1])+Math.abs(c-luminance[y*w+x+1]);
            const dy=Math.abs(c-luminance[(y-1)*w+x])+Math.abs(c-luminance[(y+1)*w+x]);
            const e=dx+dy;
            edge+=e;rowEdge+=e;edgeN++;
          }
          if(rowEdge>horizonStrength){horizonStrength=rowEdge;bestHorizon=y/h}
        }
        edge=edge/Math.max(edgeN,1);
        function finish(rg){const m={...rg};if(!m.n)return m;['brightness','red','green','blue','sat'].forEach(k=>m[k]/=m.n);['blueSky','greenVeg','warm','dark','bright'].forEach(k=>m[k]/=m.n);return m}
        Object.keys(regions).forEach(k=>regions[k]=finish(regions[k]));
        resolve({
          brightness,red,green,blue,contrast:Math.sqrt(variance),darkRatio:dark/n,brightRatio:bright/n,
          blueSkyRatio:blueSky/n,greenVegRatio:greenVeg/n,warmRatio:warm/n,saturation:sat,skinRatio:skin/n,whiteGreyRatio:whiteGrey/n,
          edgeDensity:edge,horizonStrength:horizonStrength/(w*2),horizonY:bestHorizon,aspect:img.width/img.height,regions,
          imageWidth:img.width,imageHeight:img.height
        });
      };
      img.src=imageData;
    });
  },

  async detectFacesIfAvailable(imageData){
    try{
      if(!('FaceDetector' in window)) return {count:0};
      const detector=new FaceDetector({fastMode:true,maxDetectedFaces:6});
      const img=new Image();
      await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=imageData});
      const faces=await detector.detect(img);
      return {count:faces.length};
    }catch(e){return {count:0}}
  },

  detectGenre(m){
    const scores={landscape:0,wildlife:0,night:0,fireworks:0,portrait:0,macro:0,street:0,architecture:0};
    const notes=[];const subjects=[];
    const topSky=m.regions.top.blueSky+.5*m.regions.mid.blueSky;
    const lowerGreen=m.regions.bottom.greenVeg+.5*m.regions.mid.greenVeg;
    const centreSkin=m.regions.centre?m.regions.centre.warm:0;
    const hasHorizon=m.horizonStrength>.16&&m.horizonY>.25&&m.horizonY<.75;

    if(m.hasFace){scores.portrait+=5.5;subjects.push(`${m.faceCount} face${m.faceCount>1?'s':''}`);notes.push('face detected');}
    if(m.skinRatio>.08||centreSkin>.18){scores.portrait+=2.2;subjects.push('possible person/skin tones');notes.push('warm skin-tone colours near centre');}

    if(m.brightness<.27&&m.darkRatio>.32){scores.night+=4.5;subjects.push('low-light scene');notes.push('very dark frame');}
    if(m.blue>.34&&m.darkRatio>.22&&m.brightness<.48){scores.night+=2.2;subjects.push('dark blue sky');}
    if(m.darkRatio>.42&&m.brightRatio>.018&&m.contrast>.24){scores.fireworks+=2.6;subjects.push('bright points against dark background');notes.push('fireworks/night-light pattern possible');}
    if(m.warmRatio>.12&&m.darkRatio>.28&&m.brightRatio>.025){scores.fireworks+=1.2;}

    if(topSky>.16){scores.landscape+=2.2;subjects.push('sky');notes.push('significant sky area');}
    if(lowerGreen>.16){scores.landscape+=1.5;scores.wildlife+=1.2;subjects.push('vegetation');}
    if(hasHorizon){scores.landscape+=1.8;subjects.push('strong horizon/scene layers');notes.push('landscape-style horizon/edge separation');}
    if(m.blueSkyRatio>.12&&m.greenVegRatio>.10){scores.landscape+=2.2;subjects.push('sky and natural foreground');}
    if(m.aspect>1.15&&m.blueSkyRatio+m.greenVegRatio>.16){scores.landscape+=.7;}

    if(m.greenVegRatio>.24&&m.edgeDensity>.055){scores.wildlife+=2.4;subjects.push('dense natural texture');notes.push('foliage/organic texture');}
    if(m.greenVegRatio>.30&&m.brightness>.25&&m.brightness<.75){scores.wildlife+=1.3;}

    if(m.edgeDensity>.075&&m.whiteGreyRatio>.18&&m.saturation<.34){scores.architecture+=3.5;subjects.push('hard edges / built structure');notes.push('high edge density with neutral tones');}
    if(m.contrast>.25&&m.edgeDensity>.08){scores.architecture+=1.2;scores.street+=.9;}
    if(m.whiteGreyRatio>.25&&m.blueSkyRatio>.05){scores.architecture+=1.4;}

    if(m.edgeDensity>.065&&m.skinRatio>.02&&!m.hasFace){scores.street+=2.0;subjects.push('busy mixed scene');}
    if(m.contrast>.22&&m.saturation>.18&&m.greenVegRatio<.18&&m.blueSkyRatio<.18){scores.street+=1.7;}
    if(m.regions.left&&Math.abs(m.regions.left.brightness-m.regions.right.brightness)>.16){scores.street+=.8;scores.architecture+=.6;}

    if(m.edgeDensity>.09&&m.regions.centre.saturation>.22&&m.blueSkyRatio<.10&&m.brightness>.25&&m.brightness<.82){scores.macro+=2.1;subjects.push('close detail/texture');notes.push('detailed central texture');}
    if(m.greenVegRatio>.16&&m.edgeDensity>.085&&m.aspect<1.35){scores.macro+=1.4;}

    if(m.brightRatio>.14){notes.push('strong highlight clipping risk');}
    if(!subjects.length){subjects.push('general scene');}

    const candidates=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    let [genre,score]=candidates[0];
    if(score<1.7){genre='landscape';score=1.7;notes.push('low-certainty scene; defaulting to broad location-scouting guidance');}
    const second=candidates[1]?.[1]||0;
    const gap=score-second;
    let confidence='moderate';
    if(score>=5||gap>=2.4)confidence='high';
    else if(score>=3||gap>=1.1)confidence='medium';
    else confidence='low / prototype';
    return {genre,confidence,scoreBoost:Math.min(1.0,score/7),subjects:[...new Set(subjects)].slice(0,6),notes:[...new Set(notes)].slice(0,6),candidates:candidates.slice(0,4).map(([g,s])=>({genre:g,score:Number(s.toFixed(2))}))};
  },

  confidence(m){return m.darkRatio>.35||m.green>.38||m.contrast>.26?'medium-high':'prototype'},

  lightingAdvice(m){
    if(m.brightRatio>.12)return{challenge:'highlight clipping risk',advice:'Bright areas may clip. Consider exposure compensation, bracketing, a graduated filter, or returning when light is softer.'};
    if(m.darkRatio>.35)return{challenge:'low light',advice:'Low light will need tripod support, wider apertures, higher ISO, or a planned blue-hour/night workflow.'};
    if(m.contrast>.25)return{challenge:'high contrast',advice:'Consider HDR bracketing, graduated filters, or waiting for softer light.'};
    return{challenge:'balanced light',advice:'Light appears reasonably balanced. Refine composition and plan the best return time.'};
  }
};

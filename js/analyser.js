window.PhotoScoutAnalyser={
  async analyse(imageData){
    const metrics=await this.getImageMetrics(imageData);
    const genre=this.detectGenre(metrics);
    const data=window.PHOTO_SCOUT_RECOMMENDATIONS[genre];
    const score=Math.min(9.8,Math.max(6.4,data.scoreBase+(metrics.contrast-.5)*1.2+(metrics.brightness>.25&&metrics.brightness<.82?.4:-.25))).toFixed(1);
    return {genre:{type:genre,name:data.name,icon:data.icon,confidence:this.confidence(metrics)},overall:{score,verdict:`Strong ${data.name.toLowerCase()} potential. Use this as a planning note before returning with your main camera.`},lighting:this.lightingAdvice(metrics),settings:data.settings,tips:data.tips,metrics};
  },
  getImageMetrics(imageData){
    return new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');const size=96;canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,size,size);const px=ctx.getImageData(0,0,size,size).data;let brightness=0,blue=0,green=0,red=0,dark=0,bright=0;const values=[];for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2];const lum=(.2126*r+.7152*g+.0722*b)/255;brightness+=lum;red+=r/255;green+=g/255;blue+=b/255;if(lum<.12)dark++;if(lum>.9)bright++;values.push(lum)}const n=values.length;brightness/=n;red/=n;green/=n;blue/=n;const variance=values.reduce((s,v)=>s+(v-brightness)**2,0)/n;resolve({brightness,red,green,blue,contrast:Math.sqrt(variance),darkRatio:dark/n,brightRatio:bright/n,aspect:img.width/img.height})};img.src=imageData})
  },
  detectGenre(m){
    if(m.brightness<.28&&m.darkRatio>.35)return 'night';
    if(m.green>.38&&m.blue>.26)return 'landscape';
    if(m.blue>.38&&m.brightness<.48)return 'night';
    if(m.contrast>.27&&m.brightRatio>.08)return 'architecture';
    if(m.green>.34&&m.contrast>.2)return 'wildlife';
    if(m.brightness>.62&&m.contrast<.18)return 'portrait';
    return ['landscape','street','architecture','portrait','macro'][Math.floor(Math.random()*5)];
  },
  confidence(m){return m.darkRatio>.35||m.green>.38||m.contrast>.26?'medium-high':'prototype'},
  lightingAdvice(m){
    if(m.brightRatio>.12)return{challenge:'highlight clipping risk',advice:'Bright areas may clip. Consider exposure compensation, bracketing, or returning when light is softer.'};
    if(m.darkRatio>.35)return{challenge:'low light',advice:'Low light will need tripod support, wider apertures, higher ISO, or a planned blue-hour/night workflow.'};
    if(m.contrast>.25)return{challenge:'high contrast',advice:'Consider HDR bracketing, graduated filters, or waiting for softer light.'};
    return{challenge:'balanced light',advice:'Light appears reasonably balanced. Refine composition and plan the best return time.'};
  }
};

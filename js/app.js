const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);let videoStream=null,currentCamera='environment',capturedImageData=null,currentRecommendations=null,currentPosition=null,currentWeather=null,currentExif=null,grid=false,zebras=false,histogram=false,histogramTimer=null,deferredInstall=null,currentVideoTrack=null,zoomSupported=false,exposureOpen=false,metaOpen=false,metaTimer=null,cameraWatchdogTimer=null,lastVideoTime=0,stallCount=0,cameraRestarting=false,focusToastTimer=null,highlightTimer=null;
function init(){setTimeout(()=>$('#splashScreen').classList.add('hidden'),5000);tickClock();setInterval(tickClock,1000);bindUI();renderHelp();renderPlanner();updateCount();initCamera();if(!localStorage.getItem('photoScout.tutorialDone'))showTutorial();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=19').catch(()=>{});}
function bindUI(){ $$('.tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab))); $('#galleryBtn').onclick=()=>$('#fileInput').click(); $('#fileInput').onchange=handleFileSelect; $('#gridToggle').onclick=toggleGrid; $('#captureBtn').onclick=capturePhoto; $('#cameraSwitchBtn').onclick=switchCamera; $('#gpsBtn').onclick=getGPS; $('#zebraBtn').onclick=toggleZebras; $('#histogramBtn').onclick=toggleHistogram; $('#exposureBtn').onclick=toggleExposureControls; $('#metaBtn').onclick=toggleCameraMeta; if($('#zoomSlider')) $('#zoomSlider').oninput=e=>setCameraZoom(e.target.value); if($('#evSlider')) $('#evSlider').oninput=e=>setExposureCompensation(e.target.value); if($('#isoSlider')) $('#isoSlider').oninput=e=>setISO(e.target.value); if($('#autoExposureBtn')) $('#autoExposureBtn').onclick=resetAutoExposure; $('#settingsBtn').onclick=showTutorial; initTapToFocus(); $('#confirmSaveBtn').onclick=e=>{e.preventDefault();saveLocation()}; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#installBtn').hidden=false}); $('#installBtn').onclick=async()=>{if(deferredInstall){deferredInstall.prompt();deferredInstall=null;$('#installBtn').hidden=true}};document.addEventListener('visibilitychange',handleVisibilityChange);window.addEventListener('pagehide',stopCamera);}
function tickClock(){$('#time').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}function switchTab(tab){$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.tab-panel').forEach(p=>p.classList.remove('active')); if(tab==='scout')$('#scoutTab').classList.add('active'); if(tab==='locations'){renderLocations();$('#locationsTab').classList.add('active')} if(tab==='planner'){renderPlanner();$('#plannerTab').classList.add('active')} if(tab==='help')$('#helpTab').classList.add('active');}
async function initCamera(){try{stopCamera(false);const constraints={video:{facingMode:currentCamera,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}},audio:false};videoStream=await navigator.mediaDevices.getUserMedia(constraints);const video=$('#videoElement');video.srcObject=videoStream;video.muted=true;video.setAttribute('playsinline','');try{await video.play()}catch{}currentVideoTrack=videoStream.getVideoTracks()[0]||null;$('#captureBtn').hidden=false;$('#cameraSwitchBtn').hidden=false;setupZoomControls();setupExposureControls();updateCameraMeta();initTapToFocus();startCameraWatchdog()}catch(err){stopCamera(false);$('#cameraView').innerHTML=`<div class="camera-placeholder"><div style="font-size:52px">📸</div><p>Camera unavailable or permission denied.</p><p class="small">Use Gallery to test the app with an existing image.</p></div><button class="grid-toggle" id="gridToggle">▦ Grid: OFF</button><div class="rule-of-thirds" id="ruleOfThirds"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="33.33" y1="0" x2="33.33" y2="100"/><line x1="66.66" y1="0" x2="66.66" y2="100"/><line x1="0" y1="33.33" x2="100" y2="33.33"/><line x1="0" y1="66.66" x2="100" y2="66.66"/></svg></div>`;$('#gridToggle').onclick=toggleGrid;}}
function stopCamera(clearVideo=true){clearInterval(cameraWatchdogTimer);cameraWatchdogTimer=null;if(videoStream){videoStream.getTracks().forEach(t=>t.stop());videoStream=null}currentVideoTrack=null;if(clearVideo&&$('#videoElement'))$('#videoElement').srcObject=null}
function startCameraWatchdog(){clearInterval(cameraWatchdogTimer);lastVideoTime=$('#videoElement')?.currentTime||0;stallCount=0;cameraWatchdogTimer=setInterval(async()=>{const v=$('#videoElement');if(!v||!videoStream||document.hidden||cameraRestarting)return;const t=v.currentTime||0;if(t===lastVideoTime&&v.readyState>=2){stallCount++}else{stallCount=0;lastVideoTime=t}if(stallCount>=3){cameraRestarting=true;try{await initCamera()}finally{cameraRestarting=false,focusToastTimer=null,highlightTimer=null;stallCount=0}}},2000)}
async function handleVisibilityChange(){if(document.hidden){clearInterval(cameraWatchdogTimer);cameraWatchdogTimer=null}else if(!videoStream){await initCamera()}else{try{await $('#videoElement').play()}catch{}startCameraWatchdog()}}
async function switchCamera(){currentCamera=currentCamera==='environment'?'user':'environment';await initCamera()}function toggleGrid(){grid=!grid;$('#ruleOfThirds')?.classList.toggle('active',grid);$('#gridToggle').textContent=grid?'▦ Grid: ON':'▦ Grid: OFF';$('#gridToggle').classList.toggle('active-tool',grid)}function toggleZebras(){
  zebras=!zebras;
  const overlay=$('#exposureOverlay');
  if(overlay) overlay.toggleAttribute('hidden',!zebras);
  $('#zebraBtn').classList.toggle('active-tool',zebras);
  if(zebras){drawHighlightAlert();clearInterval(highlightTimer);highlightTimer=setInterval(drawHighlightAlert,300)}
  else{clearInterval(highlightTimer);highlightTimer=null;clearHighlightAlert()}
}

function initTapToFocus(){
  const view=$('#cameraView');
  if(!view||view.dataset.tapFocus==='1') return;
  view.dataset.tapFocus='1';
  view.addEventListener('pointerup',handleTapToFocus,{passive:false});
}
async function handleTapToFocus(e){
  const ignore=e.target.closest('button,.histogram-panel,.zoom-control,.camera-meta-overlay,.exposure-control');
  if(ignore) return;
  const view=$('#cameraView');
  const rect=view.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
  showFocusRing(e.clientX-rect.left,e.clientY-rect.top);
  let applied=false;
  if(currentVideoTrack&&currentVideoTrack.applyConstraints){
    try{await currentVideoTrack.applyConstraints({advanced:[{focusMode:'continuous',pointsOfInterest:[{x,y}]}]});applied=true;}catch{}
    if(!applied){try{await currentVideoTrack.applyConstraints({advanced:[{pointsOfInterest:[{x,y}]}]});applied=true;}catch{}}
  }
  showFocusToast(applied?'Focus point requested':'Focus marker only — Chrome/Safari PWA has not exposed true touch focus');
}
function showFocusRing(x,y){
  const ring=$('#focusRing');
  if(!ring)return;
  ring.style.left=x+'px';ring.style.top=y+'px';
  ring.classList.add('active');
  clearTimeout(ring._t);ring._t=setTimeout(()=>ring.classList.remove('active'),900);
}
function showFocusToast(msg){
  const toast=$('#focusToast');
  if(!toast)return;
  toast.textContent=msg;toast.classList.add('show');
  clearTimeout(focusToastTimer);focusToastTimer=setTimeout(()=>toast.classList.remove('show'),1700);
}

function setupZoomControls(){const control=$('#zoomControl'),slider=$('#zoomSlider'),value=$('#zoomValue');if(!control||!slider||!currentVideoTrack)return;let caps={};try{caps=currentVideoTrack.getCapabilities?currentVideoTrack.getCapabilities():{}}catch{};if(caps.zoom){zoomSupported=true;slider.min=caps.zoom.min||1;slider.max=caps.zoom.max||1;slider.step=caps.zoom.step||0.1;slider.value=caps.zoom.min||1;value.textContent=(+slider.value).toFixed(1)+'×';control.hidden=false}else{zoomSupported=false;control.hidden=true}}
async function setCameraZoom(v){const value=$('#zoomValue');if(value)value.textContent=(+v).toFixed(1)+'×';if(!currentVideoTrack||!zoomSupported)return;try{await currentVideoTrack.applyConstraints({advanced:[{zoom:+v}]})}catch{}}
function setupExposureControls(){const support=$('#exposureSupportText'),evRow=$('#evRow'),isoRow=$('#isoRow'),ev=$('#evSlider'),iso=$('#isoSlider');if(!currentVideoTrack||!support)return;let caps={},settings={};try{caps=currentVideoTrack.getCapabilities?currentVideoTrack.getCapabilities():{};settings=currentVideoTrack.getSettings?currentVideoTrack.getSettings():{}}catch{};let supported=[];if(caps.exposureCompensation&&evRow&&ev){ev.min=caps.exposureCompensation.min;ev.max=caps.exposureCompensation.max;ev.step=caps.exposureCompensation.step||0.1;ev.value=settings.exposureCompensation??0;$('#evValue').textContent=(+ev.value).toFixed(1);evRow.hidden=false;supported.push('EV compensation')}else if(evRow)evRow.hidden=true;if(caps.iso&&isoRow&&iso){iso.min=caps.iso.min;iso.max=caps.iso.max;iso.step=caps.iso.step||50;iso.value=settings.iso||caps.iso.min||100;$('#isoValue').textContent=settings.iso?Math.round(settings.iso):'Auto';isoRow.hidden=false;supported.push('ISO')}else if(isoRow)isoRow.hidden=true;support.innerHTML=supported.length?`Supported: ${supported.join(', ')}`:'Manual ISO / exposure compensation is not exposed by this browser. On iPhone this is normal in Safari/PWA mode; the native app stage can unlock deeper camera control.';}
async function setExposureCompensation(v){$('#evValue').textContent=(+v).toFixed(1);if(!currentVideoTrack)return;try{await currentVideoTrack.applyConstraints({advanced:[{exposureCompensation:+v}]});updateCameraMeta()}catch{}}
async function setISO(v){$('#isoValue').textContent=Math.round(+v);if(!currentVideoTrack)return;try{await currentVideoTrack.applyConstraints({advanced:[{iso:+v}]});updateCameraMeta()}catch{}}
async function resetAutoExposure(){if(!currentVideoTrack)return;try{await currentVideoTrack.applyConstraints({advanced:[{exposureMode:'continuous'}]})}catch{};setupExposureControls();updateCameraMeta()}
function toggleExposureControls(){exposureOpen=!exposureOpen;$('#exposureControl')?.toggleAttribute('hidden',!exposureOpen);$('#exposureBtn').classList.toggle('active-tool',exposureOpen);if(exposureOpen)setupExposureControls()}
function toggleCameraMeta(){metaOpen=!metaOpen;$('#cameraMetaOverlay')?.toggleAttribute('hidden',!metaOpen);$('#metaBtn').classList.toggle('active-tool',metaOpen);if(metaOpen){updateCameraMeta();metaTimer=setInterval(updateCameraMeta,1000)}else{clearInterval(metaTimer);metaTimer=null}}
function updateCameraMeta(){const box=$('#cameraMetaContent');if(!box)return;let st={};try{st=currentVideoTrack&&currentVideoTrack.getSettings?currentVideoTrack.getSettings():{}}catch{};const v=$('#videoElement');const rows=[];rows.push(`Mode: ${currentCamera==='environment'?'Rear camera':'Front camera'}`);rows.push(`Preview: ${(v?.videoWidth||st.width||0)} × ${(v?.videoHeight||st.height||0)}`);rows.push(`Frame rate: ${st.frameRate?Math.round(st.frameRate)+' fps':'not exposed'}`);rows.push(`Zoom: ${st.zoom?Number(st.zoom).toFixed(1)+'×':'not exposed'}`);rows.push(`Shutter: ${currentExif?.shutter||st.exposureTime||'not exposed live'}`);rows.push(`Aperture: ${currentExif?.aperture||'not exposed live'}`);rows.push(`ISO: ${currentExif?.iso||st.iso||'not exposed live'}`);rows.push(`Focal length: ${currentExif?.focalLength||'not exposed live'}`);rows.push(`EV comp: ${st.exposureCompensation!==undefined?Number(st.exposureCompensation).toFixed(1):'not exposed'}`);if(st.exposureMode)rows.push(`Exposure mode: ${st.exposureMode}`);if(currentPosition)rows.push(`GPS: ${currentPosition.coords.latitude.toFixed(5)}, ${currentPosition.coords.longitude.toFixed(5)}`);if(currentExif)rows.push(`EXIF source: imported image`);box.innerHTML=rows.map(r=>`<div>${r}</div>`).join('')+'<div class="meta-note">Live iPhone camera streams do not normally expose shutter/aperture/ISO to browser apps. Imported iPhone photos may show EXIF.</div>'}

function initDraggableHistogram(){const panel=$('#histogramPanel'),view=$('#cameraView');if(!panel||panel.dataset.draggable==='1')return;panel.dataset.draggable='1';let startX=0,startY=0,startLeft=0,startTop=0;const move=(x,y)=>{const r=view.getBoundingClientRect(),pr=panel.getBoundingClientRect();let left=Math.max(8,Math.min(r.width-pr.width-8,startLeft+(x-startX)));let top=Math.max(8,Math.min(r.height-pr.height-8,startTop+(y-startY)));panel.style.left=left+'px';panel.style.top=top+'px';panel.style.bottom='auto'};panel.addEventListener('pointerdown',e=>{if(e.target.tagName==='CANVAS'){}panel.setPointerCapture(e.pointerId);panel.classList.add('dragging');const r=view.getBoundingClientRect(),pr=panel.getBoundingClientRect();startX=e.clientX;startY=e.clientY;startLeft=pr.left-r.left;startTop=pr.top-r.top;e.preventDefault()});panel.addEventListener('pointermove',e=>{if(!panel.classList.contains('dragging'))return;move(e.clientX,e.clientY)});panel.addEventListener('pointerup',e=>{panel.classList.remove('dragging');try{panel.releasePointerCapture(e.pointerId)}catch{}})}

function clearHighlightAlert(){
  const canvas=$('#exposureOverlay');
  if(!canvas||!canvas.getContext)return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width||1,canvas.height||1);
}
function drawHighlightAlert(){
  const v=$('#videoElement'),overlay=$('#exposureOverlay'),view=$('#cameraView');
  if(!zebras||!v||!overlay||!view||!v.videoWidth){return;}
  const rect=view.getBoundingClientRect();
  const ow=Math.max(160,Math.round(rect.width));
  const oh=Math.max(160,Math.round(rect.height));
  if(overlay.width!==ow) overlay.width=ow;
  if(overlay.height!==oh) overlay.height=oh;
  const ctx=overlay.getContext('2d',{willReadFrequently:true});
  ctx.clearRect(0,0,ow,oh);
  const sample=document.createElement('canvas');
  const sw=160,sh=Math.max(90,Math.round(160*(oh/ow)));
  sample.width=sw;sample.height=sh;
  const sx=sample.getContext('2d',{willReadFrequently:true});
  try{sx.drawImage(v,0,0,sw,sh)}catch{return;}
  let data;
  try{data=sx.getImageData(0,0,sw,sh).data}catch{return;}
  const scaleX=ow/sw,scaleY=oh/sh;
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  for(let y=0;y<sh;y+=2){
    for(let x=0;x<sw;x+=2){
      const i=(y*sw+x)*4;
      const r=data[i],g=data[i+1],b=data[i+2];
      const lum=0.2126*r+0.7152*g+0.0722*b;
      const clipped=(lum>246&&Math.max(r,g,b)>250)||(r>248&&g>248&&b>248);
      if(!clipped) continue;
      const px=x*scaleX,py=y*scaleY,pw=Math.max(2,2*scaleX),ph=Math.max(2,2*scaleY);
      if(((x+y)&6)===0){
        ctx.fillStyle='rgba(239,68,68,.42)';
        ctx.fillRect(px,py,pw,ph);
      }else{
        ctx.strokeStyle='rgba(255,40,40,.62)';
        ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(px,py+ph);ctx.lineTo(px+pw,py);ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function toggleHistogram(){histogram=!histogram;const panel=$('#histogramPanel');if(panel)panel.toggleAttribute('hidden',!histogram);$('#histogramBtn').classList.toggle('active-tool',histogram);if(histogram){initDraggableHistogram();drawHistogram();histogramTimer=setInterval(drawHistogram,750)}else{clearInterval(histogramTimer);histogramTimer=null}}
function drawHistogram(){const v=$('#videoElement'),canvas=$('#histogramCanvas');if(!v||!canvas||!v.videoWidth)return;const sample=document.createElement('canvas');const w=120,h=68;sample.width=w;sample.height=h;const sx=sample.getContext('2d',{willReadFrequently:true});try{sx.drawImage(v,0,0,w,h)}catch{return}const data=sx.getImageData(0,0,w,h).data;const bins=new Array(64).fill(0);for(let i=0;i<data.length;i+=24){const lum=(0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2]);bins[Math.min(63,Math.floor(lum/4))]++}const max=Math.max(...bins,1);const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;for(let x=0;x<=4;x++){ctx.beginPath();ctx.moveTo((canvas.width/4)*x,0);ctx.lineTo((canvas.width/4)*x,canvas.height);ctx.stroke()}ctx.fillStyle='rgba(147,197,253,.9)';const bw=canvas.width/bins.length;bins.forEach((b,i)=>{const bar=(b/max)*(canvas.height-8);ctx.fillRect(i*bw,canvas.height-bar,bw*.82,bar)});ctx.fillStyle='rgba(251,191,36,.92)';ctx.fillRect(0,0,4,canvas.height);ctx.fillStyle='rgba(239,68,68,.92)';ctx.fillRect(canvas.width-4,0,4,canvas.height)}
function capturePhoto(){const v=$('#videoElement');const c=document.createElement('canvas');c.width=v.videoWidth||1280;c.height=v.videoHeight||720;c.getContext('2d').drawImage(v,0,0,c.width,c.height);currentExif=null;capturedImageData=c.toDataURL('image/jpeg',.9);analyseImage()}function handleFileSelect(e){const f=e.target.files[0];if(!f)return;currentExif=null;const metaReader=new FileReader();metaReader.onload=ev=>{currentExif=parseExif(ev.target.result);updateCameraMeta()};metaReader.readAsArrayBuffer(f);const r=new FileReader();r.onload=ev=>{capturedImageData=ev.target.result;analyseImage()};r.readAsDataURL(f)}
async function analyseImage(){switchPanelToAnalysis(`<img src="${capturedImageData}" class="captured-img" style="height:260px"><div class="content"><div class="card"><div class="spinner"></div><h3>Analysing location…</h3><p class="muted">Checking scene brightness, sky/vegetation, edges, possible faces and likely photographic genre.</p></div></div>`);currentRecommendations=await PhotoScoutAnalyser.analyse(capturedImageData);renderAnalysis()}function switchPanelToAnalysis(html){$$('.tab').forEach(b=>b.classList.remove('active'));$$('.tab-panel').forEach(p=>p.classList.remove('active'));$('#analysisView').innerHTML=html;$('#analysisView').classList.add('active')}
function renderAnalysis(){const r=currentRecommendations;const settings=Object.entries(r.settings).map(([k,v])=>`<div class="tip"><strong>${label(k)}:</strong><br>${v}</div>`).join('');const tips=r.tips.map(t=>`<div class="tip">• ${t}</div>`).join('');const subjects=(r.subjects||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join('');const notes=(r.analysisNotes||[]).map(x=>`<div class="tip small">${escapeHTML(x)}</div>`).join('')||'<p class="muted small">No strong visual cues detected. Result is best treated as a scouting suggestion.</p>';const candidates=(r.candidates||[]).map(c=>`<span>${label(c.genre)} ${c.score}</span>`).join('');switchPanelToAnalysis(`<img src="${capturedImageData}" class="captured-img" style="height:260px"><div class="content"><div class="card hero-card"><h2>${r.genre.icon} ${r.genre.name}</h2><p>Confidence: ${r.genre.confidence}</p></div><div class="card"><div class="planner-row"><div><h3>Location Assessment</h3><p class="muted">${r.overall.verdict}</p></div><div class="score">${r.overall.score}</div></div></div><div class="card"><h3>${iconSVG('histogram')} Local Subject Detection</h3><p class="muted">Photo Scout now uses local browser-based image cues instead of random genre selection. No image is uploaded for this prototype analysis.</p><div class="mini-chips">${subjects}</div>${notes}<p class="muted small">Candidate scores: ${candidates}</p></div><div class="card"><h3>Location / GPS</h3>${locationHTML()}</div><div class="card">${weatherHTML(currentWeather)}</div><div class="card"><h3>${iconSVG('light')} Lighting</h3><p><strong>${r.lighting.challenge}</strong></p><p class="muted">${r.lighting.advice}</p></div><div class="card"><h3>${iconSVG('settings')} Suggested Camera Settings</h3>${settings}</div><div class="card"><h3>${iconSVG('tips')} Pro Tips</h3>${tips}</div></div><div class="controls"><button class="btn btn-secondary" data-action="retake">Retake</button><button class="btn btn-secondary" data-action="shareCurrent">Share</button><button class="btn btn-primary" data-action="openSaveDialog">Save</button></div>`)}
function label(k){return k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}function retake(){switchTab('scout')}async function getGPS(){
  if(!navigator.geolocation){
    alert('GPS is not available in this browser.');
    return;
  }
  const panel=$('#scoutWeatherPanel');
  if(panel){panel.hidden=false;panel.innerHTML='<div class="card weather-card"><h3>Loading GPS, weather & light…</h3><p class="muted">Please allow location access. Forecast data will appear here.</p></div>';}
  try{
    currentPosition=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:18000,maximumAge:60000}));
    updateCameraMeta();
    currentWeather=await fetchWeather(currentPosition.coords.latitude,currentPosition.coords.longitude);
    const gpsBlock=`<div class="card"><h3>${iconSVG('map')} GPS Saved</h3><p><strong>Lat/Lon:</strong> ${currentPosition.coords.latitude.toFixed(6)}, ${currentPosition.coords.longitude.toFixed(6)}</p><p class="muted small">Accuracy: ${Math.round(currentPosition.coords.accuracy)}m</p><p><a class="text-link" href="${mapURL(currentPosition.coords.latitude,currentPosition.coords.longitude)}" target="_blank" rel="noopener">Open map</a></p></div>`;
    const weatherBlock=weatherHTML(currentWeather);
    renderScoutWeather(gpsBlock+`<div class="card">${weatherBlock}</div>`);
    if(currentWeather?.fallback){
      alert('GPS was saved. Live weather could not be reached, so Photo Scout has added estimated light/moon data and a placeholder forecast panel.');
    }else{
      alert('GPS, forecast and light data saved.');
    }
  }catch(err){
    if(panel){panel.hidden=false;panel.innerHTML='<div class="card"><h3>GPS unavailable</h3><p class="muted">Location permission was denied or the GPS request timed out. You can still use the app without coordinates.</p></div>';}
    alert('GPS permission unavailable or timed out. You can still save locations without coordinates.');
  }
}
async function fetchWeather(lat,lng){
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=5`;
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('weather '+r.status);
    const j=await r.json();
    const d=j.daily||{},c=j.current||{};
    const days=(d.time||[]).map((date,i)=>({date,code:d.weather_code?.[i],summary:weatherCode(d.weather_code?.[i]),max:round(d.temperature_2m_max?.[i]),min:round(d.temperature_2m_min?.[i]),rain:d.precipitation_probability_max?.[i],uv:round(d.uv_index_max?.[i]),sunrise:d.sunrise?.[i],sunset:d.sunset?.[i],moon:moonPhaseForDate(new Date(date))}));
    const today=days[0]||{};
    today.sunriseTime=timeOnly(today.sunrise);
    today.sunsetTime=timeOnly(today.sunset);
    today.morningGolden=today.sunrise?`${timeOnly(today.sunrise)} – ${timePlus(today.sunrise,60)}`:'Unavailable';
    today.eveningGolden=today.sunset?`${timeMinus(today.sunset,60)} – ${timeOnly(today.sunset)}`:'Unavailable';
    today.moon=today.moon||moonPhaseForDate(new Date());
    return{fetched:new Date().toISOString(),lat,lng,fallback:false,current:{temp:round(c.temperature_2m),humidity:c.relative_humidity_2m,wind:round(c.wind_speed_10m),code:c.weather_code,summary:weatherCode(c.weather_code)},today,days};
  }catch(e){
    console.warn('Weather fetch failed:',e);
    return estimatedWeather(lat,lng);
  }
}
function estimatedWeather(lat,lng){
  const base=new Date();
  const days=[];
  for(let i=0;i<5;i++){
    const d=new Date(base);d.setDate(base.getDate()+i);
    const iso=d.toISOString().slice(0,10);
    days.push({date:iso,summary:'Weather unavailable',max:'—',min:'—',rain:'—',uv:'—',sunrise:null,sunset:null,moon:moonPhaseForDate(d)});
  }
  const today=days[0];
  today.sunriseTime='approx. 05:00';
  today.sunsetTime='approx. 21:00';
  today.morningGolden='approx. 05:00 – 06:00';
  today.eveningGolden='approx. 20:00 – 21:00';
  today.moon=moonPhaseForDate(base);
  return{fetched:new Date().toISOString(),lat,lng,fallback:true,current:{temp:'—',humidity:'—',wind:'—',summary:'Live forecast unavailable'},today,days};
}
function moonPhaseForDate(date){
  const synodic=29.530588853;
  const knownNew=Date.UTC(2000,0,6,18,14,0);
  const days=(date.getTime()-knownNew)/86400000;
  let phase=(days%synodic)/synodic;
  if(phase<0)phase+=1;
  return moonPhase(phase);
}
function weatherCode(c){const map={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm'};return map[c]||'Forecast'}function moonPhase(v){if(v===undefined||v===null)return'Unavailable';if(v<.03||v>.97)return'New moon';if(v<.22)return'Waxing crescent';if(v<.28)return'First quarter';if(v<.47)return'Waxing gibbous';if(v<.53)return'Full moon';if(v<.72)return'Waning gibbous';if(v<.78)return'Last quarter';return'Waning crescent'}
function weatherHTML(w){if(!w)return'<p class="muted">No weather saved yet. Tap GPS before saving to add coordinates, forecast, golden-hour and moon-phase data.</p>';return`<div class="weather-card"><h3>Weather & Light${w.fallback?' <span class="badge-warn">estimated</span>':''}</h3>${w.fallback?'<p class="notice">Live weather could not be loaded. GPS and light/moon planning data has still been saved.</p>':''}<div class="detail-grid"><div><span>Now</span><strong>${w.current.temp}°C</strong><small>${w.current.summary}</small></div><div><span>Wind</span><strong>${w.current.wind} km/h</strong><small>Humidity ${w.current.humidity??'—'}%</small></div><div><span>Morning golden hour</span><strong>${w.today.morningGolden}</strong><small>Sunrise ${w.today.sunriseTime||'—'}</small></div><div><span>Evening golden hour</span><strong>${w.today.eveningGolden}</strong><small>Sunset ${w.today.sunsetTime||'—'}</small></div><div><span>Moon phase</span><strong>${w.today.moon}</strong><small>Planning aid</small></div></div><h4>5-day outlook</h4><div class="forecast-strip">${w.days.map(d=>`<div><strong>${new Date(d.date).toLocaleDateString([],{weekday:'short'})}</strong><br>${d.summary}<br>${d.max}°/${d.min}°<br>Rain ${d.rain??'—'}%</div>`).join('')}</div></div>`}
function mapURL(lat,lng){return`https://maps.apple.com/?ll=${lat},${lng}&q=Photo%20Scout%20Location`}
function openSaveDialog(){const dt=new Date(Date.now()+86400000);dt.setMinutes(0,0,0);$('#returnDateTime').value=dt.toISOString().slice(0,16);$('#locationNotes').value='';$('#saveDialog').showModal()}function saveLocation(){const name=$('#locationName').value.trim()||`${currentRecommendations.genre.name} location`;const notes=$('#locationNotes')?$('#locationNotes').value.trim():'';const coords=currentPosition?{lat:currentPosition.coords.latitude,lng:currentPosition.coords.longitude,accuracy:currentPosition.coords.accuracy}:null;PhotoScoutStorage.add({id:Date.now(),name,notes,image:capturedImageData,recommendations:currentRecommendations,coords,weather:currentWeather,returnDateTime:$('#returnDateTime').value,date:new Date().toLocaleDateString()});$('#locationName').value='';if($('#locationNotes'))$('#locationNotes').value='';$('#saveDialog').close();updateCount();switchTab('locations')}
function updateCount(){$('#locationCount').textContent=PhotoScoutStorage.get().length}function renderLocations(){const items=PhotoScoutStorage.get();updateCount();if(!items.length){$('#locationsTab').innerHTML='<div class="empty-state"><h3>No saved locations yet</h3><p>Scout or upload a location to get started.</p></div>';return}$('#locationsTab').innerHTML=`<div class="location-grid">${items.map(i=>`<article class="location-card" data-action="showDetail" data-id="${i.id}"><button class="delete-btn" data-action="deleteLocation" data-id="${i.id}">×</button><img src="${i.image}" class="location-img"><div class="location-info"><h3>${i.recommendations.genre.icon} ${i.name}</h3><p class="muted small">${i.date}${i.coords?` · GPS saved`:''}${i.weather?` · Light/weather saved`:''}</p><div class="mini-chips"><span>Score ${i.recommendations.overall.score}</span>${i.weather?`<span>${i.weather.today.moon}</span>`:''}${i.returnDateTime?`<span>Return planned</span>`:''}</div></div></article>`).join('')}</div>`}
function deleteLocation(id,e){e.stopPropagation();if(confirm('Delete this location?')){PhotoScoutStorage.remove(id);renderLocations();renderPlanner();}}
function showDetail(id){const i=PhotoScoutStorage.get().find(x=>x.id===id);if(!i)return;const coords=i.coords?`<div class="detail-grid"><div><span>Latitude</span><strong>${i.coords.lat.toFixed(6)}</strong><small>Accuracy ${Math.round(i.coords.accuracy)}m</small></div><div><span>Longitude</span><strong>${i.coords.lng.toFixed(6)}</strong><small><a class="text-link" href="${mapURL(i.coords.lat,i.coords.lng)}" target="_blank" rel="noopener">Open Apple/Google Maps</a></small></div></div>`:'<p class="muted">No GPS coordinate saved.</p>';const notes=i.notes?`<div class="card"><h3>Notes</h3><p>${escapeHTML(i.notes)}</p></div>`:'';$('#detailContent').innerHTML=`<img src="${i.image}" style="width:100%;height:220px;object-fit:cover;border-radius:12px"><h2>${i.recommendations.genre.icon} ${i.name}</h2><p class="muted">${i.date}</p><div class="card"><h3>${iconSVG('map')} Location</h3>${coords}</div><div class="card"><h3>${iconSVG('calendar')} Return Visit</h3><p><strong>${i.returnDateTime?new Date(i.returnDateTime).toLocaleString():'Not scheduled'}</strong></p></div><div class="card"><h3>Recommendation</h3><p>${i.recommendations.overall.verdict}</p><p><strong>Score:</strong> ${i.recommendations.overall.score}</p></div><div class="card">${weatherHTML(i.weather)}</div>${notes}<div class="card"><h3>${iconSVG('settings')} Camera Settings</h3>${Object.entries(i.recommendations.settings).map(([k,v])=>`<div class="tip"><strong>${label(k)}:</strong><br>${v}</div>`).join('')}</div><div class="dialog-actions"><button class="btn btn-secondary" data-action="downloadICS" data-id="${i.id}">Calendar</button><button class="btn btn-secondary" data-action="downloadReport" data-id="${i.id}">Report</button><button class="btn btn-secondary" data-action="shareLocation" data-id="${i.id}">Share</button><button class="btn btn-primary" data-action="closeDetail">Close</button></div>`;$('#detailDialog').showModal()}
function renderPlanner(){const items=PhotoScoutStorage.get();const scheduled=items.filter(i=>i.returnDateTime).sort((a,b)=>new Date(a.returnDateTime)-new Date(b.returnDateTime));$('#plannerTab').innerHTML=`<div class="content"><div class="card"><h2>${iconSVG('calendar')} Return Visit Planner</h2><p class="muted">Choose a saved location, review weather/light notes and export a calendar file for iPhone, Android, Mac or Windows.</p></div>${scheduled.length?scheduled.map(i=>`<div class="card planner-card"><div class="planner-row"><div><h3>${i.name}</h3><p class="muted">${new Date(i.returnDateTime).toLocaleString()}</p><p class="small">${i.weather?`Golden hour: ${i.weather.today.eveningGolden} · Moon: ${i.weather.today.moon}`:'No weather/light data saved'}</p></div><div class="planner-actions"><button class="btn btn-secondary" data-action="showDetail" data-id="${i.id}">Details</button><button class="btn btn-primary" data-action="downloadICS" data-id="${i.id}">Calendar</button></div></div></div>`).join(''):'<div class="empty-state"><h3>No return visits scheduled yet</h3><p>Save a scouted location with a return date.</p></div>'}${items.length?`<div class="card"><h3>All saved locations</h3>${items.map(i=>`<p><button class="text-button" data-action="showDetail" data-id="${i.id}">${i.name}</button> <span class="muted small">${i.coords?'GPS saved':'No GPS'} · ${i.weather?'Weather/light saved':'No weather'}</span></p>`).join('')}</div>`:''}</div>`}
function downloadICS(id){const i=PhotoScoutStorage.get().find(x=>x.id===id);if(!i)return;const start=i.returnDateTime?new Date(i.returnDateTime):new Date(Date.now()+86400000);const end=new Date(start.getTime()+2*3600000);const fmt=d=>d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';const loc=i.coords?`${i.coords.lat},${i.coords.lng}`:'';const desc=[i.recommendations.overall.verdict,i.weather?`Golden hour: ${i.weather.today.morningGolden} / ${i.weather.today.eveningGolden}`:'',i.weather?`Moon phase: ${i.weather.today.moon}`:'',i.coords?`Map: ${mapURL(i.coords.lat,i.coords.lng)}`:'',i.notes?`Notes: ${i.notes}`:''].filter(Boolean).join('\\n');const body=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Photo Scout//EN\nBEGIN:VEVENT\nUID:${i.id}@photo-scout\nDTSTAMP:${fmt(new Date())}\nDTSTART:${fmt(start)}\nDTEND:${fmt(end)}\nSUMMARY:Photo Scout - ${i.name}\nLOCATION:${loc}\nDESCRIPTION:${desc}\nEND:VEVENT\nEND:VCALENDAR`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'text/calendar'}));a.download=`photo-scout-${i.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.ics`;a.click();URL.revokeObjectURL(a.href)}
function locationReportText(i){return[`Photo Scout Location Report`,``,`Analysis method: local subject/genre detection, no image upload in PWA prototype`,`Location: ${i.name}`,`Date saved: ${i.date}`,i.coords?`GPS: ${i.coords.lat.toFixed(6)}, ${i.coords.lng.toFixed(6)}`:'GPS: not saved',i.coords?`Map: ${mapURL(i.coords.lat,i.coords.lng)}`:'',`Return visit: ${i.returnDateTime?new Date(i.returnDateTime).toLocaleString():'Not scheduled'}`,`Genre: ${i.recommendations.genre.name}`,`Score: ${i.recommendations.overall.score}`,`Assessment: ${i.recommendations.overall.verdict}`,i.weather?`Golden hour: ${i.weather.today.morningGolden} / ${i.weather.today.eveningGolden}`:'Weather/light: not saved',i.weather?`Moon phase: ${i.weather.today.moon}`:'',``,`Camera settings:`,...Object.entries(i.recommendations.settings).map(([k,v])=>`${label(k)}: ${v}`),``,`Notes: ${i.notes||'None'}`].filter(x=>x!==null&&x!==undefined).join('\n')}
function downloadReport(id){const i=PhotoScoutStorage.get().find(x=>x.id===id);if(!i)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([locationReportText(i)],{type:'text/plain'}));a.download=`photo-scout-report-${i.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.txt`;a.click();URL.revokeObjectURL(a.href)}
async function shareCurrent(){if(!navigator.share)return alert('Sharing is not available in this browser.');await navigator.share({title:'Photo Scout recommendation',text:`${currentRecommendations.genre.name}: ${currentRecommendations.overall.verdict}`}).catch(()=>{})}async function shareLocation(id){const i=PhotoScoutStorage.get().find(x=>x.id===id);if(!navigator.share)return alert('Sharing is not available in this browser.');await navigator.share({title:`Photo Scout - ${i.name}`,text:locationReportText(i)}).catch(()=>{})}
function escapeHTML(str){return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderScoutWeather(html){const panel=$('#scoutWeatherPanel');if(panel){panel.innerHTML=html;panel.hidden=false}}
function locationHTML(){if(!currentPosition)return'<p class="muted">No GPS captured yet. Tap GPS before saving if you want weather and coordinates stored with this location.</p>';return`<p><strong>GPS:</strong> ${currentPosition.coords.latitude.toFixed(6)}, ${currentPosition.coords.longitude.toFixed(6)}</p><p class="muted small">Accuracy: ${Math.round(currentPosition.coords.accuracy)}m</p>`}
function iconSVG(name){const icons={brand:'<svg viewBox="0 0 24 24"><path d="M4 8.2h3.1l1.2-2.1h5.4l1.2 2.1H20a2 2 0 0 1 2 2v7.1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.1a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13.6" r="3.6"/><circle cx="18.3" cy="10.3" r=".8"/></svg>',camera:'<svg viewBox="0 0 24 24"><path d="M4 8.2h3.1l1.2-2.1h5.4l1.2 2.1H20a2 2 0 0 1 2 2v7.1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.1a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13.6" r="3.6"/></svg>',map:'<svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>',calendar:'<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/></svg>',histogram:'<svg viewBox="0 0 24 24"><path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="2.5" height="6" rx=".5"/><rect x="11" y="8" width="2.5" height="10" rx=".5"/><rect x="15" y="5" width="2.5" height="13" rx=".5"/></svg>',light:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',settings:'<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.8v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3v-2.8h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h2.8v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V13h-.2a1.7 1.7 0 0 0-1.6 1Z"/></svg>',tips:'<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.2 1 2.1V17h6v-.2c0-.9.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg>'};return`<span class="pro-icon" aria-hidden="true">${icons[name]||icons.brand}</span>`}
function parseExif(buf){try{const dv=new DataView(buf);if(dv.getUint16(0)!==0xFFD8)return null;let o=2;while(o<dv.byteLength){if(dv.getUint8(o)!==0xFF)break;const marker=dv.getUint8(o+1),len=dv.getUint16(o+2);if(marker===0xE1){const exif=String.fromCharCode(...new Uint8Array(buf,o+4,4));if(exif!=='Exif')return null;return readTiff(dv,o+10)}o+=2+len}}catch(e){}return null}
function readTiff(dv,tiff){const le=dv.getUint16(tiff)===0x4949;const u16=o=>dv.getUint16(o,le),u32=o=>dv.getUint32(o,le);if(u16(tiff+2)!==42)return null;const tags={};function val(off,type,count){const ptr=count*((type===3)?2:4)<=4?off+8:tiff+u32(off+8);if(type===3)return u16(ptr);if(type===4)return u32(ptr);if(type===5){const n=u32(ptr),d=u32(ptr+4);return d?n/d:null}return null}function readIFD(pos){const n=u16(pos);for(let i=0;i<n;i++){const off=pos+2+i*12;const tag=u16(off),type=u16(off+2),count=u32(off+4);tags[tag]=val(off,type,count)}return pos+2+n*12}readIFD(tiff+u32(tiff+4));if(tags[34665])readIFD(tiff+tags[34665]);const shutter=tags[33434]?`1/${Math.round(1/tags[33434])}s`:null;const aperture=tags[33437]?`f/${Number(tags[33437]).toFixed(1).replace('.0','')}`:null;const iso=tags[34855]?`ISO ${tags[34855]}`:null;const focalLength=tags[37386]?`${Number(tags[37386]).toFixed(0)}mm`:null;return(shutter||aperture||iso||focalLength)?{shutter,aperture,iso,focalLength}:null}

function renderHelp(){$('#helpTab').innerHTML=`<div class="content"><div class="card help-section"><h2>${iconSVG('brand')} Welcome to Photo Scout</h2><p class="muted">A location scouting assistant for photographers who want to record promising places, analyse the likely genre and return later with a DSLR or mirrorless camera.</p></div><div class="card help-section"><h3>${iconSVG('camera')} Scout</h3><p>Use the live camera or upload a photo. Toggle the stronger rule-of-thirds grid, tap the preview to request focus where the browser/device allows it, save GPS, and analyse the scene. v15 adds local subject/genre detection using image cues such as sky, vegetation, edges, brightness, contrast and possible faces where the browser supports face detection.</p></div><div class="card help-section"><h3>${iconSVG('map')} Weather, GPS & Light</h3><p>Tap GPS before saving. Photo Scout then adds coordinates, 5-day forecast, sunrise, sunset, golden hour and moon phase to that location.</p></div><div class="card help-section"><h3>${iconSVG('histogram')} Histogram & Exposure</h3><p>The histogram can be toggled on and dragged around the camera screen. Highlight Alert now marks only likely clipped highlight areas, such as bright sky, using a red mottled overlay. It is an exposure warning, not a focus tool. Chrome/Safari PWAs often do not expose true touch-to-focus, shutter, aperture or ISO from the live camera stream, so deeper camera control remains a native-app stage feature.</p></div><div class="card help-section"><h3>${iconSVG('calendar')} Calendar Export</h3><p>Saved return dates can be exported as .ics calendar files for iPhone, Android, Mac and Windows calendars.</p></div><div class="card help-section"><h3>${iconSVG('settings')} Privacy & Beta Safety</h3><p>Photo Scout stores saved locations locally on the device in this browser/PWA build. It does not upload your scouting photos to a server. GPS is only requested when you tap GPS, and weather is requested from the forecast service using approximate coordinates.</p><p class="muted small">For beta testing, use browser mode first if Android shows an install warning, and only share non-sensitive test locations.</p></div><button class="btn btn-primary" data-action="showTutorial">View Tutorial Again</button></div>`}function showTutorial(){let step=0;const slides=[['brand','Photo Scout','Scout a location on your phone and return later with your main camera.'],['camera','Capture or Upload','Use the in-app camera or gallery to analyse a potential photographic location.'],['map','Save GPS, Weather & Light','Save coordinates, 5-day forecast, golden hour and moon phase with each location.'],['histogram','Histogram & Overlays','Use the stronger grid, clipped-highlight alert, tap marker and a movable histogram as practical field aids.'],['calendar','Plan the Return','Export your planned return visit to your calendar.']];function draw(){const s=slides[step];$('#tutorialContent').innerHTML=`<div class="tutorial-slide-pro"><div class="tutorial-icon-pro">${iconSVG(s[0])}</div><h2>${s[1]}</h2><p class="muted">${s[2]}</p><p class="tutorial-dots-pro">${slides.map((_,i)=>i===step?'●':'○').join(' ')}</p><div class="dialog-actions"><button class="btn btn-secondary" id="skipTut">Skip</button><button class="btn btn-primary" id="nextTut">${step===slides.length-1?'Start':'Next'}</button></div></div>`;$('#skipTut').onclick=close;$('#nextTut').onclick=()=>{step<slides.length-1?(step++,draw()):close()}}function close(){localStorage.setItem('photoScout.tutorialDone','1');$('#tutorialDialog').close()}draw();$('#tutorialDialog').showModal()}window.retake=retake;window.openSaveDialog=openSaveDialog;window.deleteLocation=deleteLocation;window.showDetail=showDetail;window.downloadICS=downloadICS;window.downloadReport=downloadReport;window.shareLocation=shareLocation;window.shareCurrent=shareCurrent;window.showTutorial=showTutorial;// v19: old direct init listener disabled; guarded starter at end is used instead.

/* v16 beta-polish additions: confidence explanation, manual override, score breakdown, tester feedback, privacy screen, field warnings */
function getScoreBreakdown(r){
  const m=(r&&r.metrics)||{};
  const weather=currentWeather||r.weather||null;
  const light=Math.max(4,Math.min(10,((m.brightness||.45)>.22&&(m.brightness||.45)<.78?8.2:6.1)+((m.brightRatio||0)>.12?-1.3:0)+((m.contrast||.18)>.25?-0.4:0)));
  const composition=Math.max(4,Math.min(10,6.8+((m.horizonStrength||0)>.16?1.0:0)+((m.edgeDensity||0)>.07?.8:0)+((m.blueSkyRatio||0)+(m.greenVegRatio||0)>.22?.7:0)));
  const weatherScore=weather?Math.max(4,Math.min(10,7.2+(weather.fallback?-.8:.5))):5.5;
  const access=currentPosition?7.5:5.8;
  const returnPotential=Math.max(4,Math.min(10,(light+composition+weatherScore+access)/4+.4));
  return {light,composition,weather:weatherScore,accessibility:access,returnPotential};
}
function scoreBreakdownHTML(r){const s=r.scoreBreakdown||getScoreBreakdown(r);r.scoreBreakdown=s;return `<div class="score-grid"><div><span>Light</span><strong>${s.light.toFixed(1)}</strong></div><div><span>Composition</span><strong>${s.composition.toFixed(1)}</strong></div><div><span>Weather</span><strong>${s.weather.toFixed(1)}</strong></div><div><span>Access</span><strong>${s.accessibility.toFixed(1)}</strong></div><div><span>Return potential</span><strong>${s.returnPotential.toFixed(1)}</strong></div></div>`}
function detectionExplanationHTML(r){
  const subjects=(r.subjects||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join('');
  const notes=(r.analysisNotes||[]).map(x=>`<li>${escapeHTML(x)}</li>`).join('')||'<li>No very strong visual cue detected; treat this as a beta suggestion.</li>';
  const candidates=(r.candidates||[]).map(c=>`<span>${label(c.genre)} ${c.score}</span>`).join('');
  return `<p class="muted">Detected as <strong>${r.genre.name}</strong> because of the visible image cues below. This is local browser analysis only; no image upload is used in this build.</p><div class="mini-chips">${subjects}</div><ul class="reason-list">${notes}</ul><p class="muted small">Alternative matches: ${candidates||'none'}</p>`
}
function genreOverrideHTML(r){const genres=Object.entries(window.PHOTO_SCOUT_RECOMMENDATIONS).map(([k,v])=>`<option value="${k}" ${r.genre.type===k?'selected':''}>${v.icon} ${v.name}</option>`).join('');return `<div class="override-row"><label><strong>Manual override</strong><select id="genreOverrideSelect">${genres}</select></label><button class="btn btn-secondary" data-action="applyGenreOverride">Apply</button></div><p class="muted small">Use this if Photo Scout gets the genre wrong during beta testing.</p>`}
function applyGenreOverride(){const sel=$('#genreOverrideSelect');if(!sel||!currentRecommendations)return;const key=sel.value;const data=window.PHOTO_SCOUT_RECOMMENDATIONS[key];if(!data)return;currentRecommendations={...currentRecommendations,genre:{type:key,name:data.name,icon:data.icon,confidence:'manual override'},settings:data.settings,tips:data.tips,overall:{...currentRecommendations.overall,verdict:`Manual override selected: ${data.name}. Recommendations have been updated for this genre.`},analysisNotes:[`manual override selected from ${currentRecommendations.genre.name} to ${data.name}`,...(currentRecommendations.analysisNotes||[])]};renderAnalysis()}
function renderAnalysis(){const r=currentRecommendations;r.scoreBreakdown=getScoreBreakdown(r);const settings=Object.entries(r.settings).map(([k,v])=>`<div class="tip"><strong>${label(k)}:</strong><br>${v}</div>`).join('');const tips=r.tips.map(t=>`<div class="tip">• ${t}</div>`).join('');switchPanelToAnalysis(`<img src="${capturedImageData}" class="captured-img" style="height:260px"><div class="content"><div class="card hero-card"><h2>${r.genre.icon} ${r.genre.name}</h2><p>Confidence: ${r.genre.confidence}</p></div><div class="card"><div class="planner-row"><div><h3>Location Assessment</h3><p class="muted">${r.overall.verdict}</p></div><div class="score">${r.overall.score}</div></div></div><div class="card"><h3>${iconSVG('histogram')} Why this was detected</h3>${detectionExplanationHTML(r)}${genreOverrideHTML(r)}</div><div class="card"><h3>${iconSVG('settings')} Score Breakdown</h3>${scoreBreakdownHTML(r)}<p class="muted small">Scores are planning aids only. They are designed to help decide whether a location is worth returning to with a main camera.</p></div><div class="card"><h3>Location / GPS</h3>${locationHTML()}</div><div class="card">${weatherHTML(currentWeather)}</div><div class="card"><h3>${iconSVG('light')} Lighting</h3><p><strong>${r.lighting.challenge}</strong></p><p class="muted">${r.lighting.advice}</p></div><div class="card"><h3>${iconSVG('settings')} Suggested Camera Settings</h3>${settings}</div><div class="card"><h3>${iconSVG('tips')} Pro Tips</h3>${tips}</div></div><div class="controls"><button class="btn btn-secondary" data-action="retake">Retake</button><button class="btn btn-secondary" data-action="openFeedbackDialog">Feedback</button><button class="btn btn-secondary" data-action="shareCurrent">Share</button><button class="btn btn-primary" data-action="openSaveDialog">Save</button></div>`)}
function saveLocation(){const name=$('#locationName').value.trim()||`${currentRecommendations.genre.name} location`;const notes=$('#locationNotes')?$('#locationNotes').value.trim():'';const coords=currentPosition?{lat:currentPosition.coords.latitude,lng:currentPosition.coords.longitude,accuracy:currentPosition.coords.accuracy}:null;currentRecommendations.scoreBreakdown=getScoreBreakdown(currentRecommendations);PhotoScoutStorage.add({id:Date.now(),name,notes,image:capturedImageData,recommendations:currentRecommendations,coords,weather:currentWeather,returnDateTime:$('#returnDateTime').value,date:new Date().toLocaleDateString()});$('#locationName').value='';if($('#locationNotes'))$('#locationNotes').value='';$('#saveDialog').close();updateCount();switchTab('locations')}
function showDetail(id){const i=PhotoScoutStorage.get().find(x=>x.id===id);if(!i)return;const coords=i.coords?`<div class="detail-grid"><div><span>Latitude</span><strong>${i.coords.lat.toFixed(6)}</strong><small>Accuracy ${Math.round(i.coords.accuracy)}m</small></div><div><span>Longitude</span><strong>${i.coords.lng.toFixed(6)}</strong><small><a class="text-link" href="${mapURL(i.coords.lat,i.coords.lng)}" target="_blank" rel="noopener">Open Apple/Google Maps</a></small></div></div>`:'<p class="muted">No GPS coordinate saved.</p>';const notes=i.notes?`<div class="card"><h3>Notes</h3><p>${escapeHTML(i.notes)}</p></div>`:'';$('#detailContent').innerHTML=`<img src="${i.image}" style="width:100%;height:220px;object-fit:cover;border-radius:12px"><h2>${i.recommendations.genre.icon} ${i.name}</h2><p class="muted">${i.date}</p><div class="card"><h3>${iconSVG('map')} Location</h3>${coords}</div><div class="card"><h3>${iconSVG('calendar')} Return Visit</h3><p><strong>${i.returnDateTime?new Date(i.returnDateTime).toLocaleString():'Not scheduled'}</strong></p></div><div class="card"><h3>Recommendation</h3><p>${i.recommendations.overall.verdict}</p><p><strong>Score:</strong> ${i.recommendations.overall.score}</p></div><div class="card"><h3>${iconSVG('histogram')} Detection Explanation</h3>${detectionExplanationHTML(i.recommendations)}</div><div class="card"><h3>${iconSVG('settings')} Score Breakdown</h3>${scoreBreakdownHTML(i.recommendations)}</div><div class="card">${weatherHTML(i.weather)}</div>${notes}<div class="card"><h3>${iconSVG('settings')} Camera Settings</h3>${Object.entries(i.recommendations.settings).map(([k,v])=>`<div class="tip"><strong>${label(k)}:</strong><br>${v}</div>`).join('')}</div><div class="dialog-actions"><button class="btn btn-secondary" data-action="downloadICS" data-id="${i.id}">Calendar</button><button class="btn btn-secondary" data-action="downloadReport" data-id="${i.id}">Report</button><button class="btn btn-secondary" data-action="openFeedbackDialog" data-id="${i.id}">Feedback</button><button class="btn btn-secondary" data-action="shareLocation" data-id="${i.id}">Share</button><button class="btn btn-primary" data-action="closeDetail">Close</button></div>`;$('#detailDialog').showModal()}
function locationReportText(i){const sb=i.recommendations.scoreBreakdown||getScoreBreakdown(i.recommendations);return[`Photo Scout Location Report`,``,`Analysis method: local subject/genre detection, no image upload in PWA prototype`,`Location: ${i.name}`,`Date saved: ${i.date}`,i.coords?`GPS: ${i.coords.lat.toFixed(6)}, ${i.coords.lng.toFixed(6)}`:'GPS: not saved',i.coords?`Map: ${mapURL(i.coords.lat,i.coords.lng)}`:'',`Return visit: ${i.returnDateTime?new Date(i.returnDateTime).toLocaleString():'Not scheduled'}`,`Genre: ${i.recommendations.genre.name}`,`Confidence: ${i.recommendations.genre.confidence}`,`Score: ${i.recommendations.overall.score}`,`Score breakdown: Light ${sb.light.toFixed(1)} / Composition ${sb.composition.toFixed(1)} / Weather ${sb.weather.toFixed(1)} / Access ${sb.accessibility.toFixed(1)} / Return potential ${sb.returnPotential.toFixed(1)}`,`Assessment: ${i.recommendations.overall.verdict}`,`Detected cues: ${(i.recommendations.subjects||[]).join(', ')||'none recorded'}`,`Detection notes: ${(i.recommendations.analysisNotes||[]).join('; ')||'none recorded'}`,i.weather?`Golden hour: ${i.weather.today.morningGolden} / ${i.weather.today.eveningGolden}`:'Weather/light: not saved',i.weather?`Moon phase: ${i.weather.today.moon}`:'',``,`Camera settings:`,...Object.entries(i.recommendations.settings).map(([k,v])=>`${label(k)}: ${v}`),``,`Notes: ${i.notes||'None'}`].filter(x=>x!==null&&x!==undefined).join('\n')}
function downloadReport(id){const i=PhotoScoutStorage.get().find(x=>x.id===id);if(!i)return;const html=`<!doctype html><html><head><meta charset="utf-8"><title>Photo Scout Report - ${escapeHTML(i.name)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:32px;color:#111827}h1{color:#1e3a8a}.card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin:14px 0}.muted{color:#6b7280}img{max-width:100%;border-radius:14px}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>Photo Scout Report</h1><p class="muted">Generated locally from the Photo Scout beta app.</p><img src="${i.image}"><div class="card"><pre>${escapeHTML(locationReportText(i))}</pre></div></body></html>`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download=`photo-scout-report-${i.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.html`;a.click();URL.revokeObjectURL(a.href)}
function openFeedbackDialog(id){const i=id?PhotoScoutStorage.get().find(x=>x.id===id):null;const context=i?locationReportText(i):currentRecommendations?`Current analysis: ${currentRecommendations.genre.name}, confidence ${currentRecommendations.genre.confidence}`:'General app feedback';$('#detailContent').innerHTML=`<h2>${iconSVG('tips')} Beta Feedback</h2><p class="muted">Use this to record tester comments, bugs or incorrect genre detection. A feedback text file can then be sent back to Anthony/Cameracal Services.</p><label>What happened?<textarea id="feedbackText" rows="7" placeholder="Example: detected landscape but image was architecture; weather did not load; live view froze…"></textarea></label><div class="card"><h3>Attached context</h3><pre class="feedback-context">${escapeHTML(context)}</pre></div><div class="dialog-actions"><button class="btn btn-secondary" data-action="copyFeedback">Copy</button><button class="btn btn-secondary" data-action="downloadFeedback">Download</button><button class="btn btn-primary" data-action="closeDetail">Close</button></div>`;$('#detailDialog').showModal()}
function feedbackBody(){return [`Photo Scout beta feedback`,`Date: ${new Date().toLocaleString()}`,`Online: ${navigator.onLine?'yes':'no'}`,`Device: ${navigator.userAgent}`,``,`Tester note:`,($('#feedbackText')?.value||'').trim()||'(no note entered)',``,`Context:`,($('.feedback-context')?.textContent||'')].join('\n')}
async function copyFeedback(){try{await navigator.clipboard.writeText(feedbackBody());alert('Feedback copied.')}catch{downloadFeedback()}}
function downloadFeedback(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([feedbackBody()],{type:'text/plain'}));a.download=`photo-scout-feedback-${Date.now()}.txt`;a.click();URL.revokeObjectURL(a.href)}
function showPrivacyScreen(){ $('#detailContent').innerHTML=`<h2>${iconSVG('settings')} Privacy & Safety</h2><div class="card"><h3>Photos</h3><p>In this PWA beta, scouting images are stored locally in the browser on the device. The local analysis runs in the browser and does not upload images to an AI server.</p></div><div class="card"><h3>GPS</h3><p>GPS is only requested when the user taps the GPS button. Saved coordinates remain in the browser’s local storage unless the user chooses to share/export a report.</p></div><div class="card"><h3>Weather</h3><p>When GPS is used, approximate coordinates are sent to the weather service to fetch forecast, sunrise/sunset and light-planning data.</p></div><div class="card"><h3>Beta testing advice</h3><p>Use non-sensitive test locations, keep the GitHub link private during early testing, and use browser mode if an Android install warning appears.</p></div><div class="dialog-actions"><button class="btn btn-primary" data-action="closeDetail">Close</button></div>`;$('#detailDialog').showModal()}
function setupFieldWarnings(){let banner=document.createElement('div');banner.id='fieldWarningBanner';banner.className='field-warning';document.body.appendChild(banner);async function update(){let warnings=[];if(!navigator.onLine)warnings.push('Offline');try{if(navigator.getBattery){const b=await navigator.getBattery();if(b.level<.2&&!b.charging)warnings.push('Low battery')}}catch{};banner.textContent=warnings.length?'Field warning: '+warnings.join(' · '):'';banner.classList.toggle('show',warnings.length>0)}window.addEventListener('online',update);window.addEventListener('offline',update);update();setInterval(update,60000)}
function renderHelp(){$('#helpTab').innerHTML=`<div class="content"><div class="card help-section"><h2>${iconSVG('brand')} Welcome to Photo Scout</h2><p class="muted">A location scouting assistant for photographers who want to record promising places, analyse the likely genre and return later with a DSLR or mirrorless camera.</p></div><div class="card help-section"><h3>${iconSVG('camera')} Scout</h3><p>Use the live camera or upload a photo. Toggle the stronger rule-of-thirds grid, save GPS, and analyse the scene. v16 adds confidence explanations, manual genre override, score breakdowns and beta feedback tools.</p></div><div class="card help-section"><h3>${iconSVG('histogram')} Detection & Manual Override</h3><p>Photo Scout uses local image cues such as sky, vegetation, brightness, contrast, edge density and possible faces. If the detected genre is wrong, change it using Manual Override on the analysis screen.</p></div><div class="card help-section"><h3>${iconSVG('map')} Weather, GPS & Light</h3><p>Tap GPS before saving. Photo Scout then adds coordinates, 5-day forecast, sunrise, sunset, golden hour and moon phase to that location where available.</p></div><div class="card help-section"><h3>${iconSVG('settings')} Histogram & Exposure</h3><p>The histogram can be toggled on and dragged around the camera screen. Highlight Alert marks likely clipped highlight areas only. Browser camera APIs still limit true iPhone/Android manual exposure and focus control until the native app stage.</p></div><div class="card help-section"><h3>${iconSVG('calendar')} Reports & Calendar</h3><p>Saved return dates can be exported as .ics calendar files. Saved locations can also export a simple HTML scouting report.</p></div><div class="card help-section"><h3>${iconSVG('settings')} Privacy & Beta Safety</h3><p>Photos and saved locations remain local to the device/browser in this PWA build unless the user chooses to export or share them.</p><div class="dialog-actions"><button class="btn btn-secondary" data-action="showPrivacyScreen">Privacy Screen</button><button class="btn btn-secondary" data-action="openFeedbackDialog">Tester Feedback</button></div></div><button class="btn btn-primary" data-action="showTutorial">View Tutorial Again</button></div>`}
function showTutorial(){let step=0;const slides=[['brand','Photo Scout','Scout a location on your phone and return later with your main camera.'],['histogram','Confidence Explained','Photo Scout now explains why a genre was detected and shows alternative matches.'],['settings','Manual Override','If the app gets the genre wrong, change it and the recommendations update instantly.'],['map','Save GPS, Weather & Light','Save coordinates, forecast, golden hour and moon phase with each location.'],['tips','Beta Feedback','Create feedback notes for bugs, wrong detections or tester comments.'],['calendar','Plan the Return','Export your planned return visit and scouting report.']];function draw(){const s=slides[step];$('#tutorialContent').innerHTML=`<div class="tutorial-slide-pro"><div class="tutorial-icon-pro">${iconSVG(s[0])}</div><h2>${s[1]}</h2><p class="muted">${s[2]}</p><p class="tutorial-dots-pro">${slides.map((_,i)=>i===step?'●':'○').join(' ')}</p><div class="dialog-actions"><button class="btn btn-secondary" id="skipTut">Skip</button><button class="btn btn-primary" id="nextTut">${step===slides.length-1?'Start':'Next'}</button></div></div>`;$('#skipTut').onclick=close;$('#nextTut').onclick=()=>{step<slides.length-1?(step++,draw()):close()}}function close(){localStorage.setItem('photoScout.tutorialDone','1');$('#tutorialDialog').close()}draw();$('#tutorialDialog').showModal()}
window.applyGenreOverride=applyGenreOverride;window.openFeedbackDialog=openFeedbackDialog;window.copyFeedback=copyFeedback;window.downloadFeedback=downloadFeedback;window.showPrivacyScreen=showPrivacyScreen;window.downloadReport=downloadReport;window.showDetail=showDetail;window.saveLocation=saveLocation;window.renderAnalysis=renderAnalysis;window.showTutorial=showTutorial;
document.addEventListener('DOMContentLoaded',()=>{setupFieldWarnings();});


// v17: CSP-safe dynamic button handling and beta stability fixes
function bindDynamicActions(){
  if(window.__photoScoutDynamicActionsBound) return;
  window.__photoScoutDynamicActionsBound=true;
  document.addEventListener('click', async (e)=>{
    const el=e.target.closest('[data-action]');
    if(!el) return;
    e.preventDefault();
    e.stopPropagation();
    const action=el.dataset.action;
    const id=el.dataset.id ? Number(el.dataset.id) : undefined;
    try{
      if(action==='retake') return retake();
      if(action==='shareCurrent') return shareCurrent();
      if(action==='openSaveDialog') return openSaveDialog();
      if(action==='showTutorial') return showTutorial();
      if(action==='openFeedbackDialog') return openFeedbackDialog(id);
      if(action==='showPrivacyScreen') return showPrivacyScreen();
      if(action==='applyGenreOverride') return applyGenreOverride();
      if(action==='copyFeedback') return copyFeedback();
      if(action==='downloadFeedback') return downloadFeedback();
      if(action==='closeDetail') return $('#detailDialog')?.close();
      if(action==='showDetail') return showDetail(id);
      if(action==='deleteLocation') return deleteLocation(id,e);
      if(action==='downloadICS') return downloadICS(id);
      if(action==='downloadReport') return downloadReport(id);
      if(action==='shareLocation') return shareLocation(id);
    }catch(err){
      console.error('Photo Scout action failed:', action, err);
      alert('Sorry, that action did not complete. Please try again.');
    }
  }, true);
}

// Make retake restart the scout tab/camera reliably on iPhone after analysis.
retake=function(){
  capturedImageData=null;
  currentRecommendations=null;
  switchTab('scout');
  setTimeout(()=>{ if(!videoStream) initCamera(); else $('#videoElement')?.play?.().catch(()=>{}); },150);
};

// More robust save dialog for iOS/Safari and older browsers.
openSaveDialog=function(){
  if(!currentRecommendations){ alert('Please capture or import a photo first.'); return; }
  const dt=new Date(Date.now()+86400000);dt.setMinutes(0,0,0);
  if($('#returnDateTime')) $('#returnDateTime').value=dt.toISOString().slice(0,16);
  if($('#locationNotes')) $('#locationNotes').value='';
  const dlg=$('#saveDialog');
  if(dlg?.showModal) dlg.showModal();
  else { const name=prompt('Location name', `${currentRecommendations.genre.name} location`); if(name!==null){ $('#locationName').value=name; saveLocation(); } }
};

// More robust save that validates data and handles localStorage quota errors.
saveLocation=function(){
  if(!currentRecommendations||!capturedImageData){ alert('Nothing to save yet. Please capture or import a photo first.'); return; }
  const name=($('#locationName')?.value||'').trim()||`${currentRecommendations.genre.name} location`;
  const notes=$('#locationNotes')?$('#locationNotes').value.trim():'';
  const coords=currentPosition?{lat:currentPosition.coords.latitude,lng:currentPosition.coords.longitude,accuracy:currentPosition.coords.accuracy}:null;
  try{
    currentRecommendations.scoreBreakdown=getScoreBreakdown(currentRecommendations);
    PhotoScoutStorage.add({id:Date.now(),name,notes,image:capturedImageData,recommendations:currentRecommendations,coords,weather:currentWeather,returnDateTime:$('#returnDateTime')?.value||'',date:new Date().toLocaleDateString()});
    if($('#locationName')) $('#locationName').value='';
    if($('#locationNotes')) $('#locationNotes').value='';
    try{$('#saveDialog')?.close()}catch{}
    updateCount();
    renderPlanner();
    switchTab('locations');
  }catch(err){
    console.error('Save failed',err);
    alert('Save failed. Your browser storage may be full. Try deleting older saved locations or using a smaller image.');
  }
};

// Share with fallback copy/download so it works on desktop, iPhone and Android.
shareCurrent=async function(){
  if(!currentRecommendations){ alert('Please analyse a photo first.'); return; }
  const text=`Photo Scout beta analysis\nGenre: ${currentRecommendations.genre.name}\nConfidence: ${currentRecommendations.genre.confidence}\nScore: ${currentRecommendations.overall.score}\n${currentRecommendations.overall.verdict}`;
  try{
    if(navigator.share){ await navigator.share({title:'Photo Scout analysis',text}); return; }
  }catch(err){ if(err.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(text); alert('Analysis copied to clipboard.'); }
  catch{ const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download='photo-scout-analysis.txt';a.click();URL.revokeObjectURL(a.href); }
};

// v17 experimental eye/face detection note: browser-based, not true camera eye-AF.
async function runEyeDetectionPreview(){
  const box=$('#eyeDetectResult');
  if(!box||!capturedImageData) return;
  if(!('FaceDetector' in window)){
    box.innerHTML='<p class="muted small">Eye/face detection is not exposed by this browser. Native iOS/Android camera support is required for true eye-AF style behaviour.</p>';
    return;
  }
  try{
    const img=new Image(); img.src=capturedImageData; await img.decode();
    const detector=new FaceDetector({fastMode:true,maxDetectedFaces:5});
    const faces=await detector.detect(img);
    box.innerHTML=faces.length?`<p class="small"><strong>${faces.length}</strong> possible face/eye-priority area detected. For portraits, focus should normally be placed on the nearest eye.</p>`:'<p class="muted small">No obvious face/eye-priority area detected.</p>';
  }catch{
    box.innerHTML='<p class="muted small">Eye/face detection could not run in this browser.</p>';
  }
}

// Patch renderAnalysis to add an Eye Priority card after rendering.
const __oldRenderAnalysis=renderAnalysis;
renderAnalysis=function(){
  __oldRenderAnalysis();
  const content=$('#analysisView .content');
  if(content && !$('#eyeDetectResult')){
    const card=document.createElement('div');
    card.className='card';
    card.innerHTML=`<h3>${iconSVG('camera')} Eye / Face Priority</h3><div id="eyeDetectResult"><p class="muted small">Checking browser support…</p></div>`;
    content.insertBefore(card, content.children[3]||null);
    runEyeDetectionPreview();
  }
};

function startPhotoScoutOnce(){
  if(window.__photoScoutStarted) return;
  window.__photoScoutStarted=true;
  bindDynamicActions();
  init();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', startPhotoScoutOnce);
else startPhotoScoutOnce();


// v19: robust beta button repair for iPhone/Android/desktop browsers.
// Previous beta builds could lose dynamic button actions after the analysis panel was rebuilt.
// This patch binds actions directly after rendering AND through document-level pointer/click fallbacks.
function photoScoutRunAction(action,id,sourceEvent){
  if(!action) return false;
  try{
    if(action==='retake') { retake(); return true; }
    if(action==='shareCurrent') { shareCurrent(); return true; }
    if(action==='openSaveDialog') { openSaveDialog(); return true; }
    if(action==='showTutorial') { showTutorial(); return true; }
    if(action==='openFeedbackDialog') { openFeedbackDialog(id); return true; }
    if(action==='showPrivacyScreen') { showPrivacyScreen(); return true; }
    if(action==='applyGenreOverride') { applyGenreOverride(); return true; }
    if(action==='copyFeedback') { copyFeedback(); return true; }
    if(action==='downloadFeedback') { downloadFeedback(); return true; }
    if(action==='closeDetail') { const d=$('#detailDialog'); if(d&&d.close)d.close(); return true; }
    if(action==='showDetail') { showDetail(id); return true; }
    if(action==='deleteLocation') { deleteLocation(id,sourceEvent||new Event('click')); return true; }
    if(action==='downloadICS') { downloadICS(id); return true; }
    if(action==='downloadReport') { downloadReport(id); return true; }
    if(action==='shareLocation') { shareLocation(id); return true; }
  }catch(err){
    console.error('Photo Scout action failed:', action, err);
    alert('Sorry, that button did not complete. Please try again.');
    return true;
  }
  return false;
}
function photoScoutAttachActions(root=document){
  root.querySelectorAll('[data-action]').forEach(btn=>{
    if(btn.dataset.v19Bound==='1') return;
    btn.dataset.v19Bound='1';
    btn.type='button';
    btn.addEventListener('pointerup',e=>{
      if(btn.disabled) return;
      const action=btn.dataset.action;
      const id=btn.dataset.id?Number(btn.dataset.id):undefined;
      e.preventDefault(); e.stopPropagation();
      const now=Date.now();
      if(btn._lastAction && now-btn._lastAction<650) return;
      btn._lastAction=now;
      photoScoutRunAction(action,id,e);
    },{passive:false});
    btn.addEventListener('click',e=>{
      if(btn.disabled) return;
      const now=Date.now();
      if(btn._lastAction && now-btn._lastAction<650){ e.preventDefault(); e.stopPropagation(); return; }
      btn._lastAction=now;
      const action=btn.dataset.action;
      const id=btn.dataset.id?Number(btn.dataset.id):undefined;
      e.preventDefault(); e.stopPropagation();
      photoScoutRunAction(action,id,e);
    });
  });
}
// Fallback delegation in case a button is inserted after a direct bind pass.
if(!window.__photoScoutV19Delegated){
  window.__photoScoutV19Delegated=true;
  ['pointerup','click'].forEach(evtName=>document.addEventListener(evtName,e=>{
    const el=e.target.closest&&e.target.closest('[data-action]');
    if(!el) return;
    const now=Date.now();
    if(el._lastAction && now-el._lastAction<650){ e.preventDefault(); e.stopPropagation(); return; }
    el._lastAction=now;
    e.preventDefault(); e.stopPropagation();
    photoScoutRunAction(el.dataset.action,el.dataset.id?Number(el.dataset.id):undefined,e);
  },true));
}
// Re-wrap renderAnalysis once more so Retake / Feedback / Share / Save are always bound.
const __v19RenderAnalysis=renderAnalysis;
renderAnalysis=function(){
  __v19RenderAnalysis();
  setTimeout(()=>photoScoutAttachActions($('#analysisView')||document),0);
};
// Robust retake: return to live camera and restart stream if needed.
retake=function(){
  capturedImageData=null;
  currentRecommendations=null;
  const save=$('#saveDialog'); try{ if(save&&save.open) save.close(); }catch{}
  switchTab('scout');
  setTimeout(async()=>{
    const v=$('#videoElement');
    if(!videoStream){ await initCamera(); }
    else if(v){ try{ await v.play(); }catch{} }
  },120);
};
// Robust feedback: always open a dialog where possible, otherwise download a blank feedback file.
openFeedbackDialog=function(id){
  const i=id?PhotoScoutStorage.get().find(x=>x.id===id):null;
  const context=i?locationReportText(i):currentRecommendations?`Current analysis: ${currentRecommendations.genre.name}, confidence ${currentRecommendations.genre.confidence}`:'General app feedback';
  const html=`<h2>${iconSVG('tips')} Beta Feedback</h2><p class="muted">Record tester comments, bugs or incorrect genre detection. You can copy or download this feedback and send it back to Anthony/Cameracal Services.</p><label>What happened?<textarea id="feedbackText" rows="7" placeholder="Example: Save button did not respond; weather did not load; live view froze…"></textarea></label><div class="card"><h3>Attached context</h3><pre class="feedback-context">${escapeHTML(context)}</pre></div><div class="dialog-actions"><button class="btn btn-secondary" data-action="copyFeedback">Copy</button><button class="btn btn-secondary" data-action="downloadFeedback">Download</button><button class="btn btn-primary" data-action="closeDetail">Close</button></div>`;
  const d=$('#detailDialog'),c=$('#detailContent');
  if(c) c.innerHTML=html;
  photoScoutAttachActions(d||document);
  if(d&&d.showModal){try{d.showModal();return;}catch{}}
  alert('Feedback tool opened, but this browser has limited dialog support. A feedback file will be downloaded instead.');
  downloadFeedback();
};
// Robust save dialog and confirm/cancel handlers.
openSaveDialog=function(){
  if(!currentRecommendations||!capturedImageData){ alert('Please capture or import a photo first.'); return; }
  const dt=new Date(Date.now()+86400000);dt.setMinutes(0,0,0);
  if($('#returnDateTime')) $('#returnDateTime').value=dt.toISOString().slice(0,16);
  if($('#locationNotes')) $('#locationNotes').value='';
  const dlg=$('#saveDialog');
  if(dlg&&dlg.showModal){try{dlg.showModal();return;}catch{}}
  const name=prompt('Location name',`${currentRecommendations.genre.name} location`);
  if(name!==null){ if($('#locationName')) $('#locationName').value=name; saveLocation(); }
};
// Rebind static save buttons after DOM is ready.
function photoScoutBindStaticBetaButtons(){
  const confirm=$('#confirmSaveBtn');
  if(confirm&&!confirm.dataset.v19Save){
    confirm.dataset.v19Save='1'; confirm.type='button';
    confirm.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();saveLocation();},{passive:false});
    confirm.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();saveLocation();});
  }
  const cancel=$('#cancelSaveBtn');
  if(cancel&&!cancel.dataset.v19Cancel){
    cancel.dataset.v19Cancel='1'; cancel.type='button';
    cancel.addEventListener('click',e=>{e.preventDefault();try{$('#saveDialog')?.close()}catch{}});
  }
  const form=$('#saveDialog form');
  if(form&&!form.dataset.v19Submit){
    form.dataset.v19Submit='1';
    form.addEventListener('submit',e=>{e.preventDefault();saveLocation();});
  }
  photoScoutAttachActions(document);
}
// More forgiving share: works even when Web Share is blocked or cancelled.
shareCurrent=async function(){
  if(!currentRecommendations){ alert('Please analyse a photo first.'); return; }
  const text=`Photo Scout beta analysis\nGenre: ${currentRecommendations.genre.name}\nConfidence: ${currentRecommendations.genre.confidence}\nScore: ${currentRecommendations.overall.score}\n${currentRecommendations.overall.verdict}`;
  try{ if(navigator.share){ await navigator.share({title:'Photo Scout analysis',text}); return; } }catch(err){ if(err&&err.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(text); alert('Analysis copied to clipboard.'); }
  catch{ const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download='photo-scout-analysis.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
};
// v19 starter: bind after load and after small delays to catch GitHub/iOS cached DOM rebuilds.
(function(){
  const run=()=>{photoScoutBindStaticBetaButtons();setTimeout(photoScoutBindStaticBetaButtons,500);setTimeout(photoScoutBindStaticBetaButtons,1500);};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();

// v22 Advanced Beta: level guide, voice notes, favourites, tags, offline hints and composition guidance.
let v22LevelEnabled=false,v22LevelBound=false,v22VoiceBlob=null,v22VoiceURL=null,v22Recorder=null,v22VoiceChunks=[],v22LevelPermissionAsked=false;
function v22Stars(n){n=Number(n||3);return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(0,5-n)}
function v22TagsHTML(tags){return (tags||[]).map(t=>`<span class="tag-chip">${escapeHTML(t)}</span>`).join('')}
function v22ParseTags(v){return (v||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,8)}
function v22CompositionGuidanceHTML(r){
  const g=(r?.genre?.type||'landscape');
  const m=r?.metrics||{};
  const tips=[];
  if((m.brightRatio||0)>.10) tips.push('Bright areas may be clipping. Consider a darker exposure, bracketing, or returning when the sky is softer.');
  if((m.horizonStrength||0)>.16) tips.push('A strong horizon or scene layer has been detected. Try placing it on the upper or lower third rather than across the centre.');
  if(g==='architecture') tips.push('Use the level guide and keep vertical lines as straight as possible. A slightly wider frame will allow perspective correction later.');
  if(g==='landscape') tips.push('Look for foreground interest and use the rule-of-thirds grid to balance sky, middle ground and foreground.');
  if(g==='portrait') tips.push('Use the face/eye-priority card as a guide. For the final shoot, focus on the nearest eye and use soft light.');
  if(g==='macro') tips.push('Check background distractions around the subject edges and consider returning with a tripod or diffused flash.');
  if(g==='night'||g==='fireworks') tips.push('Mark a safe tripod position and note access/parking while scouting in daylight.');
  if(!tips.length) tips.push('Use this as a scouting aid: check subject placement, edge distractions, light direction and whether a return visit will improve the shot.');
  return `<ul class="composition-list">${tips.map(t=>`<li>${escapeHTML(t)}</li>`).join('')}</ul>`;
}
function v22ConditionMatchHTML(i){
  if(!i?.weather) return '<p class="muted small">No saved light/weather data to compare yet.</p>';
  const w=i.weather.today||{};
  let notes=[];
  if(w.eveningGolden) notes.push(`Saved evening golden hour: ${w.eveningGolden}`);
  if(w.morningGolden) notes.push(`Saved morning golden hour: ${w.morningGolden}`);
  if(w.moon) notes.push(`Saved moon phase: ${w.moon}`);
  if(currentWeather?.today?.condition && w.condition && currentWeather.today.condition===w.condition) notes.push('Current forecast condition broadly matches this saved scouting session.');
  return `<div class="condition-match card"><h3>${iconSVG('light')} Return Condition Match</h3><p class="muted small">Experimental planning aid. It compares saved light notes and, where current GPS/weather has been loaded, flags similar conditions.</p><ul class="composition-list">${notes.map(n=>`<li>${escapeHTML(n)}</li>`).join('')}</ul></div>`;
}
function v22OfflineReadyHTML(){return `<div class="offline-ready card"><h3>${iconSVG('settings')} Offline Scout Cache</h3><p class="muted small">This beta caches the core app files for field testing. Saved locations, notes and thumbnails are stored locally in this browser/device. Weather still needs a connection.</p></div>`}
async function v22ToggleLevel(){
  v22LevelEnabled=!v22LevelEnabled;
  const overlay=$('#levelOverlay'),btn=$('#levelBtn');
  if(overlay) overlay.hidden=!v22LevelEnabled;
  if(btn) btn.classList.toggle('active-tool',v22LevelEnabled);
  if(!v22LevelEnabled) return;
  try{
    if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function' && !v22LevelPermissionAsked){
      v22LevelPermissionAsked=true;
      await DeviceOrientationEvent.requestPermission();
    }
  }catch{}
  if(!v22LevelBound){
    window.addEventListener('deviceorientation',v22HandleOrientation,true);
    window.addEventListener('orientationchange',()=>setTimeout(()=>v22HandleOrientation({gamma:0,beta:0}),200));
    v22LevelBound=true;
  }
  showFocusToast('Level guide enabled');
}
function v22HandleOrientation(e){
  if(!v22LevelEnabled) return;
  let tilt=0;
  if(typeof e.gamma==='number') tilt=e.gamma;
  if(Math.abs(tilt)>45 && typeof e.beta==='number') tilt=e.beta;
  tilt=Math.max(-45,Math.min(45,tilt||0));
  const line=$('#levelLine'),read=$('#levelReadout');
  if(line) line.style.transform=`rotate(${-tilt}deg)`;
  if(read){read.textContent=`${tilt.toFixed(1)}°`;read.classList.toggle('ok',Math.abs(tilt)<1.5)}
}
async function v22ToggleVoiceNote(){
  const status=$('#voiceNoteStatus'),btn=$('#voiceNoteBtn'),clear=$('#clearVoiceNoteBtn');
  if(v22Recorder && v22Recorder.state==='recording'){
    v22Recorder.stop(); if(btn) btn.textContent='Record Voice Note'; return;
  }
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    const note=prompt('Voice recording is not supported here. Type a short scout note instead:');
    if(note){v22VoiceBlob=new Blob([note],{type:'text/plain'}); if(status)status.textContent='Text scout note added.'; if(clear)clear.hidden=false;}
    return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    v22VoiceChunks=[]; v22Recorder=new MediaRecorder(stream);
    v22Recorder.ondataavailable=e=>{if(e.data.size)v22VoiceChunks.push(e.data)};
    v22Recorder.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      v22VoiceBlob=new Blob(v22VoiceChunks,{type:v22Recorder.mimeType||'audio/webm'});
      if(v22VoiceURL) URL.revokeObjectURL(v22VoiceURL);
      v22VoiceURL=URL.createObjectURL(v22VoiceBlob);
      if(status)status.innerHTML=`Voice note recorded (${Math.round(v22VoiceBlob.size/1024)} KB).`;
      if(clear)clear.hidden=false;
    };
    v22Recorder.start(); if(btn)btn.textContent='Stop Recording'; if(status)status.textContent='Recording… tap Stop when finished.';
    setTimeout(()=>{try{if(v22Recorder?.state==='recording')v22Recorder.stop()}catch{}},30000);
  }catch{ if(status)status.textContent='Microphone permission was not granted.'; }
}
function v22ClearVoiceNote(){v22VoiceBlob=null;v22VoiceChunks=[];if(v22VoiceURL){URL.revokeObjectURL(v22VoiceURL);v22VoiceURL=null}if($('#voiceNoteStatus'))$('#voiceNoteStatus').textContent='No voice note recorded.';if($('#clearVoiceNoteBtn'))$('#clearVoiceNoteBtn').hidden=true;if($('#voiceNoteBtn'))$('#voiceNoteBtn').textContent='Record Voice Note'}
function v22BlobToDataURL(blob){return new Promise((res,rej)=>{if(!blob)return res(null);const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}
function v22BindStatic(){
  const level=$('#levelBtn'); if(level&&!level.dataset.v22){level.dataset.v22='1'; level.addEventListener('click',v22ToggleLevel)}
  const voice=$('#voiceNoteBtn'); if(voice&&!voice.dataset.v22){voice.dataset.v22='1'; voice.addEventListener('click',v22ToggleVoiceNote)}
  const clear=$('#clearVoiceNoteBtn'); if(clear&&!clear.dataset.v22){clear.dataset.v22='1'; clear.addEventListener('click',v22ClearVoiceNote)}
}
const __v22OpenSaveDialog=openSaveDialog;
openSaveDialog=function(){
  __v22OpenSaveDialog();
  if($('#locationTags')) $('#locationTags').value='';
  if($('#locationRating')) $('#locationRating').value='3';
  v22ClearVoiceNote();
  v22BindStatic();
};
const __v22SaveLocation=saveLocation;
saveLocation=async function(){
  const name=$('#locationName')?.value.trim()||`${currentRecommendations?.genre?.name||'Photo'} location`;
  const notes=$('#locationNotes')?$('#locationNotes').value.trim():'';
  const coords=currentPosition?{lat:currentPosition.coords.latitude,lng:currentPosition.coords.longitude,accuracy:currentPosition.coords.accuracy}:null;
  if(currentRecommendations) currentRecommendations.scoreBreakdown=getScoreBreakdown(currentRecommendations);
  const voiceData=await v22BlobToDataURL(v22VoiceBlob);
  const voiceType=v22VoiceBlob?.type||'';
  PhotoScoutStorage.add({id:Date.now(),name,notes,image:capturedImageData,recommendations:currentRecommendations,coords,weather:currentWeather,returnDateTime:$('#returnDateTime')?.value||'',date:new Date().toLocaleDateString(),tags:v22ParseTags($('#locationTags')?.value),rating:Number($('#locationRating')?.value||3),favorite:false,voiceNote:voiceData,voiceType});
  if($('#locationName'))$('#locationName').value=''; if($('#locationNotes'))$('#locationNotes').value=''; if($('#locationTags'))$('#locationTags').value='';
  v22ClearVoiceNote(); try{$('#saveDialog')?.close()}catch{}; updateCount(); switchTab('locations');
};
renderLocations=function(){
  const items=PhotoScoutStorage.get(); updateCount();
  if(!items.length){$('#locationsTab').innerHTML='<div class="empty-state"><h3>No saved locations yet</h3><p>Scout or upload a location to get started.</p></div>';return}
  $('#locationsTab').innerHTML=`<div class="location-grid">${items.map(i=>`<article class="location-card" data-action="showDetail" data-id="${i.id}"><button class="delete-btn" data-action="deleteLocation" data-id="${i.id}">×</button><img src="${i.image}" class="location-img"><div class="location-info"><h3>${i.favorite?'★ ':''}${i.recommendations?.genre?.icon||''} ${escapeHTML(i.name)}</h3><p class="muted small">${i.date}${i.coords?' · GPS saved':''}${i.weather?' · Light/weather saved':''}${i.voiceNote?' · Voice note':''}</p><div class="rating-stars">${v22Stars(i.rating)}</div><div>${v22TagsHTML(i.tags)}</div><div class="mini-chips"><span>Score ${i.recommendations?.overall?.score||'—'}</span>${i.weather?`<span>${i.weather.today.moon}</span>`:''}${i.returnDateTime?`<span>Return planned</span>`:''}</div></div></article>`).join('')}</div>`;
};
showDetail=function(id){
  const i=PhotoScoutStorage.get().find(x=>x.id===id); if(!i)return;
  const coords=i.coords?`<div class="detail-grid"><div><span>Latitude</span><strong>${i.coords.lat.toFixed(6)}</strong><small>Accuracy ${Math.round(i.coords.accuracy)}m</small></div><div><span>Longitude</span><strong>${i.coords.lng.toFixed(6)}</strong><small><a class="text-link" href="${mapURL(i.coords.lat,i.coords.lng)}" target="_blank" rel="noopener">Open Apple/Google Maps</a></small></div></div>`:'<p class="muted">No GPS coordinate saved.</p>';
  const notes=i.notes?`<div class="card"><h3>Notes</h3><p>${escapeHTML(i.notes)}</p></div>`:'';
  const voice=i.voiceNote?`<div class="card"><h3>${iconSVG('tips')} Voice Scout Note</h3>${i.voiceType&&i.voiceType.startsWith('text/')?`<p>${escapeHTML(atob(String(i.voiceNote).split(',')[1]||''))}</p>`:`<audio controls src="${i.voiceNote}" style="width:100%"></audio>`}</div>`:'';
  $('#detailContent').innerHTML=`<img src="${i.image}" style="width:100%;height:220px;object-fit:cover;border-radius:12px"><button class="fav-star ${i.favorite?'on':''}" data-action="toggleFavorite" data-id="${i.id}">${i.favorite?'★ Favourite':'☆ Favourite'}</button><h2>${i.recommendations?.genre?.icon||''} ${escapeHTML(i.name)}</h2><p class="muted">${i.date}</p><p class="rating-stars">${v22Stars(i.rating)}</p><div>${v22TagsHTML(i.tags)}</div><div class="card"><h3>${iconSVG('map')} Location</h3>${coords}</div><div class="card"><h3>${iconSVG('calendar')} Return Visit</h3><p><strong>${i.returnDateTime?new Date(i.returnDateTime).toLocaleString():'Not scheduled'}</strong></p></div><div class="card"><h3>Recommendation</h3><p>${i.recommendations?.overall?.verdict||''}</p><p><strong>Score:</strong> ${i.recommendations?.overall?.score||'—'}</p></div><div class="card"><h3>${iconSVG('histogram')} Composition Guidance</h3>${v22CompositionGuidanceHTML(i.recommendations)}</div><div class="card"><h3>${iconSVG('histogram')} Detection Explanation</h3>${detectionExplanationHTML(i.recommendations)}</div><div class="card"><h3>${iconSVG('settings')} Score Breakdown</h3>${scoreBreakdownHTML(i.recommendations)}</div>${v22ConditionMatchHTML(i)}<div class="card">${weatherHTML(i.weather)}</div>${notes}${voice}<div class="card"><h3>${iconSVG('settings')} Camera Settings</h3>${Object.entries(i.recommendations?.settings||{}).map(([k,v])=>`<div class="tip"><strong>${label(k)}:</strong><br>${v}</div>`).join('')}</div><div class="dialog-actions"><button class="btn btn-secondary" data-action="downloadICS" data-id="${i.id}">Calendar</button><button class="btn btn-secondary" data-action="downloadReport" data-id="${i.id}">Report</button><button class="btn btn-secondary" data-action="openFeedbackDialog" data-id="${i.id}">Feedback</button><button class="btn btn-secondary" data-action="shareLocation" data-id="${i.id}">Share</button><button class="btn btn-primary" data-action="closeDetail">Close</button></div>`;
  photoScoutAttachActions($('#detailDialog')||document); $('#detailDialog').showModal();
};
renderPlanner=function(){
  const items=PhotoScoutStorage.get(); const scheduled=items.filter(i=>i.returnDateTime).sort((a,b)=>new Date(a.returnDateTime)-new Date(b.returnDateTime));
  $('#plannerTab').innerHTML=`<div class="content"><div class="card"><h2>${iconSVG('calendar')} Return Visit Planner</h2><p class="muted">Choose a saved location, review weather/light notes and export a calendar file. v22 adds favourites, rating, tags, voice notes and experimental return-condition matching.</p></div>${v22OfflineReadyHTML()}${scheduled.length?scheduled.map(i=>`<div class="card planner-card"><div class="planner-row"><div><h3>${i.favorite?'★ ':''}${escapeHTML(i.name)}</h3><p class="muted">${new Date(i.returnDateTime).toLocaleString()}</p><p class="rating-stars">${v22Stars(i.rating)}</p><div>${v22TagsHTML(i.tags)}</div><p class="small">${i.weather?`Golden hour: ${i.weather.today.eveningGolden} · Moon: ${i.weather.today.moon}`:'No weather/light data saved'}</p></div><div class="planner-actions"><button class="btn btn-secondary" data-action="showDetail" data-id="${i.id}">Details</button><button class="btn btn-primary" data-action="downloadICS" data-id="${i.id}">Calendar</button></div></div></div>`).join(''):'<div class="empty-state"><h3>No return visits scheduled yet</h3><p>Save a scouted location with a return date.</p></div>'}${items.length?`<div class="card"><h3>All saved locations</h3>${items.map(i=>`<p><button class="text-button" data-action="showDetail" data-id="${i.id}">${i.favorite?'★ ':''}${escapeHTML(i.name)}</button> <span class="muted small">${i.coords?'GPS saved':'No GPS'} · ${i.weather?'Weather/light saved':'No weather'} · ${i.voiceNote?'Voice note':'No voice note'}</span></p>`).join('')}</div>`:''}</div>`;
  photoScoutAttachActions($('#plannerTab')||document);
};
const __v22RenderAnalysis=renderAnalysis;
renderAnalysis=function(){
  __v22RenderAnalysis();
  const content=$('#analysisView .content');
  if(content && !$('#v22CompositionCard')){
    const card=document.createElement('div'); card.className='card'; card.id='v22CompositionCard';
    card.innerHTML=`<h3>${iconSVG('histogram')} Composition Guidance</h3>${v22CompositionGuidanceHTML(currentRecommendations)}`;
    content.insertBefore(card,content.children[4]||null);
  }
  setTimeout(()=>photoScoutAttachActions($('#analysisView')||document),0);
};
function toggleFavorite(id){
  const items=PhotoScoutStorage.get(); const item=items.find(x=>x.id===id); if(!item)return;
  item.favorite=!item.favorite; PhotoScoutStorage.set(items); showDetail(id); updateCount();
}
const __v22Action=photoScoutRunAction;
photoScoutRunAction=function(action,id,sourceEvent){
  if(action==='toggleFavorite'){toggleFavorite(id);return true}
  return __v22Action(action,id,sourceEvent);
};
const __v22LocationReportText=locationReportText;
locationReportText=function(i){
  const base=__v22LocationReportText(i);
  return [base,``,`v22 extras:`,`Rating: ${v22Stars(i.rating)}`,`Tags: ${(i.tags||[]).join(', ')||'None'}`,`Favourite: ${i.favorite?'Yes':'No'}`,`Voice note: ${i.voiceNote?'Attached locally in saved location':'None'}`].join('\n');
};
function v22PatchHelp(){
  const old=renderHelp;
  renderHelp=function(){old(); const c=$('#helpTab .content'); if(c && !$('#v22HelpCard')){const card=document.createElement('div'); card.className='card help-section'; card.id='v22HelpCard'; card.innerHTML=`<h3>${iconSVG('tips')} v22 Advanced Beta</h3><p>New in v22: live level guide, composition guidance, favourites, ratings, tags, voice scout notes, offline cache information and experimental return-condition matching.</p>`; c.appendChild(card);}}
}
v22PatchHelp();
(function(){const run=()=>{v22BindStatic();try{renderHelp()}catch{};setTimeout(v22BindStatic,800)}; if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run); else run();})();

// v23: visual composition overlay, tighter local scene detection and more visible voice notes.
(function(){
  const V23='23';
  try{ if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=23').catch(()=>{}); }catch{}
  let v23CompositionEnabled=false;
  function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
  function v23Metrics(){return currentRecommendations?.metrics||{};}
  function v23BuildCompositionOverlay(){
    const overlay=$('#compositionOverlay'); if(!overlay) return;
    const r=currentRecommendations; const m=r?.metrics||{}; const g=r?.genre?.type||'general';
    const horizon=clamp((m.horizonY||0.5)*100,22,78);
    let subjectBox='';
    if(g==='portrait') subjectBox='<div class="comp-subject-box" style="left:28%;top:20%;width:44%;height:38%"></div>';
    else if(g==='macro') subjectBox='<div class="comp-subject-box" style="left:24%;top:26%;width:52%;height:42%"></div>';
    else if(g==='architecture') subjectBox='<div class="comp-subject-box" style="left:16%;top:16%;width:68%;height:66%"></div>';
    const note = g==='landscape' ? 'Composition guide: use thirds for sky/foreground balance; horizon marker shown where a strong scene edge was detected.'
      : g==='portrait' ? 'Composition guide: keep the face/eyes near an upper third and leave space in the looking direction.'
      : g==='macro' ? 'Composition guide: check the subject edges and background distractions before returning with a macro lens.'
      : g==='architecture' ? 'Composition guide: keep verticals straight and use the level tool for final alignment.'
      : 'Composition guide: check thirds, subject placement, clipped sky and distracting frame edges.';
    overlay.innerHTML=`<div class="comp-line h third1h"></div><div class="comp-line h third2h"></div><div class="comp-line v third1v"></div><div class="comp-line v third2v"></div>${(m.horizonStrength||0)>.12?`<div class="comp-horizon" style="top:${horizon}%"></div>`:''}${subjectBox}<div class="comp-note">${escapeHTML(note)}</div>`;
  }
  function v23ToggleComposition(){
    v23CompositionEnabled=!v23CompositionEnabled;
    const overlay=$('#compositionOverlay'); const btn=$('#compositionBtn');
    if(overlay){overlay.classList.toggle('active',v23CompositionEnabled); if(v23CompositionEnabled) v23BuildCompositionOverlay();}
    if(btn)btn.classList.toggle('comp-active',v23CompositionEnabled);
    try{showFocusToast(v23CompositionEnabled?'Composition guide enabled':'Composition guide hidden')}catch{}
  }
  function v23CompositionCardHTML(r){
    const m=r?.metrics||{}, g=r?.genre?.type||'general';
    const items=[];
    items.push('Use the live Composition button on the camera view for visual thirds, horizon and subject-placement guidance.');
    if((m.horizonStrength||0)>.12) items.push(`A likely horizon/scene layer was detected around ${Math.round((m.horizonY||0.5)*100)}% from the top of frame.`);
    if((m.brightRatio||0)>.10) items.push('There is a bright-area clipping risk, especially in sky or reflective highlights.');
    if(g==='macro') items.push('The scene appears close-up/detail led; check background distractions and subject edge separation.');
    if(g==='architecture') items.push('Use the level tool and leave extra space for perspective correction.');
    if(g==='landscape') items.push('Balance sky, middle ground and foreground, and look for a stronger foreground anchor if the frame feels empty.');
    return `<div class="card composition-panel"><h3>${iconSVG('histogram')} Visual Composition Guide</h3><ul class="composition-list">${items.map(i=>`<li>${escapeHTML(i)}</li>`).join('')}</ul></div>`;
  }
  // Tighten detection: avoid calling small close-up product/detail shots "architecture" simply due to edges.
  if(window.PhotoScoutAnalyser && !window.PhotoScoutAnalyser.__v23Tightened){
    window.PhotoScoutAnalyser.__v23Tightened=true;
    const oldDetect=window.PhotoScoutAnalyser.detectGenre.bind(window.PhotoScoutAnalyser);
    window.PhotoScoutAnalyser.detectGenre=function(m){
      const result=oldDetect(m);
      const lowOutdoor=(m.blueSkyRatio||0)<0.06 && (m.greenVegRatio||0)<0.08;
      const closeObject=(m.edgeDensity||0)>0.07 && (m.saturation||0)>0.18 && lowOutdoor && (m.regions?.centre?.sat||0)>0.18 && (m.brightness||0)>.18;
      const productLike=((m.warmRatio||0)>0.10 || (m.red||0)>(m.green||0)*1.08 || (m.saturation||0)>0.26) && lowOutdoor && (m.edgeDensity||0)>0.055;
      if((result.genre==='architecture'||result.genre==='street') && (closeObject||productLike)){
        result.genre='macro';
        result.confidence=result.confidence==='high'?'medium':'medium';
        result.subjects=[...new Set([...(result.subjects||[]),'close object/detail'])].slice(0,6);
        result.notes=[...new Set([...(result.notes||[]),'v23 correction: close-up object/detail cues reduced architecture score'])].slice(0,6);
        result.candidates=[{genre:'macro',score:5.35},...(result.candidates||[]).filter(c=>c.genre!=='macro')].slice(0,4);
      }
      return result;
    };
  }
  function v23Bind(){
    const btn=$('#compositionBtn'); if(btn&&!btn.dataset.v23){btn.dataset.v23='1';btn.addEventListener('click',v23ToggleComposition)}
  }
  const oldRender=renderAnalysis;
  renderAnalysis=function(){
    oldRender();
    const content=$('#analysisView .content');
    if(content && !$('#v23CompositionVisualCard')){
      const wrap=document.createElement('div'); wrap.id='v23CompositionVisualCard'; wrap.innerHTML=v23CompositionCardHTML(currentRecommendations);
      content.insertBefore(wrap.firstElementChild, content.children[4]||null);
    }
    if(content && !$('#v23VoiceCallout')){
      const card=document.createElement('div');card.className='card voice-note-callout';card.id='v23VoiceCallout';
      card.innerHTML=`<h3>${iconSVG('tips')} Voice Scout Note</h3><p class="muted small">Voice notes are included in the Save Location window. Tap Save, then Record Voice Note before confirming the location.</p><button class="btn btn-secondary" data-action="openSaveDialog">Save with Voice Note</button>`;
      content.appendChild(card);
      try{photoScoutAttachActions(card)}catch{}
    }
    if(v23CompositionEnabled) v23BuildCompositionOverlay();
    setTimeout(()=>{try{photoScoutAttachActions($('#analysisView')||document)}catch{}},0);
  };
  // Replace v22 openSaveDialog so pre-existing voice state is not immediately cleared every time and the voice panel is obvious.
  openSaveDialog=function(){
    if(!currentRecommendations||!capturedImageData){ alert('Please capture or import a photo first.'); return; }
    const dt=new Date(Date.now()+86400000);dt.setMinutes(0,0,0);
    if($('#returnDateTime')) $('#returnDateTime').value=dt.toISOString().slice(0,16);
    if($('#locationNotes')) $('#locationNotes').value='';
    if($('#locationTags')) $('#locationTags').value='';
    if($('#locationRating')) $('#locationRating').value='3';
    if($('#voiceNoteStatus')) $('#voiceNoteStatus').innerHTML='<strong>Optional:</strong> tap Record Voice Note before pressing Save.';
    try{v22BindStatic()}catch{}
    const dlg=$('#saveDialog');
    if(dlg&&dlg.showModal){try{dlg.showModal();return;}catch{}}
    const name=prompt('Location name',`${currentRecommendations.genre.name} location`);
    if(name!==null){ if($('#locationName')) $('#locationName').value=name; saveLocation(); }
  };
  // Add a small visual marker near the save dialog voice area after load.
  function v23EnhanceVoicePanel(){
    const box=document.querySelector('.voice-note-box');
    if(box&&!box.dataset.v23){box.dataset.v23='1';box.insertAdjacentHTML('afterbegin','<div class="voice-note-inline-status"><strong>Visible in v23:</strong> record a quick spoken location note here before saving.</div>')}
  }
  const run=()=>{v23Bind();v23EnhanceVoicePanel();setTimeout(v23Bind,800);setTimeout(v23EnhanceVoicePanel,800)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run); else run();
})();

// v24: professional SVG genre icons for Scene Analysis + Manual Override.
(function(){
  const V24='24';
  try{ if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=24').catch(()=>{}); }catch{}
  const genreSvgs={
    landscape:'<svg viewBox="0 0 24 24"><path d="M3 17.5 8.4 11l4.1 4.7 2.4-2.8L21 17.5"/><path d="M3 19.5h18"/><circle cx="17.5" cy="6.5" r="2.1"/></svg>',
    wildlife:'<svg viewBox="0 0 24 24"><path d="M4 15c2.8-4.4 6.2-6.1 10.2-5.1l2.5-2.6.5 3.4 3.1 1.5-3.3 1.2c-.7 3.6-3 5.6-6.9 6.1"/><path d="M8 13.5c1.9.2 3.2 1 4.1 2.5"/><path d="M10.8 9.8c.7 1.6.7 3.2.1 4.9"/></svg>',
    night:'<svg viewBox="0 0 24 24"><path d="M17.8 15.7A7.4 7.4 0 0 1 8.3 6.2 7.5 7.5 0 1 0 17.8 15.7Z"/><path d="M16.8 3.5v3M15.3 5h3M20 8.5v2.4M18.8 9.7h2.4"/></svg>',
    fireworks:'<svg viewBox="0 0 24 24"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5"/><circle cx="12" cy="12" r="1.8"/></svg>',
    portrait:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"/><path d="M5.6 20c.8-4.2 3-6.3 6.4-6.3s5.6 2.1 6.4 6.3"/><path d="M9.8 8h.01M14.2 8h.01"/></svg>',
    macro:'<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.6"/><circle cx="15" cy="15" r="4.1"/><path d="M6.4 11.6 3.5 14.5M11.8 6.2 14.5 3.5M12.2 17.8 9.5 20.5M17.8 12.2 20.5 9.5"/></svg>',
    street:'<svg viewBox="0 0 24 24"><path d="M5 20 9 4h6l4 16"/><path d="M8 12h8M7 16h10M10 4v16M14 4v16"/><path d="M3 20h18"/></svg>',
    architecture:'<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M6 20V8l6-4 6 4v12"/><path d="M9 20v-6h6v6M9 10h.01M12 10h.01M15 10h.01"/></svg>'
  };
  window.genreIconSVG=function(key,labelText=''){
    const k=(key||'landscape').toLowerCase();
    return `<span class="genre-icon-pro genre-${k}" aria-hidden="true">${genreSvgs[k]||genreSvgs.landscape}</span>${labelText?`<span>${escapeHTML(labelText)}</span>`:''}`;
  };
  function genreTitleHTML(r){return `<div class="genre-title-row">${genreIconSVG(r.genre.type)}<div><h2>${escapeHTML(r.genre.name)}</h2><p>Confidence: ${escapeHTML(String(r.genre.confidence))}</p></div></div>`}
  function v24GenreOverrideHTML(r){
    const buttons=Object.entries(window.PHOTO_SCOUT_RECOMMENDATIONS).map(([k,v])=>`<button class="genre-chip ${r.genre.type===k?'active':''}" data-action="genreQuickOverride" data-genre="${k}">${genreIconSVG(k)}<span>${escapeHTML(v.name)}</span></button>`).join('');
    const opts=Object.entries(window.PHOTO_SCOUT_RECOMMENDATIONS).map(([k,v])=>`<option value="${k}" ${r.genre.type===k?'selected':''}>${v.name}</option>`).join('');
    return `<div class="override-row"><div><strong>Manual override</strong><div class="genre-override-grid">${buttons}</div><label class="genre-select-fallback"><span class="muted small">Fallback list</span><select id="genreOverrideSelect">${opts}</select></label></div><button class="btn btn-secondary" data-action="applyGenreOverride">Apply selected genre</button></div><p class="muted small">Use this if Photo Scout gets the genre wrong during beta testing. The updated V25 layout uses smaller professional icons, tighter spacing and a clearer selected state.</p>`;
  }
  window.applyGenreOverride=function(key){
    const sel=$('#genreOverrideSelect'); if(!currentRecommendations)return;
    key=key || (sel&&sel.value); const data=window.PHOTO_SCOUT_RECOMMENDATIONS[key]; if(!data)return;
    const from=currentRecommendations.genre?.name||'previous result';
    currentRecommendations={...currentRecommendations,genre:{type:key,name:data.name,icon:'',confidence:'manual override'},settings:data.settings,tips:data.tips,overall:{...currentRecommendations.overall,verdict:`Manual override selected: ${data.name}. Recommendations have been updated for this genre.`},analysisNotes:[`manual override selected from ${from} to ${data.name}`,...(currentRecommendations.analysisNotes||[])]};
    renderAnalysis();
  };
  const priorAction=photoScoutRunAction;
  photoScoutRunAction=function(action,id,sourceEvent){
    if(action==='genreQuickOverride'){
      const key=sourceEvent?.target?.closest?.('[data-genre]')?.dataset?.genre;
      applyGenreOverride(key); return true;
    }
    return priorAction(action,id,sourceEvent);
  };
  function v24DetectionExplanationHTML(r){
    const subjects=(r.subjects||[]).map(x=>`<span>${escapeHTML(x)}</span>`).join('');
    const notes=(r.analysisNotes||[]).map(x=>`<li>${escapeHTML(x)}</li>`).join('')||'<li>No very strong visual cue detected; treat this as a beta suggestion.</li>';
    const candidates=(r.candidates||[]).map(c=>`<span class="alt-pill">${genreIconSVG(c.genre)} ${label(c.genre)} ${c.score}</span>`).join('');
    return `<p class="muted">Detected as <strong>${escapeHTML(r.genre.name)}</strong> because of the visible image cues below. This is local browser analysis only; no image upload is used in this build.</p><div class="mini-chips">${subjects}</div><ul class="reason-list">${notes}</ul><p class="muted small" style="margin-bottom:6px">Alternative matches</p><div class="alt-match-pills">${candidates||'<span class="alt-pill">none</span>'}</div>`;
  }
  const oldRender=renderAnalysis;
  renderAnalysis=function(){
    const r=currentRecommendations; if(!r){return oldRender();}
    r.scoreBreakdown=getScoreBreakdown(r);
    const settings=Object.entries(r.settings||{}).map(([k,v])=>`<div class="tip"><strong>${label(k)}:</strong><br>${v}</div>`).join('');
    const tips=(r.tips||[]).map(t=>`<div class="tip">• ${t}</div>`).join('');
    switchPanelToAnalysis(`<img src="${capturedImageData}" class="captured-img" style="height:260px"><div class="content"><div class="card hero-card">${genreTitleHTML(r)}</div><div class="card"><div class="planner-row"><div><h3>Location Assessment</h3><p class="muted">${r.overall.verdict}</p></div><div class="score">${r.overall.score}</div></div></div><div class="card"><h3>${iconSVG('histogram')} Why this was detected</h3>${v24DetectionExplanationHTML(r)}${v24GenreOverrideHTML(r)}</div><div class="card"><h3>${iconSVG('settings')} Score Breakdown</h3>${scoreBreakdownHTML(r)}<p class="muted small">Scores are planning aids only. They are designed to help decide whether a location is worth returning to with a main camera.</p></div><div class="card"><h3>Location / GPS</h3>${locationHTML()}</div><div class="card">${weatherHTML(currentWeather)}</div><div class="card"><h3>${iconSVG('light')} Lighting</h3><p><strong>${r.lighting.challenge}</strong></p><p class="muted">${r.lighting.advice}</p></div><div class="card"><h3>${iconSVG('settings')} Suggested Camera Settings</h3>${settings}</div><div class="card"><h3>${iconSVG('tips')} Pro Tips</h3>${tips}</div></div><div class="controls"><button class="btn btn-secondary" data-action="retake">Retake</button><button class="btn btn-secondary" data-action="openFeedbackDialog">Feedback</button><button class="btn btn-secondary" data-action="shareCurrent">Share</button><button class="btn btn-primary" data-action="openSaveDialog">Save</button></div>`);
    const content=$('#analysisView .content');
    if(content && typeof v22CompositionGuidanceHTML==='function' && !$('#v22CompositionCard')){const card=document.createElement('div');card.className='card';card.id='v22CompositionCard';card.innerHTML=`<h3>${iconSVG('histogram')} Composition Guidance</h3>${v22CompositionGuidanceHTML(currentRecommendations)}`;content.insertBefore(card,content.children[4]||null)}
    if(content && typeof v23CompositionCardHTML==='function' && !$('#v23CompositionVisualCard')){}
    setTimeout(()=>{try{photoScoutAttachActions($('#analysisView')||document)}catch{}},0);
  };
  const oldRenderLocations=renderLocations;
  renderLocations=function(){
    const items=PhotoScoutStorage.get(); updateCount();
    if(!items.length){$('#locationsTab').innerHTML='<div class="empty-state"><h3>No saved locations yet</h3><p>Scout or upload a location to get started.</p></div>';return}
    $('#locationsTab').innerHTML=`<div class="location-grid">${items.map(i=>`<article class="location-card" data-action="showDetail" data-id="${i.id}"><button class="delete-btn" data-action="deleteLocation" data-id="${i.id}">×</button><img src="${i.image}" class="location-img"><div class="location-info"><h3 class="saved-title-row">${i.favorite?'★ ':''}${genreIconSVG(i.recommendations?.genre?.type||'landscape')} <span>${escapeHTML(i.name)}</span></h3><p class="muted small">${i.date}${i.coords?' · GPS saved':''}${i.weather?' · Light/weather saved':''}${i.voiceNote?' · Voice note':''}</p><div class="rating-stars">${typeof v22Stars==='function'?v22Stars(i.rating):''}</div><div>${typeof v22TagsHTML==='function'?v22TagsHTML(i.tags):''}</div><div class="mini-chips"><span>Score ${i.recommendations?.overall?.score||'—'}</span>${i.weather?`<span>${i.weather.today.moon}</span>`:''}${i.returnDateTime?`<span>Return planned</span>`:''}</div></div></article>`).join('')}</div>`;
    setTimeout(()=>{try{photoScoutAttachActions($('#locationsTab')||document)}catch{}},0);
  };
  const oldShowDetail=showDetail;
  showDetail=function(id){
    oldShowDetail(id);
    const i=PhotoScoutStorage.get().find(x=>x.id===id); if(!i)return;
    const h=$('#detailContent h2'); if(h && !h.dataset.v24){h.dataset.v24='1'; h.classList.add('detail-genre-heading'); h.innerHTML=`${genreIconSVG(i.recommendations?.genre?.type||'landscape')} <span>${escapeHTML(i.name)}</span>`;}
  };
  function patchHelp(){
    try{renderHelp(); const c=$('#helpTab .content'); if(c&&!$('#v24HelpCard')){const card=document.createElement('div');card.className='card help-section';card.id='v24HelpCard';card.innerHTML=`<h3>${iconSVG('settings')} v25 UI Polish</h3><p>The Scene Analysis and Manual Override area now uses smaller professional SVG icons, tighter spacing, refined selection styling, clearer alternative-match pills and a stronger Apply button.</p>`;c.appendChild(card)}}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(patchHelp,400)); else setTimeout(patchHelp,400);
})();

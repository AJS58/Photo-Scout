const APP_VERSION='30.0.0';
const CACHE='photo-scout-v31-expanded-locations-weather';
const CORE_ASSETS=[
  './', './index.html', './index.html?v=30', './css/styles.css?v=30', './js/app.js?v=30', './js/analyser.js?v=30', './js/storage.js?v=30',
  './data/recommendations.js?v=30', './manifest.json?v=30', './version.json', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png', './assets/icons/favicon-32.png', './assets/splash/photo-scout-splash.png'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE_ASSETS.map(url=>new Request(url,{cache:'reload'}))).catch(()=>{})));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE && key.startsWith('photo-scout-')).map(key=>caches.delete(key)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window'});
    clients.forEach(client=>client.postMessage({type:'PHOTO_SCOUT_SW_READY',version:APP_VERSION}));
  })());
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING') self.skipWaiting();
  if(event.data&&event.data.type==='CLEAR_PHOTO_SCOUT_CACHES'){
    event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('photo-scout-')).map(k=>caches.delete(k)))));
  }
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  const isFreshAsset=request.mode==='navigate'||/\/(version\.json|manifest\.json|sw\.js)$/.test(url.pathname)||/\/(js|css|data)\//.test(url.pathname);
  if(isFreshAsset){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}); return response;
    }).catch(()=>caches.match(request).then(cached=>cached||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}); return response;
  })));
});

const CACHE='photo-scout-v12-grid-focus';
const ASSETS=[
  './','./index.html','./css/styles.css','./js/app.js','./js/analyser.js','./js/storage.js',
  './data/recommendations.js','./manifest.json','./assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png','./assets/icons/favicon-32.png','./assets/splash/photo-scout-splash.png'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin){
    event.respondWith(fetch(request));
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(request,copy));
    return response;
  }).catch(()=>cached)));
});

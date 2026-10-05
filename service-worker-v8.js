const CACHE='saleroom-render-v8';
const CORE=['./','./index.html','./manifest.json','./icon.svg','./saleroom-v6.css?v=6.0','./saleroom-v7.css?v=7.1','./saleroom-v8.css?v=8.0','./sr6-ui.js?v=6.0','./sr7-media.js?v=8.0','./sr8-upload.js?v=8.0','./sr8-data.js?v=8.0','./sr3-rooms.js?v=7.1','./sr5-realtime.js?v=7.0','./sr5-backup.js?v=7.0'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;})
    .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
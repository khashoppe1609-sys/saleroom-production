const CACHE='saleroom-render-v5';
const CORE=['./','./index.html','./manifest.json','./icon.svg','./saleroom-v5.css?v=5.1','./sr5-realtime.js?v=5.1','./sr5-edit.js?v=5.1','./sr5-excel.js?v=5.1','./sr5-backup.js?v=5.1','./sr5-media.js?v=5.1','./sr5-dashboard.js?v=5.1'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;})
    .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
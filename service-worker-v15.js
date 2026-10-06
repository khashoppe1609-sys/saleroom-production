const CACHE='saleroom-final-v15';
const CORE=[
  './','./index.html','./manifest.json','./icon.svg',
  './saleroom-orange.css?v=2','./saleroom-v3.css?v=5','./saleroom-v5.css?v=5.1',
  './saleroom-v6.css?v=10.0','./saleroom-v7.css?v=7.1','./saleroom-v8.css?v=8.0',
  './saleroom-v13-final.css?v=15.0',
  './sr3-core.js?v=5','./sr3-rooms.js?v=15.0','./sr3-customers.js?v=3','./sr3-public.js?v=13.0','./sr3-home.js?v=3',
  './sr5-realtime.js?v=7.0','./sr5-edit.js?v=13.0','./sr5-excel.js?v=13.0','./sr5-backup.js?v=7.0',
  './sr5-media.js?v=5.1','./sr5-dashboard.js?v=5.1','./sr6-ui.js?v=10.0','./sr7-media.js?v=8.0',
  './sr8-upload.js?v=15.0','./sr8-data.js?v=14.0','./sr13-final.js?v=14.0'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const shell=url.pathname==='/'||url.pathname.endsWith('/index.html');
  if(shell){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request)));
});
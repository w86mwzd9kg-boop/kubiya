// sw.js — Service Worker с авто-обновлением для GitHub Pages
var CACHE_NAME='kubiya-cache-v1';

self.addEventListener('install',function(e){
  self.skipWaiting();
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k!==CACHE_NAME)return caches.delete(k);
      }));
    }).then(function(){return self.clients.claim();})
  );
});

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  // Не трогаем запросы на другие домены
  if(url.origin!==location.origin)return;

  // Network-first для HTML (чтобы всегда получать свежую версию игры)
  var accept=req.headers.get('accept')||'';
  if(accept.indexOf('text/html')>=0||url.pathname.endsWith('/')||url.pathname.endsWith('index.html')){
    e.respondWith(
      fetch(req,{cache:'no-store'}).then(function(res){
        var copy=res.clone();
        caches.open(CACHE_NAME).then(function(c){c.put(req,copy);});
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){return r||caches.match('./index.html');});
      })
    );
    return;
  }

  // Cache-first для остального (иконки, manifest)
  e.respondWith(
    caches.match(req).then(function(cached){
      return cached||fetch(req).then(function(res){
        var copy=res.clone();
        caches.open(CACHE_NAME).then(function(c){c.put(req,copy);});
        return res;
      });
    })
  );
});

self.addEventListener('message',function(e){
  if(e.data==='skipWaiting')self.skipWaiting();
});

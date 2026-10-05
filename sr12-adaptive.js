/* SaleRoom v12 adaptive device layout + guaranteed media preview */
window.SR12=window.SR12||{};
(() => {
  const A=window.SR12;
  A.urls=[];
  A.videoUrl=null;

  A.clearUrls=()=>{
    for(const u of A.urls)try{URL.revokeObjectURL(u)}catch{}
    A.urls=[];
    if(A.videoUrl){try{URL.revokeObjectURL(A.videoUrl)}catch{};A.videoUrl=null}
  };

  A.mode=()=>{
    const w=Math.round(window.visualViewport?.width||document.documentElement.clientWidth||window.innerWidth||390);
    if(w<=767)return 'mobile';
    if(w<=1023)return 'tablet';
    return 'desktop';
  };

  A.applyMode=()=>{
    const m=A.mode();
    document.documentElement.dataset.srDevice=m;
    document.body?.classList.remove('sr-mobile','sr-tablet','sr-desktop');
    document.body?.classList.add('sr-'+m);
    document.body?.setAttribute('data-device',m);
  };

  A.ensurePreviewHost=()=>{
    let host=document.getElementById('r-media-preview');
    if(host)return host;
    const input=document.getElementById('r-images');
    const grid=input?.closest('.create-media-grid');
    if(!grid)return null;
    host=document.createElement('div');
    host.id='r-media-preview';
    host.className='create-media-preview';
    host.hidden=true;
    grid.insertAdjacentElement('afterend',host);
    return host;
  };

  A.renderPreview=()=>{
    const host=A.ensurePreviewHost();if(!host)return;
    const hasImages=A.urls.length>0,hasVideo=!!A.videoUrl;
    host.hidden=!(hasImages||hasVideo);
    if(host.hidden){host.innerHTML='';return}

    let images='';
    if(hasImages){
      images='<div class="sr12-preview-images">';
      A.urls.forEach((u,i)=>{
        images+='<figure class="sr12-preview-item '+(i===0?'cover':'')+'"><img src="'+u+'" alt="Ảnh phòng '+(i+1)+'"><figcaption>'+(i===0?'★ Ảnh đại diện':'Ảnh '+(i+1))+'</figcaption></figure>';
      });
      images+='</div>';
    }

    let video='';
    if(hasVideo){
      video='<div class="sr12-video-preview"><div class="sr12-preview-label">🎬 Video phòng · hiển thị sau ảnh</div><video src="'+A.videoUrl+'" muted controls playsinline preload="metadata"></video></div>';
    }

    host.innerHTML='<div class="sr12-preview-head"><b>Ảnh/video đã chọn</b><span>'+A.urls.length+' ảnh'+(hasVideo?' · 1 video':'')+'</span></div>'+images+video;
    requestAnimationFrame(()=>host.scrollIntoView({block:'nearest',behavior:'smooth'}));
  };

  A.previewImages=files=>{
    for(const u of A.urls)try{URL.revokeObjectURL(u)}catch{}
    A.urls=[];
    const list=[...(files||[])].filter(f=>f.type?.startsWith('image/'));
    A.urls=list.map(f=>URL.createObjectURL(f));
    const count=document.getElementById('r-images-count');
    if(count)count.textContent=list.length?list.length+' ảnh đã chọn':'Chưa chọn ảnh';
    A.renderPreview();
  };

  A.previewVideo=file=>{
    if(A.videoUrl){try{URL.revokeObjectURL(A.videoUrl)}catch{};A.videoUrl=null}
    if(file?.type?.startsWith('video/'))A.videoUrl=URL.createObjectURL(file);
    const count=document.getElementById('r-video-count');
    if(count)count.textContent=A.videoUrl?'1 video đã chọn':'Chưa chọn video';
    A.renderPreview();
  };

  document.addEventListener('change',e=>{
    if(e.target?.id==='r-images')A.previewImages(e.target.files);
    if(e.target?.id==='r-video')A.previewVideo(e.target.files?.[0]);
  },true);

  const bodyObserver=new MutationObserver(()=>{
    A.applyMode();
    const img=document.getElementById('r-images');
    if(img?.files?.length && !A.urls.length)A.previewImages(img.files);
    const vid=document.getElementById('r-video');
    if(vid?.files?.length && !A.videoUrl)A.previewVideo(vid.files[0]);
    if(!document.getElementById('sheet-overlay') && (A.urls.length||A.videoUrl))A.clearUrls();
  });
  bodyObserver.observe(document.documentElement,{childList:true,subtree:true});

  let t=0;
  const schedule=()=>{clearTimeout(t);t=setTimeout(A.applyMode,80)};
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule);
  A.applyMode();
})();
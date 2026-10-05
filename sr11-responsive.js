/* SaleRoom v11 responsive device mode + instant media preview */
window.SR11=window.SR11||{};
(() => {
  const R=window.SR11;
  R.imageUrls=[];
  R.videoUrl=null;

  R.revokeImages=()=>{
    for(const u of R.imageUrls) try{URL.revokeObjectURL(u)}catch{}
    R.imageUrls=[];
  };
  R.revokeVideo=()=>{
    if(R.videoUrl){try{URL.revokeObjectURL(R.videoUrl)}catch{}}
    R.videoUrl=null;
  };

  R.renderRoomPreview=()=>{
    const host=document.getElementById('r-media-preview');
    if(!host)return;
    const hasImages=R.imageUrls.length>0,hasVideo=!!R.videoUrl;
    host.hidden=!(hasImages||hasVideo);
    if(host.hidden){host.innerHTML='';return}

    const images=R.imageUrls.map((url,i)=>
      '<div class="selected-media-card selected-image">'+
        '<div class="selected-media-thumb"><img src="'+url+'" alt="Ảnh phòng đã chọn">'+
          (i===0?'<span class="selected-cover-badge">★ ẢNH ĐẠI DIỆN</span>':'<span class="selected-order-badge">#'+(i+1)+'</span>')+
        '</div>'+
      '</div>'
    ).join('');

    const video=hasVideo
      ? '<div class="selected-media-card selected-video"><video src="'+R.videoUrl+'" controls muted playsinline preload="metadata"></video><span>🎬 Video phòng · sẽ hiển thị sau ảnh</span></div>'
      : '';

    host.innerHTML=
      '<div class="selected-preview-head"><b>Xem trước media</b><span>'+R.imageUrls.length+' ảnh'+(hasVideo?' · 1 video':'')+'</span></div>'+
      (hasImages?'<div class="selected-image-grid">'+images+'</div>':'')+
      video;
  };

  R.previewRoomImages=files=>{
    R.revokeImages();
    const list=[...(files||[])].filter(f=>f.type?.startsWith('image/'));
    R.imageUrls=list.map(f=>URL.createObjectURL(f));
    const count=document.getElementById('r-images-count');
    if(count)count.textContent=list.length?list.length+' ảnh đã chọn':'Chưa chọn ảnh';
    R.renderRoomPreview();
  };

  R.previewRoomVideo=file=>{
    R.revokeVideo();
    if(file?.type?.startsWith('video/'))R.videoUrl=URL.createObjectURL(file);
    const count=document.getElementById('r-video-count');
    if(count)count.textContent=R.videoUrl?'1 video đã chọn':'Chưa chọn video';
    R.renderRoomPreview();
  };


  R.pendingUrls=[];
  R.clearPending=()=>{
    for(const u of R.pendingUrls)try{URL.revokeObjectURL(u)}catch{}
    R.pendingUrls=[];
  };

  R.previewExistingMedia=(files,host,kind='image')=>{
    R.clearPending();
    const list=[...(files||[])].filter(f=>kind==='video'?f.type?.startsWith('video/'):f.type?.startsWith('image/'));
    if(!host||!list.length)return;
    R.pendingUrls=list.slice(0,6).map(f=>URL.createObjectURL(f));
    let box=host.querySelector('.pending-upload-preview');
    if(!box){box=document.createElement('div');box.className='pending-upload-preview';host.appendChild(box)}
    if(kind==='video'){
      box.innerHTML='<b>Đang chuẩn bị upload</b><video src="'+R.pendingUrls[0]+'" muted playsinline controls></video>';
    }else{
      box.innerHTML='<b>Đang chuẩn bị upload '+list.length+' ảnh</b><div class="pending-upload-grid">'+R.pendingUrls.map((u,i)=>'<div><img src="'+u+'" alt="Ảnh đang chọn">'+(i===0?'<span>★ Đại diện</span>':'')+'</div>').join('')+'</div>';
    }
  };

  R.deviceMode=()=>{
    const width=Math.round(window.visualViewport?.width||window.innerWidth||390);
    const coarse=window.matchMedia?.('(pointer: coarse)')?.matches===true;
    if(width<=767||(coarse&&width<=1024))return 'mobile';
    if(!coarse&&width>=900)return 'desktop';
    if(width<1100)return 'tablet';
    return 'desktop';
  };

  R.applyDeviceMode=()=>{
    const mode=R.deviceMode();
    document.body.classList.remove('sr-mobile','sr-tablet','sr-desktop');
    document.body.classList.add('sr-'+mode);
    document.body.dataset.device=mode;
    document.documentElement.dataset.device=mode;
  };

  let timer=0;
  R.scheduleDeviceMode=()=>{
    clearTimeout(timer);
    timer=setTimeout(R.applyDeviceMode,80);
  };

  window.addEventListener('resize',R.scheduleDeviceMode,{passive:true});
  window.addEventListener('orientationchange',R.scheduleDeviceMode,{passive:true});
  window.visualViewport?.addEventListener('resize',R.scheduleDeviceMode);

  new MutationObserver(()=>{
    if(!document.getElementById('r-media-preview')&&R.imageUrls.length){
      R.revokeImages();R.revokeVideo();
    }
  }).observe(document.body,{childList:true,subtree:true});

  R.applyDeviceMode();
})();
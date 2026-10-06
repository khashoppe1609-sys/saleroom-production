/* SaleRoom v13 FINAL — one responsive runtime */
window.SR13=window.SR13||{};
(() => {
  const F=window.SR13;
  F.imageUrls=[];
  F.videoUrl=null;
  F.pendingUrls=[];

  F.revoke=(u)=>{try{URL.revokeObjectURL(u)}catch{}};
  F.clearPreview=()=>{
    F.imageUrls.forEach(F.revoke);F.imageUrls=[];
    if(F.videoUrl)F.revoke(F.videoUrl);F.videoUrl=null;
  };
  F.clearPending=()=>{F.pendingUrls.forEach(F.revoke);F.pendingUrls=[]};

  F.mode=()=>{
    const w=Math.round(window.visualViewport?.width||document.documentElement.clientWidth||window.innerWidth||390);
    if(w<=767)return 'mobile';
    if(w<=1023)return 'tablet';
    return 'desktop';
  };

  F.applyMode=()=>{
    if(!document.body)return;
    const mode=F.mode();
    document.documentElement.dataset.device=mode;
    document.body.dataset.device=mode;
    document.body.classList.remove('sr-mobile','sr-tablet','sr-desktop');
    document.body.classList.add('sr-'+mode);
  };

  F.ensureCreatePreview=()=>{
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

  F.renderCreatePreview=()=>{
    const host=F.ensureCreatePreview();if(!host)return;
    const hasImages=F.imageUrls.length>0,hasVideo=!!F.videoUrl;
    host.hidden=!(hasImages||hasVideo);
    if(host.hidden){host.innerHTML='';return}

    const images=hasImages
      ? '<div class="sr13-preview-grid">'+F.imageUrls.map((u,i)=>
          '<figure class="sr13-preview-card '+(i===0?'cover':'')+'">'+
            '<img src="'+u+'" alt="Ảnh phòng '+(i+1)+'">'+
            '<figcaption>'+(i===0?'★ Ảnh đại diện':'Ảnh '+(i+1))+'</figcaption>'+
          '</figure>'
        ).join('')+'</div>'
      : '';

    const video=hasVideo
      ? '<div class="sr13-preview-video"><div>🎬 Video phòng · nằm sau ảnh</div><video src="'+F.videoUrl+'" controls muted playsinline preload="metadata"></video></div>'
      : '';

    host.innerHTML='<div class="sr13-preview-head"><b>Xem trước ảnh/video</b><span>'+F.imageUrls.length+' ảnh'+(hasVideo?' · 1 video':'')+'</span></div>'+images+video;
  };

  F.previewImages=files=>{
    F.imageUrls.forEach(F.revoke);F.imageUrls=[];
    const list=[...(files||[])].filter(x=>x.type?.startsWith('image/'));
    F.imageUrls=list.map(x=>URL.createObjectURL(x));
    const count=document.getElementById('r-images-count');
    if(count)count.textContent=list.length?list.length+' ảnh đã chọn':'Chưa chọn ảnh';
    F.renderCreatePreview();
  };

  F.previewVideo=file=>{
    if(F.videoUrl)F.revoke(F.videoUrl);F.videoUrl=null;
    if(file?.type?.startsWith('video/'))F.videoUrl=URL.createObjectURL(file);
    const count=document.getElementById('r-video-count');
    if(count)count.textContent=F.videoUrl?'1 video đã chọn':'Chưa chọn video';
    F.renderCreatePreview();
  };

  F.previewPendingMedia=(files,host,kind='image')=>{
    F.clearPending();
    const list=[...(files||[])].filter(f=>kind==='video'?f.type?.startsWith('video/'):f.type?.startsWith('image/'));
    if(!host||!list.length)return;
    F.pendingUrls=list.slice(0,8).map(f=>URL.createObjectURL(f));
    let box=host.querySelector('.pending-upload-preview');
    if(!box){box=document.createElement('div');box.className='pending-upload-preview';host.appendChild(box)}
    box.innerHTML=kind==='video'
      ? '<b>Video đã chọn</b><video src="'+F.pendingUrls[0]+'" muted controls playsinline preload="metadata"></video>'
      : '<b>'+list.length+' ảnh đã chọn</b><div class="pending-upload-grid">'+F.pendingUrls.map((u,i)=>'<div><img src="'+u+'" alt="Ảnh đã chọn">'+(i===0?'<span>★ Đại diện</span>':'')+'</div>').join('')+'</div>';
  };

  document.addEventListener('change',e=>{
    if(e.target?.id==='r-images')F.previewImages(e.target.files);
    if(e.target?.id==='r-video')F.previewVideo(e.target.files?.[0]);
  },true);

  /* Final room filters: no balcony */
  window.clearRoomFilters=function(){
    state.query='';
    state.roomStatus='ALL';
    state.filters={district:'',min:'',max:'',pets:false,washer:false,availableBy:''};
    render();
  };

  window.openFilter=function(){
    const districts=[...new Set((state.rooms||[]).map(x=>normalizeRoom(x).district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">KHO PHÒNG</div><h2>Bộ lọc phòng</h2></div><button onclick="closeSheet()">✕</button></div>'+
      '<div class="field"><label>Khu vực</label><select id="fd"><option value="">Tất cả khu vực</option>'+districts.map(x=>'<option '+(state.filters.district===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>'+
      '<div class="grid2"><div class="field"><label>Giá từ</label><input id="fmin" type="number" inputmode="numeric" value="'+esc(state.filters.min||'')+'" placeholder="4.000.000"></div><div class="field"><label>Đến</label><input id="fmax" type="number" inputmode="numeric" value="'+esc(state.filters.max||'')+'" placeholder="8.000.000"></div></div>'+
      '<div class="field"><label>Có thể vào trước ngày</label><input id="fav" type="date" value="'+esc(state.filters.availableBy||'')+'"></div>'+
      '<div class="check-grid"><label class="check"><input id="fpet" type="checkbox" '+(state.filters.pets?'checked':'')+'> Cho thú cưng</label><label class="check"><input id="fwash" type="checkbox" '+(state.filters.washer?'checked':'')+'> Máy giặt riêng</label></div>'+
      '<div class="sheet-actions"><button class="btn ghost" onclick="clearRoomFilters();closeSheet()">Xóa lọc</button><button class="btn primary" onclick="applyFilter()">Xem kết quả</button></div>');
  };

  window.applyFilter=function(){
    state.filters={
      district:val('#fd'),min:val('#fmin'),max:val('#fmax'),
      availableBy:val('#fav'),pets:checked('#fpet'),washer:checked('#fwash')
    };
    closeSheet();render();
  };

  window.filteredRooms=function(){
    const f=state.filters||{},q=norm(state.query);
    return (state.rooms||[]).filter(raw=>{
      const r=normalizeRoom(raw);
      if(state.roomStatus!=='ALL'&&r.status!==state.roomStatus)return false;
      const hay=norm([r.code,r.room_number,r.title,r.building_name,r.district,r.ward,r.street].join(' '));
      if(q&&!hay.includes(q))return false;
      if(f.district&&r.district!==f.district)return false;
      if(f.min&&Number(r.price)<Number(f.min))return false;
      if(f.max&&Number(r.price)>Number(f.max))return false;
      if(f.pets&&!/cho|pet|mèo|meo|chó|cho/i.test(r.pet_policy||''))return false;
      if(f.washer&&norm(r.washer_type)!=='rieng')return false;
      if(f.availableBy&&r.available_date&&r.available_date>f.availableBy)return false;
      return true;
    });
  };

  if(typeof window.customerReq==='function'){
    const prevCustomerReq=window.customerReq;
    window.customerReq=function(c){
      const r=prevCustomerReq(c)||{};
      return {...r,need_balcony:false};
    };
  }

  const removeBalconyTags=()=>{
    document.querySelectorAll('.tag').forEach(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      if(t==='ban công'||t==='không ban công')el.remove();
    });
  };

  if(typeof window.openRoom==='function'){
    const prevOpenRoom=window.openRoom;
    window.openRoom=function(id){
      const out=prevOpenRoom(id);
      requestAnimationFrame(()=>{
        removeBalconyTags();
        if(typeof canManage==='function' && canManage()){
          const sheet=document.querySelector('#sheet-overlay .sheet')||document.querySelector('.sheet');
          const cta=sheet?.querySelector('.sticky-cta');
          if(sheet && cta && !sheet.querySelector('.room-detail-tools')){
            const tools=document.createElement('div');
            tools.className='room-detail-tools';
            tools.innerHTML='<button type="button" class="btn clone-room-detail" onclick="duplicateRoom(\''+id+'\')">⧉ Nhân bản phòng này</button>';
            cta.insertAdjacentElement('beforebegin',tools);
          }
        }
      });
      return out;
    };
  }

  if(typeof window.openPublicRoom==='function'){
    const prevOpenPublicRoom=window.openPublicRoom;
    window.openPublicRoom=function(id){
      const out=prevOpenPublicRoom(id);
      requestAnimationFrame(removeBalconyTags);
      return out;
    };
  }

  if(typeof window.publicRoomCard==='function'){
    const prevPublicRoomCard=window.publicRoomCard;
    window.publicRoomCard=function(r){
      return prevPublicRoomCard(r)
        .replace(/<span>🌤️\s*(?:Không\s+)?Ban công<\/span>/gi,'')
        .replace(/<span class="tag">Ban công<\/span>/gi,'');
    };
  }

  F.updateModalState=()=>{
    if(!document.body)return;
    document.body.classList.toggle('sr-modal-open',!!document.querySelector('.overlay'));
  };

  const observer=new MutationObserver(()=>{
    F.applyMode();F.updateModalState();
    const createOpen=!!document.getElementById('r-images');
    if(!createOpen&&(F.imageUrls.length||F.videoUrl))F.clearPreview();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  let t=0;
  const schedule=()=>{clearTimeout(t);t=setTimeout(F.applyMode,80)};
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule);

  F.applyMode();F.updateModalState();
})();
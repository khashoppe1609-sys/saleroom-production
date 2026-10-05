/* SaleRoom v3 public catalog: contact-gated viewing + room details + fullscreen gallery */
(() => {
  const S=window.SR3;
  state.publicDistrict=state.publicDistrict||'';
  S.gallery={images:[],index:0,touchX:null};
  S.saleZalo=sale=>sale?.zalo_url||(String(sale?.phone||'').replace(/\D/g,'')?`https://zalo.me/${String(sale.phone).replace(/\D/g,'')}`:'');

  renderPublicCatalog=function(){
    const c=state.publicCatalog,all=(c.rooms||[]).filter(r=>r.status==='AVAILABLE'),districts=[...new Set(all.map(r=>r.building?.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    if(state.publicDistrict&&!districts.includes(state.publicDistrict))state.publicDistrict='';
    const shown=state.publicDistrict?all.filter(r=>r.building?.district===state.publicDistrict):all;
    const groups=shown.reduce((m,r)=>{const k=r.building?.district||'Khu vực khác';(m[k]||=[]).push(r);return m},{}),phone=c.sale?.phone||'',zalo=S.saleZalo(c.sale);
    app.innerHTML=`<div class="public-shell orange-public"><header class="public-header"><div class="brand-row"><div class="brand-mark small">SR</div><div><b>SaleRoom</b><span>Phòng trống dành cho bạn</span></div></div><div class="sale-chip"><span>Tư vấn bởi</span><b>${esc(c.sale?.name||'Sale')}</b></div></header><main class="public-content"><div class="public-intro"><div class="eyebrow">CATALOG PHÒNG TRỐNG</div><h1>${esc(c.title||'Phòng phù hợp dành cho bạn')}</h1><p>Chạm vào phòng để xem chi tiết & hình ảnh.</p></div><div class="public-category-sticky"><div class="area-chips public-area-chips"><button class="area-chip ${!state.publicDistrict?'active':''}" onclick="state.publicDistrict='';renderPublicCatalog()">Tất cả khu vực</button>${districts.map(d=>`<button class="area-chip ${state.publicDistrict===d?'active':''}" onclick="state.publicDistrict='${esc(d)}';renderPublicCatalog()">📍 ${esc(d)}</button>`).join('')}</div></div>${Object.entries(groups).sort(([a],[b])=>a.localeCompare(b,'vi')).map(([d,rooms])=>`<section class="public-area-section"><div class="area-heading"><div><span class="area-pin">📍</span><b>${esc(d)}</b></div><span>${rooms.length} phòng trống</span></div>${rooms.map(publicRoomCard).join('')}</section>`).join('')||empty('Hiện chưa có phòng trống ở khu vực này')}<div class="public-contact"><div><b>Cần tư vấn thêm?</b><span>${esc(c.sale?.name||'Sale')}${phone?` · ${esc(phone)}`:''}</span></div><div class="contact-actions">${phone?`<a class="btn call-btn" href="tel:${esc(phone)}">☎ Gọi</a>`:''}${zalo?`<a class="btn zalo-btn" href="${esc(zalo)}" target="_blank" rel="noopener">💬 Zalo</a>`:''}</div></div></main><footer class="public-footer">Chỉ hiển thị phòng đang trống. Vui lòng xác nhận tình trạng trước khi đặt cọc.</footer></div>`;
  };

  publicRoomCard=function(r){
    const img=r.images?.[0];return `<article class="public-room clickable-room" onclick="openPublicRoom('${r.id}')"><div class="public-photo ${img?'has-image':''}" ${img?`style="background-image:url('${esc(img)}')"`:''}>${!img?'<span>🏠</span>':''}<div class="badges"><span class="badge available">TRỐNG</span></div>${r.images?.length?`<span class="photo-count">📷 ${r.images.length}</span>`:''}</div><div class="public-room-body"><div class="public-room-head"><div><h2>${esc(r.title||r.room_number||r.code)}</h2><p>📍 ${esc(r.building?.district||'')}</p></div><div class="price">${money(r.price)}</div></div><div class="public-facts"><span>📐 ${esc(r.area||'—')}m²</span><span>🚪 ${esc(r.room_type||'—')}</span><span>🌤️ ${r.has_balcony?'Ban công':'Không ban công'}</span><span>🧺 ${esc(r.washer_type||'—')}</span></div><div class="public-card-hint">Xem chi tiết phòng & ảnh →</div><div class="feedback-row"><button onclick="event.stopPropagation();catalogFeedback('${r.id}','INTERESTED',this)">♡ Quan tâm</button><button class="primary-lite" onclick="event.stopPropagation();requestViewing('${r.id}')">📅 Muốn xem</button><button onclick="event.stopPropagation();catalogFeedback('${r.id}','NOT_SUITABLE',this)">Không phù hợp</button></div></div></article>`;
  };

  window.openPublicRoom=function(roomId){
    const c=state.publicCatalog,r=(c.rooms||[]).find(x=>x.id===roomId);if(!r)return;
    const phone=c.sale?.phone||'',zalo=S.saleZalo(c.sale),images=r.images||[];
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">${esc(r.code)}</div><h2>${esc(r.title||r.room_number||'Chi tiết phòng')}</h2><p>📍 ${esc(r.building?.district||'')}</p></div><button onclick="closeSheet()">✕</button></div>${images.length?`<div class="public-detail-gallery"><img class="public-detail-main" src="${esc(images[0])}" alt="Ảnh phòng" onclick="openFullscreenGallery('${roomId}',0)"><div class="public-thumbs">${images.map((u,i)=>`<button onclick="openFullscreenGallery('${roomId}',${i})"><img src="${esc(u)}" alt="Ảnh ${i+1}"></button>`).join('')}</div><small>Chạm vào ảnh để phóng to · vuốt trái/phải khi xem toàn màn hình</small></div>`:'<div class="detail-hero"><span>🏠</span><small>Chưa có ảnh</small></div>'}<div class="detail-price">${money(r.price)}<span>/tháng</span></div><div class="detail-grid"><div class="detail-box"><b>Diện tích</b><span>${esc(r.area||'—')}m²</span></div><div class="detail-box"><b>Loại phòng</b><span>${esc(r.room_type||'—')}</span></div><div class="detail-box"><b>Tiền cọc</b><span>${money(r.deposit)}</span></div><div class="detail-box"><b>Ngày vào</b><span>${fmtDate(r.available_date)}</span></div></div><h3 class="subhead">Chi phí</h3><div class="cost-list"><div><span>⚡ Điện</span><b>${esc(r.electric_price||'—')}</b></div><div><span>💧 Nước</span><b>${esc(r.water_price||'—')}</b></div><div><span>🧹 Dịch vụ</span><b>${esc(r.service_fee||'—')}</b></div><div><span>🛵 Xe</span><b>${esc(r.parking_fee||'—')}</b></div><div><span>📶 Internet</span><b>${esc(r.internet_fee||'—')}</b></div></div><div class="tags">${[...(r.amenities||[]),r.has_balcony?'Ban công':null,r.washer_type?`Máy giặt ${r.washer_type}`:null,r.pet_policy].filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="public-address">📍 ${esc(r.building?.address||r.building?.district||'')}</div><div class="sticky-cta public-detail-cta"><button class="btn primary" onclick="requestViewing('${r.id}')">📅 Muốn xem phòng</button>${phone?`<a class="btn ghost link-btn" href="tel:${esc(phone)}">☎ Gọi</a>`:''}${zalo?`<a class="btn ghost link-btn" href="${esc(zalo)}" target="_blank" rel="noopener">💬 Zalo</a>`:''}</div>`);
  };

  window.requestViewing=function(roomId){
    const r=(state.publicCatalog?.rooms||[]).find(x=>x.id===roomId);if(!r)return;
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">YÊU CẦU XEM PHÒNG</div><h2>${esc(r.title||r.code)}</h2><p>${money(r.price)} · ${esc(r.building?.district||'')}</p></div><button onclick="closeSheet()">✕</button></div><p class="form-explain">Để Sale biết ai cần xem và liên hệ lại, vui lòng để lại thông tin:</p><div class="field"><label>TÊN *</label><input id="view-name" autocomplete="name" placeholder="Nguyễn Văn A"></div><div class="field"><label>SỐ ĐIỆN THOẠI *</label><input id="view-phone" inputmode="tel" autocomplete="tel" placeholder="09xxxxxxxx"></div><div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="submitViewing('${roomId}')">Gửi yêu cầu xem</button></div>`);
  };

  window.submitViewing=async function(roomId){
    const name=val('#view-name').trim(),phone=val('#view-phone').trim();
    if(name.length<2)return toast('Vui lòng nhập tên');
    if(phone.replace(/\D/g,'').length<8)return toast('Vui lòng nhập số điện thoại hợp lệ');
    try{setLoading(true,'Đang gửi yêu cầu…');const {error}=await client.rpc('submit_catalog_viewing',{p_token:state.publicCatalog.token,p_room_id:roomId,p_name:name,p_phone:phone});if(error)throw error;closeSheet();toast('Đã gửi yêu cầu. Sale sẽ liên hệ bạn sớm.',4500)}catch(e){toast(errMessage(e),4000)}finally{setLoading(false)}
  };

  window.openFullscreenGallery=function(roomId,index=0){
    const r=(state.publicCatalog?.rooms||[]).find(x=>x.id===roomId);if(!r?.images?.length)return;
    S.gallery.images=r.images;S.gallery.index=Math.max(0,Math.min(index,r.images.length-1));
    let el=document.querySelector('#sr-full-gallery');
    if(!el){el=document.createElement('div');el.id='sr-full-gallery';el.className='full-gallery';document.body.appendChild(el)}
    renderFullGallery();
  };
  window.renderFullGallery=function(){
    const g=S.gallery,el=document.querySelector('#sr-full-gallery');if(!el)return;const src=g.images[g.index];
    el.innerHTML=`<div class="gallery-top"><span>${g.index+1} / ${g.images.length}</span><button onclick="closeFullscreenGallery()">✕</button></div><button class="gallery-prev" onclick="galleryMove(-1)">‹</button><div class="gallery-stage" ontouchstart="galleryTouchStart(event)" ontouchend="galleryTouchEnd(event)"><img src="${esc(src)}" alt="Ảnh phòng toàn màn hình"></div><button class="gallery-next" onclick="galleryMove(1)">›</button>`;
  };
  window.galleryMove=function(dir){const g=S.gallery;if(!g.images.length)return;g.index=(g.index+dir+g.images.length)%g.images.length;renderFullGallery()};
  window.closeFullscreenGallery=function(){document.querySelector('#sr-full-gallery')?.remove()};
  window.galleryTouchStart=e=>{S.gallery.touchX=e.changedTouches?.[0]?.clientX??null};
  window.galleryTouchEnd=e=>{const x=e.changedTouches?.[0]?.clientX;if(S.gallery.touchX==null||x==null)return;const dx=x-S.gallery.touchX;if(Math.abs(dx)>45)galleryMove(dx<0?1:-1);S.gallery.touchX=null};
  document.addEventListener('keydown',e=>{if(!document.querySelector('#sr-full-gallery'))return;if(e.key==='ArrowRight')galleryMove(1);if(e.key==='ArrowLeft')galleryMove(-1);if(e.key==='Escape')closeFullscreenGallery()});
})();
/* v4 conditional public fields */
(() => {
  const oldCard = publicRoomCard;
  publicRoomCard = function(r){
    let h = oldCard(r);
    h = h.replace('<span>📐 —m²</span>','')
         .replace('<span>🚪 —</span>','')
         .replace('<span>🌤️ Không ban công</span>','')
         .replace('<span>🧺 —</span>','')
         .replace('<div class="price">0 ₫</div>','')
         .replace('<div class="price">0 đ</div>','');
    return h;
  };

  const oldOpenPublicRoom = window.openPublicRoom;
  window.openPublicRoom = function(roomId){
    const r=(state.publicCatalog?.rooms||[]).find(x=>x.id===roomId);
    oldOpenPublicRoom(roomId);
    requestAnimationFrame(() => {
      const sheet=document.querySelector('.sheet');
      if(!sheet||!r) return;

      sheet.querySelectorAll('.detail-box').forEach(box=>{
        const v=(box.querySelector('span')?.textContent||'').trim();
        if(!v || v==='—' || v==='0 đ' || v==='0 ₫' || v==='—m²') box.remove();
      });
      sheet.querySelectorAll('.cost-list > div').forEach(row=>{
        const v=(row.querySelector('b')?.textContent||'').trim();
        if(!v || v==='—') row.remove();
      });
      const costs=sheet.querySelector('.cost-list');
      if(costs && !costs.children.length){
        const head=costs.previousElementSibling;
        if(head?.classList.contains('subhead')) head.remove();
        costs.remove();
      }

      const gallery=sheet.querySelector('.public-detail-gallery');
      if(r.description && !sheet.querySelector('.public-description')){
        const d=document.createElement('div');
        d.className='public-description';
        d.textContent=r.description;
        (gallery||sheet.querySelector('.sheet-head'))?.insertAdjacentElement('afterend',d);
      }

      const grid=sheet.querySelector('.detail-grid');
      if(grid){
        const extras=[
          r.floor ? ['Tầng',r.floor] : null,
          Number(r.max_people)>0 ? ['Số người','Tối đa '+r.max_people] : null,
          Number(r.max_motorbike)>0 ? ['Số xe','Tối đa '+r.max_motorbike] : null,
          r.furniture ? ['Nội thất',r.furniture] : null,
          Number(r.contract_months)>0 ? ['Hợp đồng',r.contract_months+' tháng'] : null
        ].filter(Boolean);
        extras.forEach(([k,v])=>{
          if([...grid.querySelectorAll('b')].some(b=>b.textContent===k)) return;
          const el=document.createElement('div');
          el.className='detail-box';
          el.innerHTML='<b>'+esc(k)+'</b><span>'+esc(v)+'</span>';
          grid.appendChild(el);
        });
        if(!grid.children.length) grid.remove();
      }
    });
  };
})();

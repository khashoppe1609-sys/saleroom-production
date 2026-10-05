/* SaleRoom v3 rooms: sticky categories + area-first add room */
(() => {
  const S=window.SR3;
  roomsView=function(){
    const rooms=filteredRooms();
    const areas=[...new Set(state.rooms.map(r=>normalizeRoom(r).district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    const selected=state.selectedRoomIds.size;
    const groups=rooms.reduce((m,r0)=>{const r=normalizeRoom(r0),k=r.district||'Chưa phân khu';(m[k]||=[]).push(r0);return m},{});
    const groupHtml=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b,'vi')).map(([d,list])=>{
      const available=list.filter(r=>r.status==='AVAILABLE').length;
      return `<section class="area-section"><div class="area-heading"><div><span class="area-pin">📍</span><div><b>${esc(d)}</b><small>${available} phòng trống</small></div></div><button class="area-send-btn" ${available?'':'disabled'} onclick="createAreaCatalog('${S.js(d)}')">📤 Gửi cả khu vực</button></div>${list.map(roomCard).join('')}</section>`;
    }).join('');
    return shell('Kho phòng','Chọn từng phòng hoặc gửi toàn bộ phòng trống theo khu vực',`
      <div class="search-row"><input class="search" placeholder="Mã phòng, đường, khu vực…" value="${esc(state.query)}" oninput="state.query=this.value;render()"><button class="icon-btn filter-icon-btn" onclick="openFilter()" aria-label="Bộ lọc" title="Bộ lọc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button></div>
      <div class="room-sticky-filters"><div class="area-chips"><button class="area-chip ${!state.filters.district?'active':''}" onclick="state.filters.district='';render()">Tất cả khu vực</button>${areas.map(d=>`<button class="area-chip ${state.filters.district===d?'active':''}" onclick="state.filters.district='${esc(d)}';render()">📍 ${esc(d)}</button>`).join('')}</div><div class="tabs">${[['ALL','Tất cả'],['AVAILABLE','Trống'],['COMING_SOON','Sắp trống'],['HOLD','Đang giữ'],['DEPOSITED','Đã cọc'],['RENTED','Đã thuê']].map(([k,l])=>`<button class="tab ${state.roomStatus===k?'active':''}" onclick="state.roomStatus='${k}';render()">${l}</button>`).join('')}</div><div class="filter-summary"><span><b>${rooms.length}</b> phòng${state.filters.district?` · ${esc(state.filters.district)}`:''}</span><button onclick="clearRoomFilters()">Xóa lọc</button></div></div>
      ${groupHtml||empty('Không có phòng phù hợp bộ lọc')}
      ${selected?`<div class="selection-bar"><div><b>${selected} phòng</b><span>đã chọn</span></div><button class="btn ghost" onclick="clearSelected()">Bỏ chọn</button><button class="btn primary" onclick="createCatalogFromSelected()">Tạo catalog</button></div>`:''}
      ${canManage()?'<button class="fab" onclick="newRoom()" aria-label="Thêm phòng">+</button>':''}
    `,` `);
  };

  roomCard=function(r0){
    const r=normalizeRoom(r0),[label,cls]=STATUS[r.status]||[r.status,''],checked=state.selectedRoomIds.has(r.id),img=r.images?.[0],available=r.status==='AVAILABLE';
    return `<article class="room-card ${checked?'selected':''}"><div class="room-media ${img?'has-image':''}" ${img?`style="background-image:url('${esc(img)}')"`:''}><div class="badges"><span class="badge ${cls}">${label}</span>${r.available_date===todayISO()?'<span class="badge">VÀO NGAY</span>':''}</div><label class="select-room"><input type="checkbox" ${checked?'checked':''} onchange="toggleRoomSelection('${r.id}')"><span>✓</span></label></div><div class="room-body"><div class="room-head"><div><div class="room-title">${esc(r.title||`${r.room_type||'Phòng'} ${r.room_number||''}`)}</div><div class="room-code">🔖 ${esc(r.code)}</div></div><div class="price">${money(r.price)}</div></div><div class="meta icon-meta"><span>📍 ${esc(r.district||'—')}</span><span>📐 ${esc(r.area||'—')}m²</span><span>🚪 ${esc(r.room_type||'—')}</span><span>🛋️ ${esc(r.furniture||'—')}</span></div><div class="tags"><span class="tag">🧺 ${esc(r.washer_type||'—')}</span><span class="tag">🐾 ${/cho|pet|mèo|meo|chó|cho/i.test(r.pet_policy||'')?'Cho pet':'Không pet'}</span></div><div class="room-tool-row"><button class="mini-tool" onclick="copyRoomInfo('${r.id}',event)">📋 Sao chép</button>${state.profile?.role==='admin'?`<button class="mini-tool danger" onclick="deleteRoom('${r.id}',event)">🗑 Xóa</button>`:''}</div><div class="actions"><button class="btn ghost small" onclick="openRoom('${r.id}')">Xem phòng</button>${available?`<button class="btn primary small" onclick="quickCatalog('${r.id}')">Gửi phòng này</button>`:`<button class="btn disabled small" disabled>Không thể gửi</button>`}</div></div></article>`;
  };

  newRoom=function(){
    if(!canManage()) return toast('Chỉ Manager/Admin được thêm phòng');
    if(!state.areas?.length) return newArea();
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">KHO PHÒNG</div><h2>Thêm phòng</h2><p>Nhập thông tin phòng thực tế · mã nội bộ được tạo tự động</p></div><button onclick="closeSheet()">✕</button></div>
      <h3 class="form-section-title">📍 Vị trí & nhận diện</h3>
      <div class="field"><label>Khu vực *</label><div class="inline-field"><select id="r-area">${state.areas.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><button class="mini-add" type="button" onclick="newArea()">+ Khu vực</button></div></div>
      <div class="grid2"><div class="field"><label>Tên phòng / tiêu đề</label><input id="rtitle" placeholder="Ví dụ: Studio ban công đẹp"></div><div class="field"><label>Số phòng</label><input id="rnum" placeholder="Ví dụ: P.302"></div></div>
      <div class="grid2"><div class="field"><label>Tầng</label><input id="rfloor" placeholder="Ví dụ: Tầng 3"></div><div class="field"><label>Loại phòng</label><input id="rtype" placeholder="Studio, 1PN, Duplex..."></div></div>
      <div class="field"><label>Mô tả gửi khách</label><textarea id="rdesc" placeholder="Mô tả điểm nổi bật của phòng, vị trí, ánh sáng, view..."></textarea></div>

      <h3 class="form-section-title">💰 Giá & chi phí</h3>
      <div class="grid2"><div class="field"><label>Giá thuê</label><input id="rprice" type="number" inputmode="numeric" placeholder="5500000"></div><div class="field"><label>Tiền cọc</label><input id="rdeposit" type="number" inputmode="numeric" placeholder="5500000"></div></div>
      <div class="grid2"><div class="field"><label>Điện</label><input id="relectric" placeholder="Ví dụ: 4.000đ/kWh"></div><div class="field"><label>Nước</label><input id="rwater" placeholder="Ví dụ: 100.000đ/người"></div></div>
      <div class="grid2"><div class="field"><label>Phí dịch vụ</label><input id="rservice" placeholder="Ví dụ: 200.000đ/phòng"></div><div class="field"><label>Phí gửi xe</label><input id="rparking" placeholder="Ví dụ: 150.000đ/xe"></div></div>
      <div class="field"><label>Internet</label><input id="rinternet" placeholder="Ví dụ: Miễn phí hoặc 100.000đ/phòng"></div>

      <h3 class="form-section-title">🏠 Thông tin phòng</h3>
      <div class="grid2"><div class="field"><label>Diện tích m²</label><input id="rarea" type="number" step="0.1" inputmode="decimal" placeholder="28"></div><div class="field"><label>Nội thất</label><input id="rfurniture" placeholder="Ví dụ: Full nội thất"></div></div>
      <div class="grid2"><div class="field"><label>Số người tối đa</label><input id="rpeople" type="number" inputmode="numeric" placeholder="2"></div><div class="field"><label>Số xe tối đa</label><input id="rbikes" type="number" inputmode="numeric" placeholder="2"></div></div>
      <div class="grid2"><div class="field"><label>Máy giặt</label><input id="rwasher" placeholder="Riêng, chung, không có..."></div><div class="field"><label>Chính sách thú cưng</label><input id="rpetpolicy" placeholder="Cho mèo/chó nhỏ, không pet..."></div></div>
      <div class="field"><label>Tiện ích</label><textarea id="ramenities" placeholder="Nhập tự do, ngăn cách bằng dấu phẩy hoặc xuống dòng&#10;Ví dụ: Máy lạnh, Tủ lạnh, Bếp, Khóa vân tay"></textarea></div>

      <h3 class="form-section-title">📅 Trạng thái & hợp đồng</h3>
      <div class="grid2"><div class="field"><label>Ngày có phòng</label><input id="ravail" type="date" value="${todayISO()}"></div><div class="field"><label>Trạng thái</label><select id="rstatus"><option value="AVAILABLE">Trống</option><option value="COMING_SOON">Sắp trống</option><option value="HOLD">Đang giữ</option><option value="DEPOSITED">Đã cọc</option><option value="RENTED">Đã thuê</option><option value="MAINTENANCE">Đang sửa</option></select></div></div>
      <div class="field"><label>Thời hạn hợp đồng (tháng)</label><input id="rcontract" type="number" inputmode="numeric" placeholder="Ví dụ: 6 hoặc 12"></div>

      <h3 class="form-section-title">💼 Thông tin nội bộ</h3>
      <div class="grid2"><div class="field"><label>Hoa hồng</label><input id="rcommission" placeholder="Ví dụ: 50% tháng đầu / 3 triệu"></div><div class="field"><label>Thưởng thêm</label><input id="rbonus" type="number" inputmode="numeric" placeholder="0"></div></div>
      <div class="field"><label>Ghi chú nội bộ</label><textarea id="rnote" placeholder="Thông tin chủ nhà, lưu ý dẫn khách, điều kiện đặc biệt..."></textarea></div>

      <h3 class="form-section-title">🖼 Ảnh & video phòng</h3>
      <div class="create-media-grid">
        <label class="create-media-picker"><b>🖼 Chọn ảnh phòng</b><span id="r-images-count">Chưa chọn ảnh</span><input id="r-images" type="file" accept="image/*" multiple hidden></label>
        <label class="create-media-picker"><b>🎬 Chọn video phòng</b><span id="r-video-count">Chưa chọn video</span><input id="r-video" type="file" accept="video/*" hidden></label>
      </div>
      <div id="r-media-preview" class="create-media-preview" hidden></div>
      <div class="form-help">Ảnh đầu tiên bạn chọn sẽ là ảnh đại diện. Có thể đổi ảnh đại diện sau. Video luôn nằm sau toàn bộ ảnh và được nén mạnh trước khi upload.</div>
      <div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="saveRoom()">Lưu phòng</button></div>`);
  };

  saveRoom=async function(){
    const areaId=val('#r-area');
    if(!areaId) return toast('Chọn khu vực');
    const area=state.areas.find(a=>a.id===areaId); if(!area) return toast('Khu vực không hợp lệ');
    const cleanList=(val('#ramenities')||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
    const roomNumber=val('#rnum').trim();
    const roomType=val('#rtype').trim();
    const title=val('#rtitle').trim() || [roomType,roomNumber].filter(Boolean).join(' ') || 'Phòng cho thuê';
    const autoId=(globalThis.crypto?.randomUUID?.()||uid()).replace(/-/g,'').slice(0,12).toUpperCase();
    const code=`AUTO-${autoId}`;
    try{
      setLoading(true,'Đang lưu phòng…');
      let building=state.buildings.find(b=>b.code===S.compatCode(areaId));
      if(!building){
        const {data,error}=await client.from('buildings').insert({organization_id:state.profile.organization_id,code:S.compatCode(areaId),name:area.name,address:area.name,city:area.city||'TP.HCM',district:area.name,amenities:[],created_by:state.profile.id}).select().single();
        if(error) throw error; building=data;
      }
      const data={
        area_id:areaId,
        building_id:building.id,
        code,
        room_number:roomNumber||null,
        floor:val('#rfloor').trim()||null,
        room_type:roomType||null,
        title,
        description:val('#rdesc').trim()||null,
        price:Number(val('#rprice')||0),
        deposit:Number(val('#rdeposit')||0),
        area:val('#rarea')?Number(val('#rarea')):null,
        status:val('#rstatus'),
        available_date:val('#ravail')||null,
        max_people:val('#rpeople')?Number(val('#rpeople')):null,
        max_motorbike:val('#rbikes')?Number(val('#rbikes')):null,
        furniture:val('#rfurniture').trim()||null,
        amenities:cleanList,
        pet_policy:val('#rpetpolicy').trim()||null,
        has_balcony:false,
        washer_type:val('#rwasher').trim()||null,
        electric_price:val('#relectric').trim()||null,
        water_price:val('#rwater').trim()||null,
        service_fee:val('#rservice').trim()||null,
        parking_fee:val('#rparking').trim()||null,
        internet_fee:val('#rinternet').trim()||null,
        contract_months:val('#rcontract')?Number(val('#rcontract')):null,
        commission_type:null,
        commission_value:null,
        commission_note:val('#rcommission').trim()||null,
        bonus:val('#rbonus')?Number(val('#rbonus')):0,
        internal_note:val('#rnote').trim()||null
      };
      const imageFiles=[...(document.querySelector('#r-images')?.files||[])];
      const videoFiles=[...(document.querySelector('#r-video')?.files||[])];
      const {data:created,error}=await client.from('rooms').insert({...data,organization_id:state.profile.organization_id,created_by:state.profile.id,updated_by:state.profile.id}).select('id').single(); if(error) throw error;
      closeSheet(); state.tab='rooms'; await hydrate();
      if(imageFiles.length) await uploadRoomImages(created.id,imageFiles);
      if(videoFiles.length) await uploadRoomVideo(created.id,videoFiles);
      if(!imageFiles.length&&!videoFiles.length) toast('Đã thêm phòng');
      else toast('Đã thêm phòng và media',4500);
    }catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}
  };
})();
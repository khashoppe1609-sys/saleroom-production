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
      <div class="search-row"><input class="search" placeholder="Mã phòng, đường, khu vực…" value="${esc(state.query)}" oninput="state.query=this.value;render()"><button class="icon-btn" onclick="openFilter()">⚙</button></div>
      <div class="room-sticky-filters"><div class="area-chips"><button class="area-chip ${!state.filters.district?'active':''}" onclick="state.filters.district='';render()">Tất cả khu vực</button>${areas.map(d=>`<button class="area-chip ${state.filters.district===d?'active':''}" onclick="state.filters.district='${esc(d)}';render()">📍 ${esc(d)}</button>`).join('')}</div><div class="tabs">${[['ALL','Tất cả'],['AVAILABLE','Trống'],['COMING_SOON','Sắp trống'],['HOLD','Đang giữ'],['DEPOSITED','Đã cọc'],['RENTED','Đã thuê']].map(([k,l])=>`<button class="tab ${state.roomStatus===k?'active':''}" onclick="state.roomStatus='${k}';render()">${l}</button>`).join('')}</div><div class="filter-summary"><span><b>${rooms.length}</b> phòng${state.filters.district?` · ${esc(state.filters.district)}`:''}</span><button onclick="clearRoomFilters()">Xóa lọc</button></div></div>
      ${groupHtml||empty('Không có phòng phù hợp bộ lọc')}
      ${selected?`<div class="selection-bar"><div><b>${selected} phòng</b><span>đã chọn</span></div><button class="btn ghost" onclick="clearSelected()">Bỏ chọn</button><button class="btn primary" onclick="createCatalogFromSelected()">Tạo catalog</button></div>`:''}
      ${canManage()?'<button class="fab" onclick="newRoom()" aria-label="Thêm phòng">+</button>':''}
    `,`<button class="top-action" onclick="openFilter()">Bộ lọc</button>`);
  };

  roomCard=function(r0){
    const r=normalizeRoom(r0),[label,cls]=STATUS[r.status]||[r.status,''],checked=state.selectedRoomIds.has(r.id),img=r.images?.[0],available=r.status==='AVAILABLE';
    return `<article class="room-card ${checked?'selected':''}"><div class="room-media ${img?'has-image':''}" ${img?`style="background-image:url('${esc(img)}')"`:''}><div class="badges"><span class="badge ${cls}">${label}</span>${r.available_date===todayISO()?'<span class="badge">VÀO NGAY</span>':''}</div><label class="select-room"><input type="checkbox" ${checked?'checked':''} onchange="toggleRoomSelection('${r.id}')"><span>✓</span></label></div><div class="room-body"><div class="room-head"><div><div class="room-title">${esc(r.title||`${r.room_type||'Phòng'} ${r.room_number||''}`)}</div><div class="room-code">🔖 ${esc(r.code)}</div></div><div class="price">${money(r.price)}</div></div><div class="meta icon-meta"><span>📍 ${esc(r.district||'—')}</span><span>📐 ${esc(r.area||'—')}m²</span><span>🚪 ${esc(r.room_type||'—')}</span><span>🛋️ ${esc(r.furniture||'—')}</span></div><div class="tags"><span class="tag">🌤️ ${r.has_balcony?'Ban công':'Không ban công'}</span><span class="tag">🧺 ${esc(r.washer_type||'—')}</span><span class="tag">🐾 ${/cho|pet|mèo|meo|chó|cho/i.test(r.pet_policy||'')?'Cho pet':'Không pet'}</span></div><div class="room-tool-row"><button class="mini-tool" onclick="copyRoomInfo('${r.id}',event)">📋 Sao chép</button>${state.profile?.role==='admin'?`<button class="mini-tool danger" onclick="deleteRoom('${r.id}',event)">🗑 Xóa</button>`:''}</div><div class="actions"><button class="btn ghost small" onclick="openRoom('${r.id}')">Xem phòng</button>${available?`<button class="btn primary small" onclick="quickCatalog('${r.id}')">Gửi phòng này</button>`:`<button class="btn disabled small" disabled>Không thể gửi</button>`}</div></div></article>`;
  };

  newRoom=function(){
    if(!canManage()) return toast('Chỉ Manager/Admin được thêm phòng');
    if(!state.areas?.length) return newArea();
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">KHO PHÒNG</div><h2>Thêm phòng</h2></div><button onclick="closeSheet()">✕</button></div>
      <div class="field"><label>Khu vực *</label><div class="inline-field"><select id="r-area">${state.areas.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><button class="mini-add" onclick="newArea()">+ Khu vực</button></div></div>
      <div class="grid2"><div class="field"><label>Mã phòng *</label><input id="rcode" placeholder="Q7-302"></div><div class="field"><label>Số phòng</label><input id="rnum" placeholder="P.302"></div></div>
      <div class="grid2"><div class="field"><label>Loại phòng</label><select id="rtype"><option>Studio</option><option>1PN</option><option>2PN</option><option>Duplex</option><option>Phòng trọ</option></select></div><div class="field"><label>Diện tích m²</label><input id="rarea" type="number" value="28"></div></div>
      <div class="grid2"><div class="field"><label>Giá thuê</label><input id="rprice" type="number" value="5500000"></div><div class="field"><label>Tiền cọc</label><input id="rdeposit" type="number" value="5500000"></div></div>
      <div class="grid2"><div class="field"><label>Ngày có phòng</label><input id="ravail" type="date" value="${todayISO()}"></div><div class="field"><label>Trạng thái</label><select id="rstatus"><option value="AVAILABLE">Trống</option><option value="COMING_SOON">Sắp trống</option><option value="MAINTENANCE">Đang sửa</option></select></div></div>
      <div class="check-grid"><label class="check"><input id="rbal" type="checkbox"> Có ban công</label><label class="check"><input id="rpet" type="checkbox"> Cho thú cưng</label><label class="check"><input id="rwash" type="checkbox" checked> Máy giặt riêng</label></div>
      <div class="field"><label>Ghi chú nội bộ</label><textarea id="rnote"></textarea></div>
      <div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="saveRoom()">Lưu phòng</button></div>`);
  };

  saveRoom=async function(){
    const code=val('#rcode').trim(),areaId=val('#r-area');
    if(!code) return toast('Nhập mã phòng');
    if(!areaId) return toast('Chọn khu vực');
    const area=state.areas.find(a=>a.id===areaId); if(!area) return toast('Khu vực không hợp lệ');
    try{
      setLoading(true,'Đang lưu phòng…');
      let building=state.buildings.find(b=>b.code===S.compatCode(areaId));
      if(!building){
        const {data,error}=await client.from('buildings').insert({organization_id:state.profile.organization_id,code:S.compatCode(areaId),name:area.name,address:area.name,city:area.city||'TP.HCM',district:area.name,amenities:[],created_by:state.profile.id}).select().single();
        if(error) throw error; building=data;
      }
      const data={area_id:areaId,building_id:building.id,code,room_number:val('#rnum'),room_type:val('#rtype'),title:`${val('#rtype')} ${val('#rnum')}`.trim(),price:Number(val('#rprice')||0),deposit:Number(val('#rdeposit')||0),area:Number(val('#rarea')||0),status:val('#rstatus'),available_date:val('#ravail')||null,max_people:2,max_motorbike:2,furniture:'Full nội thất',amenities:[],pet_policy:checked('#rpet')?'Cho pet':'Không pet',has_balcony:checked('#rbal'),washer_type:checked('#rwash')?'Riêng':'Chung',internal_note:val('#rnote')};
      const {error}=await client.from('rooms').insert({...data,organization_id:state.profile.organization_id,created_by:state.profile.id,updated_by:state.profile.id}); if(error) throw error;
      closeSheet(); state.tab='rooms'; await hydrate(); toast('Đã thêm phòng');
    }catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}
  };
})();
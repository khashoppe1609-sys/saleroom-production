/* SaleRoom v17 — building templates, bulk updates, inventory freshness */
window.SR17=window.SR17||{};
(() => {
  const T=window.SR17;
  T.DAY=86400000;

  T.templates=(areaId='')=>(state.buildings||[])
    .filter(b=>b.template_enabled===true && (!areaId||b.area_id===areaId))
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'vi'));

  T.templateOptions=(areaId='',selected='')=>{
    const rows=T.templates(areaId);
    return '<option value="">Không dùng mẫu · nhập thủ công</option>'+
      rows.map(b=>'<option value="'+b.id+'" '+(b.id===selected?'selected':'')+'>'+
        esc(b.name||b.address||'Mẫu địa chỉ')+(b.address&&b.address!==b.name?' · '+esc(b.address):'')+
      '</option>').join('');
  };

  T.refreshTemplateSelect=(preferred='')=>{
    const areaId=val('#r-area');
    const el=document.querySelector('#r-building-template');
    if(!el)return;
    const current=preferred||el.value||'';
    el.innerHTML=T.templateOptions(areaId,current);
    if(current&&[...el.options].some(o=>o.value===current))el.value=current;
    T.updateTemplateHint(el.value);
  };

  T.updateTemplateHint=id=>{
    const hint=document.getElementById('r-template-hint');
    if(!hint)return;
    const b=(state.buildings||[]).find(x=>x.id===id);
    hint.innerHTML=b
      ? '<b>📍 '+esc(b.name||'Mẫu địa chỉ')+'</b><span>'+esc(b.address||'Chưa nhập địa chỉ')+'</span>'
      : '<span>Chọn mẫu để tự điền điện, nước, dịch vụ, gửi xe, internet, nội thất…</span>';
  };

  T.applyBuildingTemplate=id=>{
    T.updateTemplateHint(id);
    const b=(state.buildings||[]).find(x=>x.id===id);
    if(!b)return;
    const set=(q,v)=>{const el=document.querySelector(q);if(el&&v!==null&&v!==undefined)el.value=Array.isArray(v)?v.join(', '):v};
    set('#relectric',b.default_electric_price);
    set('#rwater',b.default_water_price);
    set('#rservice',b.default_service_fee);
    set('#rparking',b.default_parking_fee);
    set('#rinternet',b.default_internet_fee);
    set('#rfurniture',b.default_furniture);
    set('#ramenities',b.default_amenities||b.amenities||[]);
    set('#rwasher',b.default_washer_type);
    set('#rpetpolicy',b.default_pet_policy);
    set('#rcontract',b.default_contract_months);
    toast('Đã áp dụng mẫu '+(b.name||'địa chỉ'),2500);
  };

  T.refreshEditTemplateSelect=(preferred='')=>{
    const areaId=val('#er-area');
    const el=document.querySelector('#er-building-template');
    if(!el)return;
    const current=preferred||el.value||'';
    el.innerHTML=T.templateOptions(areaId,current);
    if(current&&[...el.options].some(o=>o.value===current))el.value=current;
    T.updateEditTemplateHint(el.value);
  };

  T.updateEditTemplateHint=id=>{
    const hint=document.getElementById('er-template-hint');
    if(!hint)return;
    const b=(state.buildings||[]).find(x=>x.id===id);
    hint.innerHTML=b
      ? '<b>📍 '+esc(b.name||'Mẫu địa chỉ')+'</b><span>'+esc(b.address||'Chưa nhập địa chỉ')+'</span>'
      : '<span>Không dùng mẫu: phòng sẽ dùng địa chỉ nền của Khu vực.</span>';
  };

  T.applyEditBuildingTemplate=id=>{
    T.updateEditTemplateHint(id);
    const b=(state.buildings||[]).find(x=>x.id===id);
    if(!b)return;
    const set=(q,v)=>{const el=document.querySelector(q);if(el&&v!==null&&v!==undefined)el.value=Array.isArray(v)?v.join(', '):v};
    set('#erelectric',b.default_electric_price);
    set('#erwater',b.default_water_price);
    set('#erservice',b.default_service_fee);
    set('#erparking',b.default_parking_fee);
    set('#erinternet',b.default_internet_fee);
    set('#erfurniture',b.default_furniture);
    set('#eramenities',b.default_amenities||b.amenities||[]);
    set('#erwasher',b.default_washer_type);
    set('#erpet',b.default_pet_policy);
    set('#ercontract',b.default_contract_months);
    toast('Đã áp dụng mẫu '+(b.name||'địa chỉ'),2200);
  };

  T.captureRoomDraft=()=>{
    const ids=['r-area','r-building-template','rtitle','rnum','rfloor','rtype','rdesc','rprice','rdeposit','relectric','rwater','rservice','rparking','rinternet','rarea','rfurniture','rpeople','rbikes','rwasher','rpetpolicy','ramenities','ravail','rstatus','rcontract','rcommission','rbonus','rnote'];
    const out={};
    ids.forEach(id=>{const el=document.getElementById(id);if(el)out[id]=el.value});
    return out;
  };

  T.restoreRoomDraft=(draft,templateId='')=>{
    if(!draft)return;
    Object.entries(draft).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value??''});
    T.refreshTemplateSelect(templateId||draft['r-building-template']||'');
  };

  T.newBuildingTemplate=(areaId='')=>{
    if(!canManage())return toast('Chỉ Manager/Admin được tạo mẫu địa chỉ');
    T.roomDraft=document.getElementById('r-area')?T.captureRoomDraft():null;
    const selectedArea=areaId||T.roomDraft?.['r-area']||state.areas?.[0]?.id||'';
    T.templateReturnToRoom=!!T.roomDraft;
    showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">MẪU ĐỊA CHỈ</div><h2>Tạo mẫu tòa nhà / địa chỉ</h2><p>Lưu thông tin dùng chung để thêm nhiều phòng nhanh hơn</p></div><button onclick="closeSheet()">✕</button></div>'+
      '<div class="field"><label>Khu vực *</label><select id="bt-area">'+(state.areas||[]).map(a=>'<option value="'+a.id+'" '+(a.id===selectedArea?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Tên mẫu *</label><input id="bt-name" placeholder="Ví dụ: 125 Nguyễn Thị Thập"></div>'+
      '<div class="field"><label>Địa chỉ đầy đủ</label><input id="bt-address" placeholder="125 Nguyễn Thị Thập, Tân Phú, Quận 7"></div>'+
      '<h3 class="form-section-title">💰 Chi phí mặc định</h3>'+
      '<div class="grid2"><div class="field"><label>Điện</label><input id="bt-electric" placeholder="4.000đ/kWh"></div><div class="field"><label>Nước</label><input id="bt-water" placeholder="100.000đ/người"></div></div>'+
      '<div class="grid2"><div class="field"><label>Dịch vụ</label><input id="bt-service" placeholder="200.000đ/phòng"></div><div class="field"><label>Gửi xe</label><input id="bt-parking" placeholder="150.000đ/xe"></div></div>'+
      '<div class="field"><label>Internet</label><input id="bt-internet" placeholder="Miễn phí hoặc 100.000đ/phòng"></div>'+
      '<h3 class="form-section-title">🏠 Mặc định phòng</h3>'+
      '<div class="field"><label>Nội thất</label><input id="bt-furniture" placeholder="Full nội thất"></div>'+
      '<div class="grid2"><div class="field"><label>Máy giặt</label><input id="bt-washer" placeholder="Riêng / chung"></div><div class="field"><label>Thú cưng</label><input id="bt-pet" placeholder="Cho mèo/chó nhỏ…"></div></div>'+
      '<div class="field"><label>Tiện ích chung</label><textarea id="bt-amenities" placeholder="Máy lạnh, Tủ lạnh, Thang máy, Khóa vân tay…"></textarea></div>'+
      '<div class="field"><label>Hợp đồng mặc định (tháng)</label><input id="bt-contract" type="number" inputmode="numeric" placeholder="12"></div>'+
      '<div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="SR17.saveBuildingTemplate()">Lưu mẫu</button></div>');
  };

  T.editBuildingTemplate=id=>{
    if(!canManage())return toast('Chỉ Manager/Admin được sửa mẫu');
    const b=(state.buildings||[]).find(x=>x.id===id);
    if(!b)return toast('Không tìm thấy mẫu');
    T.templateReturnToRoom=false;T.roomDraft=null;
    showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">MẪU ĐỊA CHỈ</div><h2>Sửa mẫu</h2></div><button onclick="closeSheet()">✕</button></div>'+
      '<div class="field"><label>Khu vực *</label><select id="bt-area">'+(state.areas||[]).map(a=>'<option value="'+a.id+'" '+(a.id===b.area_id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Tên mẫu *</label><input id="bt-name" value="'+esc(b.name||'')+'"></div>'+
      '<div class="field"><label>Địa chỉ đầy đủ</label><input id="bt-address" value="'+esc(b.address||'')+'"></div>'+
      '<h3 class="form-section-title">💰 Chi phí mặc định</h3>'+
      '<div class="grid2"><div class="field"><label>Điện</label><input id="bt-electric" value="'+esc(b.default_electric_price||'')+'"></div><div class="field"><label>Nước</label><input id="bt-water" value="'+esc(b.default_water_price||'')+'"></div></div>'+
      '<div class="grid2"><div class="field"><label>Dịch vụ</label><input id="bt-service" value="'+esc(b.default_service_fee||'')+'"></div><div class="field"><label>Gửi xe</label><input id="bt-parking" value="'+esc(b.default_parking_fee||'')+'"></div></div>'+
      '<div class="field"><label>Internet</label><input id="bt-internet" value="'+esc(b.default_internet_fee||'')+'"></div>'+
      '<h3 class="form-section-title">🏠 Mặc định phòng</h3>'+
      '<div class="field"><label>Nội thất</label><input id="bt-furniture" value="'+esc(b.default_furniture||'')+'"></div>'+
      '<div class="grid2"><div class="field"><label>Máy giặt</label><input id="bt-washer" value="'+esc(b.default_washer_type||'')+'"></div><div class="field"><label>Thú cưng</label><input id="bt-pet" value="'+esc(b.default_pet_policy||'')+'"></div></div>'+
      '<div class="field"><label>Tiện ích chung</label><textarea id="bt-amenities">'+esc((b.default_amenities||[]).join(', '))+'</textarea></div>'+
      '<div class="field"><label>Hợp đồng mặc định (tháng)</label><input id="bt-contract" type="number" inputmode="numeric" value="'+esc(b.default_contract_months??'')+'"></div>'+
      '<div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="SR17.saveBuildingTemplate(\''+id+'\')">Lưu thay đổi</button></div>');
  };

  T.saveBuildingTemplate=async(id='')=>{
    const areaId=val('#bt-area'),name=val('#bt-name').trim(),address=val('#bt-address').trim();
    if(!areaId||!name)return toast('Nhập Khu vực và Tên mẫu');
    const area=(state.areas||[]).find(a=>a.id===areaId);
    if(!area)return toast('Khu vực không hợp lệ');
    const amenities=(val('#bt-amenities')||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
    const payload={
      organization_id:state.profile.organization_id,
      area_id:areaId,
      template_enabled:true,
      name,
      address:address||name,
      city:area.city||'TP.HCM',
      district:area.name,
      amenities,
      default_amenities:amenities,
      default_electric_price:val('#bt-electric').trim()||null,
      default_water_price:val('#bt-water').trim()||null,
      default_service_fee:val('#bt-service').trim()||null,
      default_parking_fee:val('#bt-parking').trim()||null,
      default_internet_fee:val('#bt-internet').trim()||null,
      default_furniture:val('#bt-furniture').trim()||null,
      default_washer_type:val('#bt-washer').trim()||null,
      default_pet_policy:val('#bt-pet').trim()||null,
      default_contract_months:val('#bt-contract')?Number(val('#bt-contract')):null,
      updated_at:new Date().toISOString()
    };
    try{
      setLoading(true,'Đang lưu mẫu địa chỉ…');
      let saved;
      if(id){
        const {data,error}=await client.from('buildings').update(payload).eq('id',id).select().single();
        if(error)throw error;saved=data;
      }else{
        const code='TPL-'+(globalThis.crypto?.randomUUID?.()||uid()).replace(/-/g,'').slice(0,12).toUpperCase();
        const {data,error}=await client.from('buildings').insert({...payload,code,created_by:state.profile.id}).select().single();
        if(error)throw error;saved=data;
      }
      closeSheet();
      await syncData(true);
      toast(id?'Đã cập nhật mẫu địa chỉ':'Đã tạo mẫu địa chỉ',3500);
      if(T.templateReturnToRoom&&T.roomDraft){
        const draft=T.roomDraft;T.templateReturnToRoom=false;T.roomDraft=null;
        newRoom();
        requestAnimationFrame(()=>{
          T.restoreRoomDraft(draft,saved.id);
          T.applyBuildingTemplate(saved.id);
        });
      }
    }catch(e){toast(errMessage(e),5500)}
    finally{setLoading(false)}
  };

  T.openBuildingTemplateManager=()=>{
    const rows=T.templates().map(b=>{
      const area=(state.areas||[]).find(a=>a.id===b.area_id);
      return '<div class="template-row"><div><b>🏢 '+esc(b.name||'Mẫu địa chỉ')+'</b><span>'+esc(area?.name||b.district||'')+(b.address?' · '+esc(b.address):'')+'</span></div><div class="template-actions"><button onclick="SR17.editBuildingTemplate(\''+b.id+'\')">Sửa</button><button class="danger-mini" onclick="SR17.disableBuildingTemplate(\''+b.id+'\')">Ẩn</button></div></div>';
    }).join('');
    showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">QUẢN LÝ</div><h2>Mẫu địa chỉ / tòa nhà</h2><p>Thông tin chung dùng lại khi tạo nhiều phòng</p></div><button onclick="closeSheet()">✕</button></div>'+
      (rows||'<div class="empty-mini">Chưa có mẫu địa chỉ.</div>')+
      '<button class="btn primary full mt8" onclick="SR17.newBuildingTemplate()">+ Tạo mẫu địa chỉ</button>');
  };

  T.disableBuildingTemplate=async id=>{
    if(!canManage())return;
    const b=(state.buildings||[]).find(x=>x.id===id);
    if(!confirm('Ẩn mẫu '+(b?.name||'này')+'? Phòng đã dùng mẫu sẽ không bị ảnh hưởng.'))return;
    try{
      const {error}=await client.from('buildings').update({template_enabled:false,updated_at:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
      await syncData(true);T.openBuildingTemplateManager();toast('Đã ẩn mẫu địa chỉ');
    }catch(e){toast(errMessage(e),4500)}
  };

  T.ageDays=room=>{
    const ts=room?.last_verified_at||room?.updated_at||room?.created_at;
    if(!ts)return 9999;
    return Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/T.DAY));
  };
  T.trackFreshness=room=>!['RENTED','HIDDEN'].includes(room?.status);
  T.isStale=room=>T.trackFreshness(room)&&T.ageDays(room)>=14;
  T.needsReview=room=>T.trackFreshness(room)&&T.ageDays(room)>=7;
  T.staleCount=()=> (state.rooms||[]).filter(r=>!r.deleted_at&&T.isStale(r)).length;

  T.freshBadge=room=>{
    if(!T.trackFreshness(room))return '';
    const d=T.ageDays(room);
    if(d>=14)return '<span class="badge inventory-stale">⚠ CẦN XÁC MINH</span>';
    if(d>=7)return '<span class="badge inventory-warning">◷ NÊN KIỂM TRA</span>';
    return '<span class="badge inventory-fresh">✓ MỚI XÁC MINH</span>';
  };

  T.freshRow=room=>{
    if(!T.trackFreshness(room))return '';
    const d=T.ageDays(room);
    const label=d===0?'Hôm nay':d===1?'1 ngày trước':d+' ngày trước';
    const cls=d>=14?'stale':d>=7?'warning':'fresh';
    return '<div class="inventory-fresh-row '+cls+'"><span>Kho xác minh: <b>'+label+'</b></span>'+
      (canManage()?'<button onclick="SR17.verifyRoom(\''+room.id+'\',event)">✓ Xác minh hôm nay</button>':'')+
    '</div>';
  };

  T.verifyRoom=async(id,event)=>{
    event?.stopPropagation?.();
    if(!canManage())return toast('Chỉ Manager/Admin được xác minh phòng');
    try{
      const now=new Date().toISOString();
      const {error}=await client.from('rooms').update({
        last_verified_at:now,
        verified_by:state.profile.id,
        updated_by:state.profile.id
      }).eq('id',id).eq('organization_id',state.profile.organization_id);
      if(error)throw error;
      await syncData(true);toast('Đã xác minh phòng hôm nay',2800);
    }catch(e){toast(errMessage(e),4500)}
  };

  T.toggleStaleFilter=()=>{
    state.filters=state.filters||{};
    state.filters.onlyStale=!state.filters.onlyStale;
    render();
  };

  const oldFiltered=window.filteredRooms;
  window.filteredRooms=function(){
    let rows=oldFiltered();
    if(state.filters?.onlyStale)rows=rows.filter(T.isStale);
    return rows;
  };

  const oldClear=window.clearRoomFilters;
  window.clearRoomFilters=function(){
    oldClear();
    if(state.filters)state.filters.onlyStale=false;
  };

  T.openBulkRoomUpdate=()=>{
    const ids=[...(state.selectedRoomIds||[])];
    if(!canManage())return toast('Chỉ Manager/Admin được cập nhật hàng loạt');
    if(!ids.length)return toast('Chọn ít nhất 1 phòng');
    showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">CẬP NHẬT HÀNG LOẠT</div><h2>'+ids.length+' phòng đã chọn</h2><p>Chỉ các mục được bật mới thay đổi</p></div><button onclick="closeSheet()">✕</button></div>'+
      '<label class="bulk-field"><input id="bulk-status-on" type="checkbox"><span>Trạng thái</span><select id="bulk-status"><option value="AVAILABLE">Trống</option><option value="COMING_SOON">Sắp trống</option><option value="HOLD">Đang giữ</option><option value="DEPOSITED">Đã cọc</option><option value="RENTED">Đã thuê</option><option value="MAINTENANCE">Đang sửa</option><option value="HIDDEN">Ẩn</option></select></label>'+
      '<label class="bulk-field"><input id="bulk-date-on" type="checkbox"><span>Ngày có phòng</span><input id="bulk-date" type="date"></label>'+
      '<label class="bulk-field"><input id="bulk-price-on" type="checkbox"><span>Giá thuê</span><input id="bulk-price" type="number" inputmode="numeric" placeholder="5500000"></label>'+
      '<label class="bulk-field"><input id="bulk-service-on" type="checkbox"><span>Phí dịch vụ</span><input id="bulk-service" placeholder="200.000đ/phòng"></label>'+
      '<label class="bulk-verify"><input id="bulk-verify" type="checkbox" checked><div><b>✓ Xác minh kho hôm nay</b><span>Cập nhật mốc “Lần xác nhận gần nhất” cho toàn bộ phòng đã chọn.</span></div></label>'+
      '<div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="SR17.applyBulkRoomUpdate()">Cập nhật '+ids.length+' phòng</button></div>');
  };

  T.applyBulkRoomUpdate=async()=>{
    const ids=[...(state.selectedRoomIds||[])];
    if(!ids.length)return toast('Không còn phòng được chọn');
    const payload={updated_by:state.profile.id,updated_at:new Date().toISOString()};
    if(checked('#bulk-status-on'))payload.status=val('#bulk-status');
    if(checked('#bulk-date-on'))payload.available_date=val('#bulk-date')||null;
    if(checked('#bulk-price-on'))payload.price=Number(val('#bulk-price')||0);
    if(checked('#bulk-service-on'))payload.service_fee=val('#bulk-service').trim()||null;
    if(checked('#bulk-verify')){
      payload.last_verified_at=new Date().toISOString();
      payload.verified_by=state.profile.id;
    }
    if(Object.keys(payload).length<=2)return toast('Chọn ít nhất một nội dung cần cập nhật');
    try{
      setLoading(true,'Đang cập nhật '+ids.length+' phòng…');
      const {error}=await client.from('rooms').update(payload)
        .in('id',ids).eq('organization_id',state.profile.organization_id);
      if(error)throw error;
      state.selectedRoomIds.clear();
      closeSheet();await syncData(true);
      toast('Đã cập nhật '+ids.length+' phòng',4500);
    }catch(e){toast(errMessage(e),5500)}
    finally{setLoading(false)}
  };

  const prevProfile=window.profileView;
  window.profileView=function(){
    let html=prevProfile();
    if(canManage()){
      const count=T.templates().length;
      const block='<section class="settings-card building-template-card"><div class="section-title compact"><h3>🏢 Mẫu địa chỉ</h3><button onclick="SR17.newBuildingTemplate()">+ Thêm</button></div><p class="muted">'+count+' mẫu đang dùng. Lưu điện/nước/dịch vụ/nội thất chung để tạo phòng nhanh.</p><button class="btn ghost full" onclick="SR17.openBuildingTemplateManager()">Quản lý mẫu địa chỉ</button></section>';
      html=html.replace('</main>',block+'</main>');
    }
    return html;
  };
})();
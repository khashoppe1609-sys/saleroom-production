/* SaleRoom v5 full edit + duplicate phone + room history */
(() => {
  const S=window.SR5;

  S.checkDuplicatePhone=async function(phone,exceptId=null){
    const n=S.phoneNorm(phone);
    if(!LIVE||n.length<8)return null;
    let q=client.from('customers').select('id,name,phone').eq('organization_id',state.profile.organization_id).eq('phone_normalized',n).is('deleted_at',null).limit(1);
    if(exceptId)q=q.neq('id',exceptId);
    const {data,error}=await q;
    if(error)throw error;
    return data?.[0]||null;
  };

  window.newCustomer=function(){
    const areas=(state.areas||[]).map(a=>a.name);
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">CRM</div><h2>Thêm khách hàng</h2></div><button onclick="closeSheet()">✕</button></div>
      <div class="grid2"><div class="field"><label>Họ tên *</label><input id="cn" placeholder="Nguyễn Văn Nam"></div><div class="field"><label>Số điện thoại *</label><input id="cp" inputmode="tel" placeholder="09xxxxxxxx"></div></div>
      <div class="grid2"><div class="field"><label>Zalo</label><input id="czalo" placeholder="SĐT hoặc link Zalo"></div><div class="field"><label>Nguồn khách</label><input id="csource" placeholder="Zalo, Facebook, TikTok..."></div></div>
      <div class="field"><label>Khu vực cần</label><input id="cd" list="area-list-new" placeholder="Ví dụ: Quận 7, Bình Thạnh"><datalist id="area-list-new">${areas.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="grid2"><div class="field"><label>Ngân sách từ</label><input id="cmin" type="number" inputmode="numeric"></div><div class="field"><label>Đến</label><input id="cmax" type="number" inputmode="numeric"></div></div>
      <div class="grid2"><div class="field"><label>Ngày dự kiến vào</label><input id="cmove" type="date"></div><div class="field"><label>Loại phòng cần</label><input id="ctypes" placeholder="Studio, 1PN..."></div></div>
      <div class="grid2"><div class="field"><label>Số người</label><input id="cpeople" type="number" inputmode="numeric"></div><div class="field"><label>Số xe</label><input id="cbikes" type="number" inputmode="numeric"></div></div>
      <div class="check-grid"><label class="check"><input id="cpet" type="checkbox"> Có thú cưng</label><label class="check"><input id="cwash" type="checkbox"> Máy giặt riêng</label></div>
      <div class="field"><label>Yêu cầu bắt buộc</label><input id="cmust" placeholder="Ví dụ: thang máy, cửa sổ, giờ giấc tự do"></div>
      <div class="field"><label>Ghi chú khách</label><textarea id="cnote" placeholder="Thông tin cần nhớ khi tư vấn…"></textarea></div>
      <h3 class="form-section-title">⏰ Nhắc chăm sóc</h3>
      <div class="field"><label>Lịch care tiếp theo</label><input id="cfollow" type="datetime-local"></div>
      <div class="field"><label>Nội dung cần follow</label><input id="cfollow-note" placeholder="Ví dụ: Gọi lại hỏi quyết định sau khi xem phòng"></div>
      <div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="saveCustomer()">Lưu khách</button></div>`);
  };

  window.saveCustomer=async function(){
    const name=val('#cn').trim(),phone=val('#cp').trim();
    if(!name||!phone)return toast('Vui lòng nhập tên và số điện thoại');
    try{
      setLoading(true,'Đang kiểm tra khách hàng…');
      const dup=await S.checkDuplicatePhone(phone);
      if(dup)throw new Error(`SĐT này đã có trong CRM: ${dup.name} · ${dup.phone}`);
      const follow=val('#cfollow');
      const data={
        name,phone,zalo:val('#czalo').trim()||null,source:val('#csource').trim()||null,
        status:'Khách mới',note:val('#cnote').trim()||null,
        next_follow_up_at:follow?new Date(follow).toISOString():null,
        follow_up_note:val('#cfollow-note').trim()||null
      };
      const req={
        districts:(val('#cd')||'').split(',').map(x=>x.trim()).filter(Boolean),
        min_price:val('#cmin')?Number(val('#cmin')):null,
        max_price:val('#cmax')?Number(val('#cmax')):null,
        move_in:val('#cmove')||null,
        people:val('#cpeople')?Number(val('#cpeople')):null,
        bikes:val('#cbikes')?Number(val('#cbikes')):null,
        has_pet:checked('#cpet'),need_balcony:false,need_private_washer:checked('#cwash'),
        room_types:(val('#ctypes')||'').split(',').map(x=>x.trim()).filter(Boolean),
        must_have:(val('#cmust')||'').split(',').map(x=>x.trim()).filter(Boolean)
      };
      const {data:c,error}=await client.from('customers').insert({...data,organization_id:state.profile.organization_id,owner_id:state.profile.id}).select().single();
      if(error)throw error;
      const {error:rErr}=await client.from('customer_requirements').insert({...req,customer_id:c.id,organization_id:state.profile.organization_id});
      if(rErr)throw rErr;
      closeSheet();await syncData(true);toast('Đã thêm khách hàng');
    }catch(e){toast(errMessage(e),5000)}finally{setLoading(false)}
  };

  window.editCustomer=function(id){
    const c=state.customers.find(x=>x.id===id);if(!c)return;
    const r=customerReq(c),areas=(state.areas||[]).map(a=>a.name);
    const follow=c.next_follow_up_at?new Date(new Date(c.next_follow_up_at).getTime()-new Date(c.next_follow_up_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
    const stages=[...new Set([...(typeof CUSTOMER_STAGES!=='undefined'?CUSTOMER_STAGES:[]),c.status,'Không phù hợp','Mất khách'])].filter(Boolean);
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">CHỈNH SỬA CRM</div><h2>${esc(c.name)}</h2></div><button onclick="closeSheet()">✕</button></div>
      <div class="grid2"><div class="field"><label>Họ tên *</label><input id="ecn" value="${esc(c.name||'')}"></div><div class="field"><label>Số điện thoại *</label><input id="ecp" inputmode="tel" value="${esc(c.phone||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Zalo</label><input id="eczalo" value="${esc(c.zalo||'')}"></div><div class="field"><label>Nguồn khách</label><input id="ecsource" value="${esc(c.source||'')}"></div></div>
      <div class="field"><label>Trạng thái</label><select id="ecstatus">${stages.map(x=>`<option ${x===c.status?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Khu vực cần</label><input id="ecd" list="area-list-edit" value="${esc((r.districts||[]).join(', '))}"><datalist id="area-list-edit">${areas.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="grid2"><div class="field"><label>Ngân sách từ</label><input id="ecmin" type="number" value="${esc(r.min_price||'')}"></div><div class="field"><label>Đến</label><input id="ecmax" type="number" value="${esc(r.max_price||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Ngày dự kiến vào</label><input id="ecmove" type="date" value="${esc(r.move_in||'')}"></div><div class="field"><label>Loại phòng cần</label><input id="ectypes" value="${esc((r.room_types||[]).join(', '))}"></div></div>
      <div class="grid2"><div class="field"><label>Số người</label><input id="ecpeople" type="number" value="${esc(r.people||'')}"></div><div class="field"><label>Số xe</label><input id="ecbikes" type="number" value="${esc(r.bikes||'')}"></div></div>
      <div class="check-grid"><label class="check"><input id="ecpet" type="checkbox" ${r.has_pet?'checked':''}> Có thú cưng</label><label class="check"><input id="ecwash" type="checkbox" ${r.need_private_washer?'checked':''}> Máy giặt riêng</label></div>
      <div class="field"><label>Yêu cầu bắt buộc</label><input id="ecmust" value="${esc((r.must_have||[]).join(', '))}"></div>
      <div class="field"><label>Ghi chú khách</label><textarea id="ecnote">${esc(c.note||'')}</textarea></div>
      <h3 class="form-section-title">⏰ Nhắc chăm sóc</h3>
      <div class="field"><label>Lịch care tiếp theo</label><input id="ecfollow" type="datetime-local" value="${follow}"></div>
      <div class="field"><label>Nội dung cần follow</label><input id="ecfollow-note" value="${esc(c.follow_up_note||'')}"></div>
      <div class="sheet-actions"><button class="btn ghost" onclick="openCustomer('${id}')">Hủy</button><button class="btn primary" onclick="saveCustomerEdit('${id}')">Lưu thay đổi</button></div>`);
  };

  window.saveCustomerEdit=async function(id){
    const name=val('#ecn').trim(),phone=val('#ecp').trim();if(!name||!phone)return toast('Tên và SĐT không được để trống');
    try{
      setLoading(true,'Đang lưu khách hàng…');
      const dup=await S.checkDuplicatePhone(phone,id);
      if(dup)throw new Error(`SĐT này đã thuộc khách: ${dup.name}`);
      const follow=val('#ecfollow');
      const {error}=await client.from('customers').update({
        name,phone,zalo:val('#eczalo').trim()||null,source:val('#ecsource').trim()||null,
        status:val('#ecstatus'),note:val('#ecnote').trim()||null,
        next_follow_up_at:follow?new Date(follow).toISOString():null,
        follow_up_note:val('#ecfollow-note').trim()||null,updated_at:new Date().toISOString()
      }).eq('id',id);
      if(error)throw error;
      const req={
        customer_id:id,organization_id:state.profile.organization_id,
        districts:(val('#ecd')||'').split(',').map(x=>x.trim()).filter(Boolean),
        min_price:val('#ecmin')?Number(val('#ecmin')):null,max_price:val('#ecmax')?Number(val('#ecmax')):null,
        move_in:val('#ecmove')||null,people:val('#ecpeople')?Number(val('#ecpeople')):null,bikes:val('#ecbikes')?Number(val('#ecbikes')):null,
        has_pet:checked('#ecpet'),need_balcony:false,need_private_washer:checked('#ecwash'),
        room_types:(val('#ectypes')||'').split(',').map(x=>x.trim()).filter(Boolean),
        must_have:(val('#ecmust')||'').split(',').map(x=>x.trim()).filter(Boolean),updated_at:new Date().toISOString()
      };
      const {error:rErr}=await client.from('customer_requirements').upsert(req,{onConflict:'customer_id'});if(rErr)throw rErr;
      await syncData(true);openCustomer(id);toast('Đã cập nhật khách hàng');
    }catch(e){toast(errMessage(e),5000)}finally{setLoading(false)}
  };

  const prevOpenCustomerV5=openCustomer;
  openCustomer=async function(id){
    await prevOpenCustomerV5(id);
    requestAnimationFrame(()=>{
      const sheet=document.querySelector('.sheet');if(!sheet)return;
      if(!sheet.querySelector('.customer-edit-btn')){
        const b=document.createElement('button');b.className='btn ghost full customer-edit-btn';b.textContent='✏️ Sửa toàn bộ thông tin khách';b.onclick=()=>editCustomer(id);
        const head=sheet.querySelector('.sheet-head');head?.insertAdjacentElement('afterend',b);
      }
    });
  };

  window.editRoom=function(id){
    const raw=state.rooms.find(x=>x.id===id);if(!raw)return;const r=normalizeRoom(raw);
    const areaId=raw.area_id||S?.areaForRoom?.(raw)?.id||'';
    const statuses=[['AVAILABLE','Trống'],['COMING_SOON','Sắp trống'],['HOLD','Đang giữ'],['DEPOSITED','Đã cọc'],['RENTED','Đã thuê'],['MAINTENANCE','Đang sửa'],['HIDDEN','Ẩn']];
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">CHỈNH SỬA PHÒNG</div><h2>${esc(r.title||r.room_number||'Phòng')}</h2></div><button onclick="closeSheet()">✕</button></div>
      <div class="field"><label>Khu vực *</label><select id="er-area">${(state.areas||[]).map(a=>`<option value="${a.id}" ${a.id===areaId?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div class="grid2"><div class="field"><label>Tên phòng / tiêu đề</label><input id="ertitle" value="${esc(r.title||'')}"></div><div class="field"><label>Số phòng</label><input id="ernum" value="${esc(r.room_number||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Tầng</label><input id="erfloor" value="${esc(r.floor||'')}"></div><div class="field"><label>Loại phòng</label><input id="ertype" value="${esc(r.room_type||'')}"></div></div>
      <div class="field"><label>Mô tả gửi khách</label><textarea id="erdesc">${esc(r.description||'')}</textarea></div>
      <h3 class="form-section-title">💰 Giá & chi phí</h3>
      <div class="grid2"><div class="field"><label>Giá thuê</label><input id="erprice" type="number" value="${esc(r.price||'')}"></div><div class="field"><label>Tiền cọc</label><input id="erdeposit" type="number" value="${esc(r.deposit||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Điện</label><input id="erelectric" value="${esc(r.electric_price||'')}"></div><div class="field"><label>Nước</label><input id="erwater" value="${esc(r.water_price||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Dịch vụ</label><input id="erservice" value="${esc(r.service_fee||'')}"></div><div class="field"><label>Gửi xe</label><input id="erparking" value="${esc(r.parking_fee||'')}"></div></div>
      <div class="field"><label>Internet</label><input id="erinternet" value="${esc(r.internet_fee||'')}"></div>
      <h3 class="form-section-title">🏠 Thông tin phòng</h3>
      <div class="grid2"><div class="field"><label>Diện tích m²</label><input id="erarea" type="number" step="0.1" value="${esc(r.area||'')}"></div><div class="field"><label>Nội thất</label><input id="erfurniture" value="${esc(r.furniture||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Số người tối đa</label><input id="erpeople" type="number" value="${esc(r.max_people||'')}"></div><div class="field"><label>Số xe tối đa</label><input id="erbikes" type="number" value="${esc(r.max_motorbike||'')}"></div></div>
      <div class="grid2"><div class="field"><label>Máy giặt</label><input id="erwasher" value="${esc(r.washer_type||'')}"></div><div class="field"><label>Chính sách thú cưng</label><input id="erpet" value="${esc(r.pet_policy||'')}"></div></div>
      <div class="field"><label>Tiện ích</label><textarea id="eramenities">${esc((r.amenities||[]).join(', '))}</textarea></div>
      <h3 class="form-section-title">📅 Trạng thái & hợp đồng</h3>
      <div class="grid2"><div class="field"><label>Ngày có phòng</label><input id="eravail" type="date" value="${esc(r.available_date||'')}"></div><div class="field"><label>Trạng thái</label><select id="erstatus">${statuses.map(([v,l])=>`<option value="${v}" ${v===r.status?'selected':''}>${l}</option>`).join('')}</select></div></div>
      <div class="field"><label>Hợp đồng (tháng)</label><input id="ercontract" type="number" value="${esc(r.contract_months||'')}"></div>
      <h3 class="form-section-title">💼 Nội bộ</h3>
      <div class="grid2"><div class="field"><label>Hoa hồng</label><input id="ercommission" value="${esc(r.commission_note||'')}"></div><div class="field"><label>Thưởng thêm</label><input id="erbonus" type="number" value="${esc(r.bonus||'')}"></div></div>
      <div class="field"><label>Ghi chú nội bộ</label><textarea id="ernote">${esc(r.internal_note||'')}</textarea></div>
      <div class="sheet-actions"><button class="btn ghost" onclick="openRoom('${id}')">Hủy</button><button class="btn primary" onclick="saveRoomEdit('${id}')">Lưu thay đổi</button></div>`);
  };

  window.saveRoomEdit=async function(id){
    const areaId=val('#er-area');const area=(state.areas||[]).find(a=>a.id===areaId);if(!area)return toast('Chọn khu vực');
    try{
      setLoading(true,'Đang lưu phòng…');
      let building=state.buildings.find(b=>b.code===window.SR3.compatCode(areaId));
      if(!building){
        const {data,error}=await client.from('buildings').insert({organization_id:state.profile.organization_id,code:window.SR3.compatCode(areaId),name:area.name,address:area.name,city:area.city||'TP.HCM',district:area.name,amenities:[],created_by:state.profile.id}).select().single();
        if(error)throw error;building=data;
      }
      const amenities=(val('#eramenities')||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
      const payload={
        area_id:areaId,building_id:building.id,title:val('#ertitle').trim()||null,room_number:val('#ernum').trim()||null,
        floor:val('#erfloor').trim()||null,room_type:val('#ertype').trim()||null,description:val('#erdesc').trim()||null,
        price:Number(val('#erprice')||0),deposit:Number(val('#erdeposit')||0),electric_price:val('#erelectric').trim()||null,
        water_price:val('#erwater').trim()||null,service_fee:val('#erservice').trim()||null,parking_fee:val('#erparking').trim()||null,
        internet_fee:val('#erinternet').trim()||null,area:val('#erarea')?Number(val('#erarea')):null,furniture:val('#erfurniture').trim()||null,
        max_people:val('#erpeople')?Number(val('#erpeople')):null,max_motorbike:val('#erbikes')?Number(val('#erbikes')):null,
        washer_type:val('#erwasher').trim()||null,pet_policy:val('#erpet').trim()||null,amenities,has_balcony:false,
        available_date:val('#eravail')||null,status:val('#erstatus'),contract_months:val('#ercontract')?Number(val('#ercontract')):null,
        commission_note:val('#ercommission').trim()||null,bonus:val('#erbonus')?Number(val('#erbonus')):0,internal_note:val('#ernote').trim()||null,
        updated_by:state.profile.id,updated_at:new Date().toISOString()
      };
      const {error}=await client.from('rooms').update(payload).eq('id',id);if(error)throw error;
      await syncData(true);openRoom(id);toast('Đã cập nhật phòng');
    }catch(e){toast(errMessage(e),5000)}finally{setLoading(false)}
  };

  S.historyLabels={title:'Tên phòng',room_number:'Số phòng',floor:'Tầng',room_type:'Loại phòng',description:'Mô tả',price:'Giá thuê',deposit:'Tiền cọc',area:'Diện tích',status:'Trạng thái',available_date:'Ngày có phòng',max_people:'Số người',max_motorbike:'Số xe',furniture:'Nội thất',amenities:'Tiện ích',pet_policy:'Thú cưng',washer_type:'Máy giặt',electric_price:'Điện',water_price:'Nước',service_fee:'Dịch vụ',parking_fee:'Gửi xe',internet_fee:'Internet',contract_months:'Hợp đồng',commission_note:'Hoa hồng',bonus:'Thưởng',internal_note:'Ghi chú nội bộ',area_id:'Khu vực'};
  S.historySummary=function(h){
    const skip=new Set(['updated_at','updated_by','created_at','created_by','organization_id','building_id','code','deleted_at','deleted_by','deleted_prev_status']);
    const out=[];
    for(const [k,label] of Object.entries(S.historyLabels)){
      if(skip.has(k))continue;
      if(JSON.stringify(h.old_data?.[k])!==JSON.stringify(h.new_data?.[k]))out.push(label);
    }
    return out.slice(0,5).join(', ')||'Cập nhật phòng';
  };
  S.loadRoomHistory=async function(id){
    const {data,error}=await client.from('room_change_history').select('*').eq('room_id',id).order('changed_at',{ascending:false}).limit(20);
    if(error)return;
    const sheet=document.querySelector('.sheet');if(!sheet||sheet.querySelector('.room-history'))return;
    const rows=(data||[]).map(h=>{const who=(state.team||[]).find(x=>x.id===h.changed_by)?.full_name||'Người dùng';return `<div class="history-row"><b>${esc(S.historySummary(h))}</b><span>${esc(who)} · ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(h.changed_at))}</span></div>`}).join('');
    const sec=document.createElement('section');sec.className='room-history';sec.innerHTML=`<div class="section-title compact"><h3>🕘 Lịch sử thay đổi</h3></div>${rows||'<div class="empty-mini">Chưa có thay đổi nào.</div>'}`;
    const sticky=sheet.querySelector('.sticky-cta');sticky?sticky.before(sec):sheet.appendChild(sec);
  };

  const prevOpenRoomV5=openRoom;
  openRoom=function(id){
    prevOpenRoomV5(id);
    requestAnimationFrame(()=>{
      const sheet=document.querySelector('.sheet');if(!sheet)return;
      const tools=sheet.querySelector('.room-extra-tools')||sheet;
      if(!sheet.querySelector('.room-edit-full')){
        const b=document.createElement('button');b.className='btn primary room-edit-full';b.textContent='✏️ Sửa phòng';b.onclick=()=>editRoom(id);
        tools.prepend(b);
      }
      S.loadRoomHistory(id);
    });
  };
})();
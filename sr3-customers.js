/* SaleRoom v3 customers: care timeline + send whole area */
(() => {
  const S=window.SR3;
  const oldOpenCustomer=openCustomer;
  openCustomer=async function(id){
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    oldOpenCustomer(id);
    if(!LIVE) return;
    try{
      const {data,error}=await client.from('customer_care_notes').select('*').eq('customer_id',id).order('created_at',{ascending:false});
      if(error) throw error;
      const sheet=document.querySelector('.sheet'); if(!sheet) return;
      const req=customerReq(c), districts=req.districts||[];
      const areaButtons=districts.map(d=>{const count=state.rooms.filter(r=>r.status==='AVAILABLE'&&normalizeRoom(r).district===d).length;return `<button class="area-care-btn" ${count?'':'disabled'} onclick="createAreaCatalog('${S.js(d)}','${c.id}')">📤 Gửi cả ${esc(d)} <span>${count} phòng trống</span></button>`}).join('');
      const notes=(data||[]).map(n=>{const author=state.team.find(m=>m.id===n.author_id)?.full_name||'Sale';return `<div class="care-note"><div class="care-note-head"><b>${esc(author)}</b><span>${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(n.created_at))}</span><button onclick="deleteCareNote('${n.id}','${c.id}')">🗑</button></div><p>${esc(n.note)}</p></div>`}).join('')||'<div class="empty-mini">Chưa có lịch sử chăm sóc.</div>';
      const block=document.createElement('section');block.className='care-block';block.innerHTML=`<div class="section-title compact"><h3>📍 Gửi theo khu vực khách cần</h3></div>${areaButtons||'<p class="muted">Khách chưa chọn khu vực.</p>'}<div class="section-title care-title"><h3>📝 Lịch sử chăm sóc</h3><span>${(data||[]).length} ghi chú</span></div><div class="care-add"><textarea id="care-note-input" placeholder="Ví dụ: 18:00 gọi khách, khách hẹn mai phản hồi…"></textarea><button class="btn primary" onclick="saveCareNote('${c.id}')">+ Thêm ghi chú</button></div><div class="care-timeline">${notes}</div>`;
      const sticky=sheet.querySelector('.sticky-cta'); sticky?sticky.before(block):sheet.appendChild(block);
    }catch(e){toast(errMessage(e),3500)}
  };

  window.saveCareNote=async function(customerId){
    const note=val('#care-note-input').trim(); if(!note)return toast('Nhập nội dung ghi chú');
    try{setLoading(true,'Đang lưu ghi chú…');const {error}=await client.from('customer_care_notes').insert({organization_id:state.profile.organization_id,customer_id:customerId,author_id:state.profile.id,note});if(error)throw error;await openCustomer(customerId);toast('Đã thêm ghi chú care')}catch(e){toast(errMessage(e),4000)}finally{setLoading(false)}
  };
  window.deleteCareNote=async function(id,customerId){
    if(!confirm('Xóa ghi chú chăm sóc này?'))return;
    try{const {error}=await client.from('customer_care_notes').delete().eq('id',id);if(error)throw error;await openCustomer(customerId);toast('Đã xóa ghi chú')}catch(e){toast(errMessage(e),3500)}
  };
})();
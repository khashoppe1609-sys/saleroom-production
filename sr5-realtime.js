/* SaleRoom v5 realtime + trash */
window.SR5 = window.SR5 || {};
(() => {
  const S=window.SR5;
  S.channel=S.channel||null;
  S.realtimeTimer=null;
  S.phoneNorm=v=>String(v||'').replace(/\D/g,'');
  S.activeRooms=()=> (state.rooms||[]).filter(r=>!r.deleted_at);
  S.activeCustomers=()=> (state.customers||[]).filter(c=>!c.deleted_at);

  const prevHydrateV5=hydrate;
  hydrate=async function(){
    await prevHydrateV5();
    state.rooms=S.activeRooms();
    state.customers=S.activeCustomers();
    if(state.profile){
      S.ensureRealtime();
      render();
    }
  };

  S.ensureRealtime=function(){
    if(!LIVE||!state.profile||S.channel) return;
    const tables=['rooms','room_images','customers','customer_requirements','appointments','room_holds','commissions','catalog_feedback','customer_care_notes','areas'];
    let ch=client.channel('saleroom-v5-live');
    for(const table of tables){
      ch=ch.on('postgres_changes',{event:'*',schema:'public',table},()=>{
        clearTimeout(S.realtimeTimer);
        S.realtimeTimer=setTimeout(()=>syncData(true),500);
      });
    }
    S.channel=ch.subscribe(status=>{
      if(status==='SUBSCRIBED') console.info('SaleRoom realtime connected');
    });
  };

  window.deleteRoom=async function(id,e){
    try{e?.stopPropagation?.()}catch{}
    if(state.profile?.role!=='admin') return toast('Chỉ Admin được xóa phòng');
    const r=state.rooms.find(x=>x.id===id); if(!r)return;
    if(!confirm('Đưa phòng này vào Thùng rác? Bạn có thể khôi phục lại sau.'))return;
    try{
      setLoading(true,'Đang đưa phòng vào Thùng rác…');
      const {error}=await client.from('rooms').update({
        deleted_at:new Date().toISOString(),
        deleted_by:state.profile.id,
        deleted_prev_status:r.status,
        status:'HIDDEN',
        updated_by:state.profile.id
      }).eq('id',id);
      if(error)throw error;
      try{closeSheet()}catch{}
      await syncData(true); toast('Đã đưa phòng vào Thùng rác');
    }catch(err){toast(errMessage(err),4500)}finally{setLoading(false)}
  };

  window.deleteCustomer=async function(id,e){
    try{e?.stopPropagation?.()}catch{}
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    if(!confirm('Đưa khách hàng này vào Thùng rác? Bạn có thể khôi phục lại sau.'))return;
    try{
      setLoading(true,'Đang đưa khách vào Thùng rác…');
      const {error}=await client.from('customers').update({
        deleted_at:new Date().toISOString(),
        deleted_by:state.profile.id
      }).eq('id',id);
      if(error)throw error;
      try{closeSheet()}catch{}
      await syncData(true); toast('Đã đưa khách vào Thùng rác');
    }catch(err){toast(errMessage(err),4500)}finally{setLoading(false)}
  };

  window.openTrash=async function(){
    if(!LIVE)return;
    try{
      setLoading(true,'Đang mở Thùng rác…');
      const [rooms,customers]=await Promise.all([
        client.from('rooms').select('id,title,room_number,code,deleted_at,status,deleted_prev_status,building_id').not('deleted_at','is',null).order('deleted_at',{ascending:false}),
        client.from('customers').select('id,name,phone,deleted_at').not('deleted_at','is',null).order('deleted_at',{ascending:false})
      ]);
      if(rooms.error)throw rooms.error;if(customers.error)throw customers.error;
      const roomRows=(rooms.data||[]).map(r=>`<div class="trash-row"><div><b>🏠 ${esc(r.title||r.room_number||r.code||'Phòng')}</b><span>Xóa lúc ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(r.deleted_at))}</span></div><div><button onclick="restoreTrashRoom('${r.id}')">↩ Khôi phục</button><button class="danger-mini" onclick="purgeTrashRoom('${r.id}')">Xóa hẳn</button></div></div>`).join('');
      const customerRows=(customers.data||[]).map(c=>`<div class="trash-row"><div><b>👤 ${esc(c.name)}</b><span>${esc(c.phone)} · xóa lúc ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(c.deleted_at))}</span></div><div><button onclick="restoreTrashCustomer('${c.id}')">↩ Khôi phục</button><button class="danger-mini" onclick="purgeTrashCustomer('${c.id}')">Xóa hẳn</button></div></div>`).join('');
      showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">AN TOÀN DỮ LIỆU</div><h2>Thùng rác</h2></div><button onclick="closeSheet()">✕</button></div><h3 class="subhead">Phòng</h3>${roomRows||'<div class="empty-mini">Không có phòng đã xóa.</div>'}<h3 class="subhead">Khách hàng</h3>${customerRows||'<div class="empty-mini">Không có khách đã xóa.</div>'}`);
    }catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}
  };

  window.restoreTrashRoom=async function(id){
    try{
      const {data:r,error:e1}=await client.from('rooms').select('deleted_prev_status').eq('id',id).single();if(e1)throw e1;
      const {error}=await client.from('rooms').update({deleted_at:null,deleted_by:null,status:r.deleted_prev_status||'AVAILABLE',deleted_prev_status:null,updated_by:state.profile.id}).eq('id',id);if(error)throw error;
      await syncData(true);closeSheet();toast('Đã khôi phục phòng');
    }catch(e){toast(errMessage(e),4500)}
  };
  window.restoreTrashCustomer=async function(id){
    try{const {error}=await client.from('customers').update({deleted_at:null,deleted_by:null}).eq('id',id);if(error)throw error;await syncData(true);closeSheet();toast('Đã khôi phục khách')}catch(e){toast(errMessage(e),4500)}
  };
  window.purgeTrashRoom=async function(id){
    if(state.profile?.role!=='admin')return toast('Chỉ Admin được xóa hẳn');
    if(!confirm('Xóa vĩnh viễn phòng này và ảnh liên quan? Không thể khôi phục.'))return;
    try{
      setLoading(true,'Đang xóa vĩnh viễn…');
      const {data:imgs}=await client.from('room_images').select('storage_path').eq('room_id',id);
      const paths=(imgs||[]).map(x=>x.storage_path).filter(Boolean);
      if(paths.length)await client.storage.from('room-media').remove(paths);
      const {error}=await client.from('rooms').delete().eq('id',id);if(error)throw error;
      closeSheet();toast('Đã xóa vĩnh viễn phòng');
    }catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}
  };
  window.purgeTrashCustomer=async function(id){
    if(state.profile?.role!=='admin')return toast('Chỉ Admin được xóa hẳn');
    if(!confirm('Xóa vĩnh viễn khách hàng này? Không thể khôi phục.'))return;
    try{const {error}=await client.from('customers').delete().eq('id',id);if(error)throw error;closeSheet();toast('Đã xóa vĩnh viễn khách')}catch(e){toast(errMessage(e),4500)}
  };

  const prevProfileViewV5Trash=profileView;
  profileView=function(){
    let html=prevProfileViewV5Trash();
    const block=`<section class="settings-card"><h3>🗑 Thùng rác</h3><p class="muted">Phòng và khách đã xóa có thể khôi phục trước khi xóa vĩnh viễn.</p><button class="btn ghost full" onclick="openTrash()">Mở Thùng rác</button></section>`;
    return html.replace('</main>',block+'</main>');
  };
})();
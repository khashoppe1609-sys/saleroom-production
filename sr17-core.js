/* SaleRoom v3 core: areas, area catalogs, extra data */
window.SR3 = window.SR3 || {};
(() => {
  const S = window.SR3;
  state.areas = state.areas || [];
  state.catalogLeads = state.catalogLeads || [];

  S.areaForRoom = r => state.areas.find(a => a.id === r?.area_id) || null;
  S.areaName = r => S.areaForRoom(r)?.name || r?.district || r?.buildings?.district || 'Chưa phân khu';
  S.compatCode = areaId => `AREA-${String(areaId || '').slice(0,8)}`;
  S.js = v => encodeURIComponent(String(v || ''));
  S.unjs = v => decodeURIComponent(v || '');

  const oldNormalizeRoom = normalizeRoom;
  normalizeRoom = function(r){
    const o = oldNormalizeRoom(r || {});
    const a = S.areaForRoom(r || o);
    const areaName = a?.name || o.district || '';
    return {...o, area_name:areaName, district:areaName};
  };

  S.loadExtras = async function(){
    if(!LIVE || !state.profile?.organization_id) return;
    try{
      const [areas, feedback] = await Promise.all([
        client.from('areas').select('*').eq('is_active',true).order('sort_order').order('name'),
        client.from('catalog_feedback').select('*').order('created_at',{ascending:false}).limit(100)
      ]);
      if(!areas.error) state.areas = areas.data || [];
      if(!feedback.error) state.catalogLeads = feedback.data || [];
    } catch(e){ console.warn('SR3 extras', e); }
  };

  const oldHydrate = hydrate;
  hydrate = async function(){
    await oldHydrate();
    await S.loadExtras();
    if(state.profile) render();
  };

  window.createAreaCatalog = async function(encodedArea, customerId=null){
    const area = S.unjs(encodedArea);
    const ids = state.rooms.filter(r => r.status === 'AVAILABLE' && normalizeRoom(r).district === area).map(r => r.id);
    if(!ids.length) return toast(`Khu vực ${area} hiện không có phòng trống`);
    try{
      setLoading(true, `Đang tạo catalog ${area}…`);
      let link;
      if(LIVE){
        const {data:token,error}=await client.rpc('create_catalog',{p_customer_id:customerId||null,p_room_ids:ids,p_title:`Phòng trống khu vực ${area}`});
        if(error) throw error;
        const base=(cfg.APP_URL||`${location.origin}${location.pathname}`).replace(/\/$/,'');
        link=`${base}?catalog=${encodeURIComponent(token)}`;
      } else {
        const token='demo-'+uid();
        localStorage.setItem(`saleroom_catalog_${token}`,JSON.stringify({token,roomIds:ids,customerId,createdAt:new Date().toISOString()}));
        link=`${location.origin}${location.pathname}?catalog=${encodeURIComponent(token)}`;
      }
      state.selectedRoomIds.clear();
      try{closeSheet()}catch{}
      showShareSheet(link,ids.length);
    }catch(e){ toast(errMessage(e),4500); }
    finally{ setLoading(false); }
  };

  window.newArea = function(){
    if(!canManage()) return toast('Chỉ Manager/Admin được thêm khu vực');
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">KHO PHÒNG</div><h2>Thêm khu vực</h2></div><button onclick="closeSheet()">✕</button></div>
      <div class="field"><label>Tên khu vực *</label><input id="area-name" placeholder="Ví dụ: Quận 7, Bình Thạnh, Thủ Đức"></div>
      <div class="field"><label>Thành phố</label><input id="area-city" value="TP.HCM"></div>
      <div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn primary" onclick="saveArea()">Lưu khu vực</button></div>`);
  };
  window.newBuilding = window.newArea;

  window.saveArea = async function(){
    const name=val('#area-name').trim(), city=val('#area-city').trim()||'TP.HCM';
    if(!name) return toast('Nhập tên khu vực');
    try{
      setLoading(true,'Đang lưu khu vực…');
      const {data:a,error}=await client.from('areas').insert({organization_id:state.profile.organization_id,name,city,created_by:state.profile.id}).select().single();
      if(error) throw error;
      const code=S.compatCode(a.id);
      const {error:bErr}=await client.from('buildings').insert({organization_id:state.profile.organization_id,area_id:a.id,template_enabled:false,code,name,address:name,city,district:name,amenities:[],created_by:state.profile.id});
      if(bErr && !String(bErr.message||'').toLowerCase().includes('duplicate')) throw bErr;
      closeSheet();
      await hydrate();
      toast(`Đã thêm khu vực ${name}`);
    }catch(e){toast(errMessage(e),4000)}finally{setLoading(false)}
  };

  window.openAreaManager = function(){
    const rows=(state.areas||[]).map(a=>`<div class="manage-row"><div><b>📍 ${esc(a.name)}</b><span>${esc(a.city||'')}</span></div>${state.profile?.role==='admin'?`<button onclick="deleteArea('${a.id}',event)">🗑 Xóa</button>`:''}</div>`).join('')||'<p class="muted">Chưa có khu vực</p>';
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">QUẢN LÝ</div><h2>Khu vực</h2></div><button onclick="closeSheet()">✕</button></div>${rows}<button class="btn primary full mt8" onclick="newArea()">+ Thêm khu vực</button>`);
  };

  window.deleteArea = async function(id,e){
    try{e?.stopPropagation?.()}catch{}
    if(state.profile?.role!=='admin') return toast('Chỉ Admin được xóa khu vực');
    const area=state.areas.find(a=>a.id===id);
    if(!confirm(`Xóa khu vực ${area?.name||''}?\n\nPhòng cũ không bị xóa, chỉ mất liên kết khu vực.`)) return;
    try{
      setLoading(true,'Đang xóa khu vực…');
      const {error}=await client.from('areas').delete().eq('id',id); if(error) throw error;
      closeSheet(); await hydrate(); toast('Đã xóa khu vực');
    }catch(err){toast(errMessage(err),4000)}finally{setLoading(false)}
  };

  const currentProfileView = profileView;
  profileView = function(){
    let html=currentProfileView();
    html=html.replace(/\+ Tòa nhà/g,'+ Khu vực');
    if(canManage()){
      const areaSection=`<section class="settings-card area-admin-card"><div class="section-title compact"><h3>📍 Khu vực</h3><button onclick="newArea()">+ Thêm</button></div><p class="muted">${state.areas.length} khu vực đang dùng cho kho phòng.</p><button class="btn ghost full" onclick="openAreaManager()">Quản lý khu vực</button></section>`;
      html=html.replace('</main>',areaSection+'</main>');
    }
    return html;
  };

  setTimeout(async()=>{if(state.profile){await S.loadExtras();render()}},500);
  setTimeout(async()=>{if(state.profile && !state.areas.length){await S.loadExtras();render()}},1600);
})();
/* v4 cross-device sync */
(() => {
  let syncing=false,lastAuto=0;

  window.syncData = async function(silent=false){
    if(!LIVE || !state.profile || syncing) return;
    syncing=true;
    try{
      if(!silent) setLoading(true,'Đang đồng bộ dữ liệu…');
      await hydrate();
      state.lastSyncedAt=new Date().toISOString();
      if(!silent) toast('Đã đồng bộ dữ liệu mới nhất');
    }catch(e){
      if(!silent) toast(errMessage(e),4000);
    }finally{
      syncing=false;
      if(!silent) setLoading(false);
    }
  };

  function ensureSyncButton(){
    const isPublic=new URLSearchParams(location.search).has('catalog');
    let btn=document.getElementById('sr-sync-btn');
    if(isPublic || !state.profile){
      btn?.remove();
      return;
    }
    if(!btn){
      btn=document.createElement('button');
      btn.id='sr-sync-btn';
      btn.className='sync-floating';
      btn.innerHTML='↻ <span>Đồng bộ</span>';
      btn.onclick=()=>syncData(false);
      document.body.appendChild(btn);
    }
  }

  async function autoSync(){
    const now=Date.now();
    if(now-lastAuto<2500 || document.hidden || !state.profile) return;
    lastAuto=now;
    await syncData(true);
  }

  window.addEventListener('focus',autoSync);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) autoSync(); });
  new MutationObserver(ensureSyncButton).observe(document.getElementById('app'),{childList:true,subtree:true});
  setTimeout(ensureSyncButton,500);
})();

/* v4 admin clear operational data */
(() => {
  window.openClearDataSheet = function(){
    if(state.profile?.role!=='admin') return toast('Chỉ Admin được dùng chức năng này');
    showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">ADMIN</div><h2>Xóa trắng dữ liệu</h2></div><button onclick="closeSheet()">✕</button></div>
      <div class="danger-note"><b>⚠️ Thao tác không thể hoàn tác.</b><br>Xóa phòng, ảnh, khu vực, khách hàng, lịch hẹn, catalog, giữ phòng, hoa hồng và lịch sử care. Tài khoản người dùng và tổ chức SaleRoom vẫn được giữ.</div>
      <div class="field"><label>Nhập <b>XOA TRANG</b> để xác nhận</label><input id="clear-data-confirm" autocomplete="off" placeholder="XOA TRANG"></div>
      <div class="sheet-actions"><button class="btn ghost" onclick="closeSheet()">Hủy</button><button class="btn danger-soft" onclick="runClearData()">🗑 XÓA TRẮNG DỮ LIỆU</button></div>`);
  };

  window.runClearData = async function(){
    if(state.profile?.role!=='admin') return toast('Chỉ Admin được dùng chức năng này');
    if(val('#clear-data-confirm').trim().toUpperCase()!=='XOA TRANG') return toast('Vui lòng nhập đúng XOA TRANG');
    if(!confirm('Xác nhận lần cuối: xóa toàn bộ dữ liệu vận hành của SaleRoom?')) return;

    const org=state.profile.organization_id;
    try{
      setLoading(true,'Đang xóa dữ liệu…');

      const {data:imgs,error:imgErr}=await client.from('room_images').select('storage_path').eq('organization_id',org);
      if(imgErr) throw imgErr;
      const paths=(imgs||[]).map(x=>x.storage_path).filter(Boolean);
      if(paths.length){
        const {error:storageErr}=await client.storage.from('room-media').remove(paths);
        if(storageErr) console.warn('Không xóa được một số file ảnh',storageErr);
      }

      const tables=['activity_logs','catalogs','appointments','room_holds','commissions','customers','rooms','buildings','areas'];
      for(const table of tables){
        const {error}=await client.from(table).delete().eq('organization_id',org);
        if(error) throw new Error(table+': '+error.message);
      }

      closeSheet();
      await syncData(true);
      toast('Đã xóa trắng dữ liệu. Tài khoản vẫn được giữ.',5000);
    }catch(e){
      toast('Xóa trắng chưa hoàn tất: '+errMessage(e),6000);
      await syncData(true);
    }finally{
      setLoading(false);
    }
  };

  const prevProfileViewV4=profileView;
  profileView=function(){
    let html=prevProfileViewV4();
    if(state.profile?.role==='admin'){
      const block=`<section class="settings-card wipe-card"><h3>🧹 Xóa trắng dữ liệu</h3><p class="muted">Dùng khi muốn làm sạch toàn bộ dữ liệu vận hành và bắt đầu lại. Không xóa tài khoản.</p><button class="btn danger-soft full" onclick="openClearDataSheet()">XÓA TRẮNG DỮ LIỆU</button></section>`;
      html=html.replace('</main>',block+'</main>');
    }
    return html;
  };
})();

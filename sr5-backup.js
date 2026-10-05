/* SaleRoom v5 backup / restore */
(() => {
  const S=window.SR5;
  S.downloadJSON=function(obj,name){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  };
  S.fetchBackupTable=async function(table,org){
    const {data,error}=await client.from(table).select('*').eq('organization_id',org);
    if(error)throw new Error(table+': '+error.message);return data||[];
  };

  window.backupSaleRoom=async function(silent=false){
    if(!LIVE||state.profile?.role!=='admin'){if(!silent)toast('Chỉ Admin được backup');return null}
    try{
      if(!silent)setLoading(true,'Đang tạo backup…');
      const org=state.profile.organization_id;
      const names=['areas','buildings','rooms','room_images','customers','customer_requirements','appointments','room_holds','commissions','catalogs','customer_care_notes','room_change_history','activity_logs'];
      const tables={};
      for(const name of names)tables[name]=await S.fetchBackupTable(name,org);
      const catalogIds=(tables.catalogs||[]).map(x=>x.id);
      if(catalogIds.length){
        const [items,feedback]=await Promise.all([
          client.from('catalog_items').select('*').in('catalog_id',catalogIds),
          client.from('catalog_feedback').select('*').in('catalog_id',catalogIds)
        ]);
        if(items.error)throw items.error;if(feedback.error)throw feedback.error;
        tables.catalog_items=items.data||[];tables.catalog_feedback=feedback.data||[];
      }else{tables.catalog_items=[];tables.catalog_feedback=[]}
      const backup={format:'saleroom-backup-v1',created_at:new Date().toISOString(),organization_id:org,app:'SaleRoom',tables};
      S.downloadJSON(backup,`SaleRoom_Backup_${todayISO()}_${new Date().toTimeString().slice(0,5).replace(':','')}.json`);
      if(!silent)toast('Đã tải file backup');
      return backup;
    }catch(e){if(!silent)toast('Backup thất bại: '+errMessage(e),6000);throw e}
    finally{if(!silent)setLoading(false)}
  };

  window.pickRestoreBackup=function(){
    if(state.profile?.role!=='admin')return toast('Chỉ Admin được khôi phục dữ liệu');
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=()=>input.files?.[0]&&restoreSaleRoomBackup(input.files[0]);input.click();
  };

  S.upsertRows=async function(table,rows){
    if(!rows?.length)return;
    for(let i=0;i<rows.length;i+=100){
      const {error}=await client.from(table).upsert(rows.slice(i,i+100));
      if(error)throw new Error(table+': '+error.message);
    }
  };

  window.restoreSaleRoomBackup=async function(file){
    try{
      const raw=JSON.parse(await file.text());
      if(raw?.format!=='saleroom-backup-v1')throw new Error('Không đúng file backup SaleRoom');
      if(raw.organization_id!==state.profile.organization_id)throw new Error('File backup thuộc tổ chức khác');
      if(!confirm('Khôi phục dữ liệu từ file backup này? Dữ liệu trùng ID sẽ được cập nhật.'))return;
      setLoading(true,'Đang khôi phục dữ liệu…');
      const t=raw.tables||{};
      for(const table of ['areas','buildings','customers','rooms','customer_requirements','room_images','appointments','room_holds','commissions','catalogs','catalog_items','catalog_feedback','customer_care_notes','room_change_history','activity_logs']){
        setLoading(true,'Đang khôi phục '+table+'…');
        try{await S.upsertRows(table,t[table]||[])}catch(e){
          if(table==='activity_logs'||table==='room_change_history'){console.warn(e);continue}
          throw e;
        }
      }
      await syncData(true);toast('Khôi phục dữ liệu hoàn tất',5000);
    }catch(e){toast('Khôi phục thất bại: '+errMessage(e),6500)}
    finally{setLoading(false)}
  };

  /* Override Xóa trắng: auto-backup first, keep Storage files for restore */
  window.runClearData=async function(){
    if(state.profile?.role!=='admin')return toast('Chỉ Admin được dùng chức năng này');
    if(val('#clear-data-confirm').trim().toUpperCase()!=='XOA TRANG')return toast('Vui lòng nhập đúng XOA TRANG');
    if(!confirm('Xác nhận lần cuối: app sẽ tải file backup trước, sau đó xóa dữ liệu vận hành.'))return;
    const org=state.profile.organization_id;
    try{
      setLoading(true,'Đang tạo backup trước khi xóa…');
      await backupSaleRoom(true);
      const tables=['activity_logs','catalogs','appointments','room_holds','commissions','customers','rooms','buildings','areas'];
      for(const table of tables){
        setLoading(true,'Đang xóa '+table+'…');
        const {error}=await client.from(table).delete().eq('organization_id',org);if(error)throw new Error(table+': '+error.message);
      }
      closeSheet();await syncData(true);
      toast('Đã xóa trắng dữ liệu. File backup đã được tải; ảnh Storage vẫn được giữ để có thể khôi phục.',7000);
    }catch(e){toast('Xóa trắng chưa hoàn tất: '+errMessage(e),6500);await syncData(true)}
    finally{setLoading(false)}
  };

  const prevProfileBackup=profileView;
  profileView=function(){
    let html=prevProfileBackup();
    const block=`<section class="settings-card backup-card"><h3>🛡 Backup & Khôi phục</h3><p class="muted">Tải toàn bộ dữ liệu vận hành về máy. Ảnh được giữ trên Storage để file backup có thể khôi phục liên kết ảnh.</p><div class="profile-action-grid"><button class="btn primary" onclick="backupSaleRoom()">⬇ Tạo backup</button><button class="btn ghost" onclick="pickRestoreBackup()">↩ Khôi phục</button></div></section>`;
    return html.replace('</main>',block+'</main>');
  };
})();
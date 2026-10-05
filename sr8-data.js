/* SaleRoom v8 data quality: duplicate rooms, smarter Excel import, orphan cleanup */
(() => {
  const O=window.SR8;
  const S=window.SR5;

  O.roomNumberNorm=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');

  O.findDuplicateRoom=async function(areaId,roomNumber,exceptId=null){
    const n=O.roomNumberNorm(roomNumber);
    if(!LIVE||!areaId||!n)return null;
    let q=client.from('rooms')
      .select('id,title,room_number,area_id')
      .eq('organization_id',state.profile.organization_id)
      .eq('area_id',areaId)
      .eq('room_number_normalized',n)
      .is('deleted_at',null)
      .limit(1);
    if(exceptId)q=q.neq('id',exceptId);
    const {data,error}=await q;if(error)throw error;
    return data?.[0]||null;
  };

  O.showDuplicateWarning=async function({areaSelector,numberSelector,exceptId=null}){
    const areaId=val(areaSelector),roomNumber=val(numberSelector);
    let box=document.querySelector('#room-duplicate-warning');
    if(!box){
      box=document.createElement('div');box.id='room-duplicate-warning';box.className='room-duplicate-warning';
      document.querySelector(numberSelector)?.closest('.field')?.insertAdjacentElement('afterend',box);
    }
    if(!O.roomNumberNorm(roomNumber)){box.innerHTML='';box.classList.remove('show');return}
    try{
      const dup=await O.findDuplicateRoom(areaId,roomNumber,exceptId);
      if(dup){
        box.innerHTML='⚠️ Đã có <b>'+esc(dup.room_number||dup.title||'phòng')+'</b> trong khu vực này. Hãy kiểm tra trước khi lưu.';
        box.classList.add('show');
      }else{box.innerHTML='✓ Số phòng chưa bị trùng';box.classList.add('show','ok')}
      if(!dup)box.classList.add('ok');else box.classList.remove('ok');
    }catch{box.classList.remove('show')}
  };

  O.attachDuplicateWatcher=(areaSelector,numberSelector,exceptId=null)=>{
    const area=document.querySelector(areaSelector),num=document.querySelector(numberSelector);
    if(!area||!num)return;
    const check=()=>O.showDuplicateWarning({areaSelector,numberSelector,exceptId});
    area.addEventListener('change',check);num.addEventListener('input',()=>{clearTimeout(O.dupTimer);O.dupTimer=setTimeout(check,350)});
    if(num.value)check();
  };

  const prevNewRoom=window.newRoom;
  window.newRoom=function(){
    prevNewRoom();
    setTimeout(()=>O.attachDuplicateWatcher('#r-area','#rnum'),50);
  };

  const prevEditRoom=window.editRoom;
  window.editRoom=function(id){
    prevEditRoom(id);
    setTimeout(()=>O.attachDuplicateWatcher('#er-area','#ernum',id),50);
  };

  const prevSaveRoom=window.saveRoom;
  window.saveRoom=async function(){
    try{
      const areaId=val('#r-area'),number=val('#rnum').trim();
      const dup=await O.findDuplicateRoom(areaId,number);
      if(dup)return toast('Trùng số phòng: '+(dup.room_number||dup.title)+' đã có trong khu vực này',5500);
      return await prevSaveRoom();
    }catch(e){toast(errMessage(e),5000)}
  };

  const prevSaveRoomEdit=window.saveRoomEdit;
  window.saveRoomEdit=async function(id){
    try{
      const areaId=val('#er-area'),number=val('#ernum').trim();
      const dup=await O.findDuplicateRoom(areaId,number,id);
      if(dup)return toast('Không thể lưu: số phòng đã trùng với '+(dup.room_number||dup.title),5500);
      return await prevSaveRoomEdit(id);
    }catch(e){toast(errMessage(e),5000)}
  };

  O.importPayload=function(R,area,building,isNew){
    const g=(...k)=>R.get(...k),p={
      organization_id:state.profile.organization_id,
      area_id:area.id,building_id:building.id,
      updated_by:state.profile.id,updated_at:new Date().toISOString()
    };
    const setText=(key,v)=>{if(v!==null)p[key]=String(v).trim()||null};
    const setNum=(key,v)=>{if(v!==null)p[key]=S.num(v)};
    const title=g('Tên phòng','Ten phong','Title'),roomNumber=g('Số phòng','So phong','Room number'),roomType=g('Loại phòng','Loai phong','Room type');
    if(isNew){
      p.code='IMP-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
      p.created_by=state.profile.id;p.price=0;p.deposit=0;p.status='AVAILABLE';p.amenities=[];p.has_balcony=false;p.bonus=0;
      p.title=String(title||[roomType,roomNumber].filter(Boolean).join(' ')||'Phòng cho thuê');
    }else if(title!==null)setText('title',title);
    setText('room_number',roomNumber);setText('floor',g('Tầng','Tang','Floor'));setText('room_type',roomType);
    setText('description',g('Mô tả','Mo ta','Description'));
    setNum('price',g('Giá thuê','Gia thue','Price'));setNum('deposit',g('Tiền cọc','Tien coc','Deposit'));
    setText('electric_price',g('Điện','Dien','Electric'));setText('water_price',g('Nước','Nuoc','Water'));
    setText('service_fee',g('Dịch vụ','Dich vu','Service'));setText('parking_fee',g('Gửi xe','Gui xe','Parking'));
    setText('internet_fee',g('Internet'));setNum('area',g('Diện tích m2','Dien tich m2','Diện tích','Area m2'));
    setText('furniture',g('Nội thất','Noi that','Furniture'));setNum('max_people',g('Số người','So nguoi','People'));
    setNum('max_motorbike',g('Số xe','So xe','Motorbikes'));setText('washer_type',g('Máy giặt','May giat','Washer'));
    setText('pet_policy',g('Thú cưng','Thu cung','Pet'));
    const am=g('Tiện ích','Tien ich','Amenities');if(am!==null)p.amenities=String(am).split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
    const bal=g('Ban công','Ban cong','Balcony');if(bal!==null)p.has_balcony=S.bool(bal);
    const date=g('Ngày có phòng','Ngay co phong','Available date');if(date!==null)p.available_date=S.excelDate(date);
    const status=g('Trạng thái','Trang thai','Status');if(status!==null)p.status=S.status(status);
    setNum('contract_months',g('Hợp đồng tháng','Hop dong thang','Contract months'));
    setText('commission_note',g('Hoa hồng','Hoa hong','Commission'));setNum('bonus',g('Thưởng','Thuong','Bonus'));
    setText('internal_note',g('Ghi chú nội bộ','Ghi chu noi bo','Internal note'));
    return p;
  };

  window.pickRoomExcel=function(){
    if(!window.XLSX)return toast('Thư viện Excel chưa tải xong');
    showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">IMPORT EXCEL</div><h2>Nhập / cập nhật phòng</h2></div><button onclick="closeSheet()">✕</button></div>'+
      '<div class="field"><label>Khi gặp phòng trùng Khu vực + Số phòng</label><select id="excel-import-mode">'+
        '<option value="update">Cập nhật phòng cũ + thêm phòng mới</option>'+
        '<option value="skip">Bỏ qua phòng trùng, chỉ thêm phòng mới</option>'+
        '<option value="new">Dừng import nếu phát hiện phòng trùng</option>'+
      '</select></div>'+
      '<div class="excel-mode-note">Khuyên dùng <b>Cập nhật phòng cũ</b>. Ô trống trong Excel sẽ giữ nguyên dữ liệu cũ, không xóa nội dung đang có.</div>'+
      '<div class="field"><label>File Excel / CSV</label><input id="excel-room-file" type="file" accept=".xlsx,.xls,.csv"></div>'+
      '<div class="sheet-actions"><button class="btn ghost" onclick="downloadRoomTemplate()">⬇ Mẫu Excel</button><button class="btn primary" onclick="runRoomExcelImport()">Import</button></div>');
  };

  window.runRoomExcelImport=async function(){
    const file=document.querySelector('#excel-room-file')?.files?.[0];if(!file)return toast('Chọn file Excel');
    const mode=val('#excel-import-mode')||'update';
    await importRoomExcelFile(file,mode);
  };

  window.importRoomExcelFile=async function(file,mode='update'){
    try{
      setLoading(true,'Đang đọc Excel…');
      const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:null});
      if(!rows.length)throw new Error('File Excel không có dữ liệu');
      if(rows.length>1000)throw new Error('Mỗi lần import tối đa 1.000 phòng');

      const {data:existing,error:e0}=await client.from('rooms')
        .select('id,area_id,room_number,room_number_normalized,title,deleted_at')
        .eq('organization_id',state.profile.organization_id)
        .is('deleted_at',null);
      if(e0)throw e0;
      const byKey=new Map((existing||[]).filter(x=>x.room_number_normalized).map(x=>[x.area_id+'|'+x.room_number_normalized,x]));
      const inserts=[],updates=new Map(),newKeys=new Map();
      let skipped=0,duplicateRows=0;

      for(let i=0;i<rows.length;i++){
        setLoading(true,'Đang kiểm tra dòng '+(i+2)+'/'+(rows.length+1)+'…');
        const R=S.rowMap(rows[i]),areaName=R.get('Khu vực','Khu vuc','Area');
        if(!areaName)throw new Error('Dòng '+(i+2)+': thiếu Khu vực');
        const {area,building}=await S.ensureAreaBuilding(areaName);
        const roomNumber=R.get('Số phòng','So phong','Room number'),norm=O.roomNumberNorm(roomNumber);
        const key=norm?area.id+'|'+norm:null;
        const found=key?(byKey.get(key)||newKeys.get(key)):null;

        if(found){
          duplicateRows++;
          if(mode==='new')throw new Error('Dòng '+(i+2)+' bị trùng phòng '+(roomNumber||found.title)+' trong '+area.name);
          if(mode==='skip'){skipped++;continue}
          if(found.__new){
            Object.assign(found.payload,O.importPayload(R,area,building,false));
          }else{
            const old=updates.get(found.id)||{id:found.id,payload:{}};
            Object.assign(old.payload,O.importPayload(R,area,building,false));
            updates.set(found.id,old);
          }
          continue;
        }

        const payload=O.importPayload(R,area,building,true);
        const holder={__new:true,payload};
        inserts.push(holder);
        if(key)newKeys.set(key,holder);
      }

      let updated=0,added=0;
      const updateList=[...updates.values()];
      for(let i=0;i<updateList.length;i++){
        setLoading(true,'Đang cập nhật '+(i+1)+'/'+updateList.length+' phòng…');
        const {error}=await client.from('rooms').update(updateList[i].payload).eq('id',updateList[i].id);if(error)throw error;updated++;
      }
      for(let i=0;i<inserts.length;i+=100){
        const rowsToInsert=inserts.slice(i,i+100).map(x=>x.payload);
        setLoading(true,'Đang thêm '+Math.min(i+rowsToInsert.length,inserts.length)+'/'+inserts.length+' phòng…');
        const {error}=await client.from('rooms').insert(rowsToInsert);if(error)throw error;added+=rowsToInsert.length;
      }

      closeSheet();await syncData(true);
      toast('Import xong: '+added+' thêm mới · '+updated+' cập nhật · '+skipped+' bỏ qua'+(duplicateRows?' · '+duplicateRows+' dòng trùng':''),7000);
    }catch(e){toast('Import thất bại: '+errMessage(e),7000)}
    finally{setLoading(false)}
  };

  O.listStorageRecursive=async function(prefix){
    const out=[];let offset=0;
    while(true){
      const {data,error}=await client.storage.from('room-media').list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
      if(error)throw error;
      const rows=data||[];
      for(const item of rows){
        const path=prefix?prefix+'/'+item.name:item.name;
        if(item.id){
          out.push({path,size:Number(item.metadata?.size||0),created_at:item.created_at||null});
        }else{
          out.push(...await O.listStorageRecursive(path));
        }
      }
      if(rows.length<100)break;offset+=100;
    }
    return out;
  };

  O.scanOrphans=async function(){
    if(state.profile?.role!=='admin')throw new Error('Chỉ Admin được dọn file rác');
    const org=state.profile.organization_id;
    const [files,imgs,vids]=await Promise.all([
      O.listStorageRecursive(org),
      client.from('room_images').select('storage_path').eq('organization_id',org),
      client.from('room_videos').select('storage_path,thumbnail_storage_path').eq('organization_id',org)
    ]);
    if(imgs.error)throw imgs.error;if(vids.error)throw vids.error;
    const refs=new Set([
      ...(imgs.data||[]).map(x=>x.storage_path),
      ...(vids.data||[]).flatMap(x=>[x.storage_path,x.thumbnail_storage_path])
    ].filter(Boolean));
    return files.filter(x=>!refs.has(x.path));
  };

  window.openMediaCleanup=async function(){
    if(state.profile?.role!=='admin')return toast('Chỉ Admin được dọn file rác');
    try{
      setLoading(true,'Đang quét file rác…');
      const orphans=await O.scanOrphans();O.lastOrphans=orphans;
      const bytes=orphans.reduce((s,x)=>s+x.size,0);
      const rows=orphans.slice(0,40).map(x=>'<div class="orphan-row"><span>'+esc(x.path.split('/').pop())+'</span><b>'+window.SR7.formatBytes(x.size)+'</b></div>').join('');
      showSheet('<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">STORAGE</div><h2>Dọn file rác</h2></div><button onclick="closeSheet()">✕</button></div>'+
        '<div class="cleanup-summary"><b>'+orphans.length+' file không còn được sử dụng</b><span>'+window.SR7.formatBytes(bytes)+'</span></div>'+
        '<p class="muted">Chỉ quét thư mục media của tổ chức hiện tại. File đang được ảnh/video phòng tham chiếu sẽ không bị đụng tới.</p>'+
        (rows?'<div class="orphan-list">'+rows+'</div>':'<div class="empty-mini">Storage đang sạch.</div>')+
        (orphans.length?'<button class="btn danger-soft full" onclick="cleanMediaOrphans()">🧹 Xóa '+orphans.length+' file rác</button>':''));
    }catch(e){toast(errMessage(e),5500)}finally{setLoading(false)}
  };

  window.cleanMediaOrphans=async function(){
    const rows=O.lastOrphans||[];if(!rows.length)return;
    if(!confirm('Xóa vĩnh viễn '+rows.length+' file rác khỏi Storage?'))return;
    try{
      setLoading(true,'Đang dọn Storage…');
      for(let i=0;i<rows.length;i+=100){
        const paths=rows.slice(i,i+100).map(x=>x.path);
        const {error}=await client.storage.from('room-media').remove(paths);if(error)throw error;
      }
      O.lastOrphans=[];closeSheet();toast('Đã dọn '+rows.length+' file rác',5000);
    }catch(e){toast(errMessage(e),5500)}finally{setLoading(false)}
  };

  const prevProfileV8=profileView;
  profileView=function(){
    let html=prevProfileV8();
    if(state.profile?.role==='admin'){
      const block='<section class="settings-card cleanup-card"><h3>🧹 Dọn file rác</h3><p class="muted">Quét ảnh, video, thumbnail trong Storage không còn liên kết với phòng nào.</p><button class="btn ghost full" onclick="openMediaCleanup()">Quét Storage</button></section>';
      html=html.replace('</main>',block+'</main>');
    }
    return html;
  };
})();
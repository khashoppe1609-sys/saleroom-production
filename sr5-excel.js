/* SaleRoom v5 Excel import/export */
(() => {
  const S=window.SR5;

  S.headerNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
  S.rowMap=function(row){
    const m={};
    for(const [k,v] of Object.entries(row||{}))m[S.headerNorm(k)]=v;
    const get=(...keys)=>{for(const k of keys){const v=m[S.headerNorm(k)];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return null};
    return {get};
  };
  S.num=v=>{
    if(v===null||v===undefined||v==='')return null;
    if(typeof v==='number')return v;
    const s=String(v).replace(/\s/g,'').replace(/[^0-9,-]/g,'').replace(/\./g,'').replace(',','.');
    const n=Number(s);return Number.isFinite(n)?n:null;
  };
  S.bool=v=>/^(1|true|yes|y|x|co|có)$/i.test(String(v||'').trim());
  S.status=v=>{
    const s=S.headerNorm(v||'available');
    const map={
      'trong':'AVAILABLE','available':'AVAILABLE',
      'sap trong':'COMING_SOON','coming soon':'COMING_SOON',
      'dang giu':'HOLD','hold':'HOLD',
      'da coc':'DEPOSITED','deposited':'DEPOSITED',
      'da thue':'RENTED','rented':'RENTED',
      'dang sua':'MAINTENANCE','maintenance':'MAINTENANCE',
      'an':'HIDDEN','hidden':'HIDDEN'
    };
    return map[s]||'AVAILABLE';
  };
  S.excelDate=v=>{
    if(!v)return null;
    if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
    if(typeof v==='number'&&window.XLSX?.SSF?.parse_date_code){
      const d=XLSX.SSF.parse_date_code(v); if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const d=new Date(v);return isNaN(d)?null:d.toISOString().slice(0,10);
  };
  S.ensureAreaBuilding=async function(name){
    const clean=String(name||'').trim();if(!clean)throw new Error('Thiếu Khu vực');
    let area=(state.areas||[]).find(a=>S.headerNorm(a.name)===S.headerNorm(clean));
    if(!area){
      const {data,error}=await client.from('areas').insert({organization_id:state.profile.organization_id,name:clean,city:'TP.HCM',created_by:state.profile.id}).select().single();
      if(error)throw error;area=data;state.areas.push(area);
    }
    let building=state.buildings.find(b=>b.code===window.SR3.compatCode(area.id));
    if(!building){
      const {data,error}=await client.from('buildings').insert({
        organization_id:state.profile.organization_id,code:window.SR3.compatCode(area.id),name:area.name,address:area.name,city:area.city||'TP.HCM',district:area.name,amenities:[],created_by:state.profile.id
      }).select().single();
      if(error)throw error;building=data;state.buildings.push(building);
    }
    return {area,building};
  };

  window.downloadRoomTemplate=function(){
    if(!window.XLSX)return toast('Thư viện Excel chưa tải xong');
    const rows=[
      ['Khu vực','Tên phòng','Số phòng','Tầng','Loại phòng','Mô tả','Giá thuê','Tiền cọc','Điện','Nước','Dịch vụ','Gửi xe','Internet','Diện tích m2','Nội thất','Số người','Số xe','Máy giặt','Thú cưng','Tiện ích','Ban công','Ngày có phòng','Trạng thái','Hợp đồng tháng','Hoa hồng','Thưởng','Ghi chú nội bộ'],
      ['Quận 7','Studio ban công','P.302','Tầng 3','Studio','Phòng sáng, full nội thất',5500000,5500000,'4.000đ/kWh','100.000đ/người','200.000đ/phòng','150.000đ/xe','Miễn phí',28,'Full nội thất',2,2,'Riêng','Cho mèo nhỏ','Máy lạnh, Tủ lạnh, Bếp','Có',todayISO(),'Trống',12,'50% tháng đầu',0,'']
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=rows[0].map((x,i)=>({wch:Math.min(28,Math.max(12,String(x).length+4))}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Phong');
    XLSX.writeFile(wb,'SaleRoom_Mau_Import_Phong.xlsx');
  };

  window.pickRoomExcel=function(){
    if(!window.XLSX)return toast('Thư viện Excel chưa tải xong');
    const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls,.csv';
    input.onchange=()=>input.files?.[0]&&importRoomExcelFile(input.files[0]);
    input.click();
  };

  window.importRoomExcelFile=async function(file){
    try{
      setLoading(true,'Đang đọc Excel…');
      const data=await file.arrayBuffer();
      const wb=XLSX.read(data,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:null});
      if(!rows.length)throw new Error('File Excel không có dữ liệu');
      if(rows.length>1000)throw new Error('Mỗi lần import tối đa 1.000 phòng');

      const prepared=[];
      for(let i=0;i<rows.length;i++){
        const R=S.rowMap(rows[i]),areaName=R.get('Khu vực','Khu vuc','Area');
        if(!areaName)throw new Error(`Dòng ${i+2}: thiếu Khu vực`);
        const {area,building}=await S.ensureAreaBuilding(areaName);
        const amenities=String(R.get('Tiện ích','Tien ich','Amenities')||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
        const roomNumber=R.get('Số phòng','So phong','Room number');
        const roomType=R.get('Loại phòng','Loai phong','Room type');
        const title=R.get('Tên phòng','Ten phong','Title')||[roomType,roomNumber].filter(Boolean).join(' ')||'Phòng cho thuê';
        const code='IMP-'+Date.now().toString(36).toUpperCase()+'-'+String(i+1).padStart(4,'0')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        prepared.push({
          organization_id:state.profile.organization_id,area_id:area.id,building_id:building.id,code,
          title:String(title),room_number:roomNumber?String(roomNumber):null,floor:R.get('Tầng','Tang','Floor')?String(R.get('Tầng','Tang','Floor')):null,
          room_type:roomType?String(roomType):null,description:R.get('Mô tả','Mo ta','Description')?String(R.get('Mô tả','Mo ta','Description')):null,
          price:S.num(R.get('Giá thuê','Gia thue','Price'))||0,deposit:S.num(R.get('Tiền cọc','Tien coc','Deposit'))||0,
          electric_price:R.get('Điện','Dien','Electric')?String(R.get('Điện','Dien','Electric')):null,
          water_price:R.get('Nước','Nuoc','Water')?String(R.get('Nước','Nuoc','Water')):null,
          service_fee:R.get('Dịch vụ','Dich vu','Service')?String(R.get('Dịch vụ','Dich vu','Service')):null,
          parking_fee:R.get('Gửi xe','Gui xe','Parking')?String(R.get('Gửi xe','Gui xe','Parking')):null,
          internet_fee:R.get('Internet')?String(R.get('Internet')):null,
          area:S.num(R.get('Diện tích m2','Dien tich m2','Diện tích','Area m2')),
          furniture:R.get('Nội thất','Noi that','Furniture')?String(R.get('Nội thất','Noi that','Furniture')):null,
          max_people:S.num(R.get('Số người','So nguoi','People')),max_motorbike:S.num(R.get('Số xe','So xe','Motorbikes')),
          washer_type:R.get('Máy giặt','May giat','Washer')?String(R.get('Máy giặt','May giat','Washer')):null,
          pet_policy:R.get('Thú cưng','Thu cung','Pet')?String(R.get('Thú cưng','Thu cung','Pet')):null,
          amenities,has_balcony:S.bool(R.get('Ban công','Ban cong','Balcony')),
          available_date:S.excelDate(R.get('Ngày có phòng','Ngay co phong','Available date')),
          status:S.status(R.get('Trạng thái','Trang thai','Status')),
          contract_months:S.num(R.get('Hợp đồng tháng','Hop dong thang','Contract months')),
          commission_note:R.get('Hoa hồng','Hoa hong','Commission')?String(R.get('Hoa hồng','Hoa hong','Commission')):null,
          bonus:S.num(R.get('Thưởng','Thuong','Bonus'))||0,
          internal_note:R.get('Ghi chú nội bộ','Ghi chu noi bo','Internal note')?String(R.get('Ghi chú nội bộ','Ghi chu noi bo','Internal note')):null,
          created_by:state.profile.id,updated_by:state.profile.id
        });
      }

      let done=0;
      for(let i=0;i<prepared.length;i+=100){
        setLoading(true,`Đang import ${Math.min(i+100,prepared.length)}/${prepared.length} phòng…`);
        const {error}=await client.from('rooms').insert(prepared.slice(i,i+100));if(error)throw error;done+=Math.min(100,prepared.length-i);
      }
      await syncData(true);toast(`Đã import ${done} phòng từ Excel`,5000);
    }catch(e){toast('Import thất bại: '+errMessage(e),6000)}finally{setLoading(false)}
  };

  S.customerExportRows=function(){
    return (state.customers||[]).map(c=>{const r=customerReq(c);return {
      'Tên khách':c.name,'SĐT':c.phone,'Zalo':c.zalo||'','Nguồn':c.source||'','Trạng thái':c.status||'',
      'Khu vực':(r.districts||[]).join(', '),'Ngân sách từ':r.min_price||'','Ngân sách đến':r.max_price||'',
      'Ngày vào':r.move_in||'','Số người':r.people||'','Số xe':r.bikes||'','Có pet':r.has_pet?'Có':'',
      'Cần ban công':r.need_balcony?'Có':'','Máy giặt riêng':r.need_private_washer?'Có':'',
      'Loại phòng':(r.room_types||[]).join(', '),'Yêu cầu':(r.must_have||[]).join(', '),
      'Lịch care tiếp theo':c.next_follow_up_at?new Date(c.next_follow_up_at).toLocaleString('vi-VN'):'',
      'Nội dung follow':c.follow_up_note||'','Ghi chú':c.note||''
    }});
  };
  S.commissionExportRows=function(){
    return (state.commissions||[]).map(x=>({
      'Sale':state.team.find(t=>t.id===x.sale_id)?.full_name||'',
      'Khách':state.customers.find(c=>c.id===x.customer_id)?.name||'',
      'SĐT khách':state.customers.find(c=>c.id===x.customer_id)?.phone||'',
      'Phòng':state.rooms.find(r=>r.id===x.room_id)?.title||state.rooms.find(r=>r.id===x.room_id)?.room_number||'',
      'Dự kiến':Number(x.expected_amount||0),'Đã nhận':Number(x.paid_amount||0),'Trạng thái':x.status||'',
      'Ngày tạo':x.created_at?new Date(x.created_at).toLocaleString('vi-VN'):'','Ngày nhận':x.paid_at?new Date(x.paid_at).toLocaleString('vi-VN'):'',
      'Ghi chú':x.note||''
    }));
  };

  window.exportCustomersExcel=function(){
    if(!window.XLSX)return toast('Thư viện Excel chưa tải xong');
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(S.customerExportRows());
    XLSX.utils.book_append_sheet(wb,ws,'Khach_hang');XLSX.writeFile(wb,`SaleRoom_KhachHang_${todayISO()}.xlsx`);
  };
  window.exportCommissionsExcel=function(){
    if(!window.XLSX)return toast('Thư viện Excel chưa tải xong');
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(S.commissionExportRows());
    XLSX.utils.book_append_sheet(wb,ws,'Hoa_hong');XLSX.writeFile(wb,`SaleRoom_HoaHong_${todayISO()}.xlsx`);
  };
  window.exportSaleRoomExcel=function(){
    if(!window.XLSX)return toast('Thư viện Excel chưa tải xong');
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.customerExportRows()),'Khach_hang');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.commissionExportRows()),'Hoa_hong');
    XLSX.writeFile(wb,`SaleRoom_CRM_HoaHong_${todayISO()}.xlsx`);
  };

  const prevRoomsViewExcel=roomsView;
  roomsView=function(){
    let html=prevRoomsViewExcel();
    const bar=`<div class="data-tools"><button onclick="pickRoomExcel()">⬆ Import Excel</button><button onclick="downloadRoomTemplate()">⬇ Mẫu Excel</button></div>`;
    return html.replace('<div class="search-row">',bar+'<div class="search-row">');
  };

  const prevProfileExcel=profileView;
  profileView=function(){
    let html=prevProfileExcel();
    const block=`<section class="settings-card"><h3>📊 Excel</h3><p class="muted">Nhập nhiều phòng một lần hoặc xuất CRM/hoa hồng để lưu và báo cáo.</p><div class="profile-action-grid"><button class="btn ghost" onclick="pickRoomExcel()">⬆ Import phòng</button><button class="btn ghost" onclick="downloadRoomTemplate()">Mẫu Excel</button><button class="btn ghost" onclick="exportCustomersExcel()">⬇ Khách hàng</button><button class="btn ghost" onclick="exportCommissionsExcel()">⬇ Hoa hồng</button><button class="btn primary full-span" onclick="exportSaleRoomExcel()">Xuất CRM + Hoa hồng</button></div></section>`;
    return html.replace('</main>',block+'</main>');
  };
})();
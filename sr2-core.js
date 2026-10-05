/* SaleRoom v2 core */
window.SR2 = window.SR2 || {};
(() => {
  const S=window.SR2;
  S.isAdmin=()=>state?.profile?.role==='admin';
  S.isManager=()=>['admin','manager'].includes(state?.profile?.role);
  S.stop=e=>{try{e?.stopPropagation?.()}catch{}};
  S.phoneDigits=p=>String(p||'').replace(/\D/g,'');
  S.zaloHref=sale=>sale?.zalo_url||(S.phoneDigits(sale?.phone)?`https://zalo.me/${S.phoneDigits(sale.phone)}`:'');
  S.copy=async text=>{try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}};
  window.copyRoomInfo=async function(id,e){S.stop(e);const r=normalizeRoom(state.rooms.find(x=>x.id===id));if(!r)return toast('Không tìm thấy phòng');const text=[`🏠 ${r.title||`${r.room_type||'Phòng'} ${r.room_number||''}`}`,`🔖 Mã: ${r.code}`,`📍 ${r.building_name||''}${r.district?` · ${r.district}`:''}`,r.building_address?`🗺️ ${r.building_address}`:'',`💰 Giá: ${money(r.price)}/tháng`,r.deposit?`💵 Cọc: ${money(r.deposit)}`:'',r.area?`📐 Diện tích: ${r.area}m²`:'',r.room_type?`🚪 Loại: ${r.room_type}`:'',`🌤️ ${r.has_balcony?'Có ban công':'Không ban công'}`,r.washer_type?`🧺 Máy giặt: ${r.washer_type}`:'',r.pet_policy?`🐾 Pet: ${r.pet_policy}`:'',r.electric_price?`⚡ Điện: ${r.electric_price}`:'',r.water_price?`💧 Nước: ${r.water_price}`:'',r.service_fee?`🧹 Dịch vụ: ${r.service_fee}`:'',r.parking_fee?`🛵 Xe: ${r.parking_fee}`:'',r.internet_fee?`📶 Internet: ${r.internet_fee}`:'',r.available_date?`📅 Ngày vào: ${fmtDate(r.available_date)}`:''].filter(Boolean).join('\n');await S.copy(text);toast('Đã sao chép thông tin phòng')};
  S.del=async function(table,id,label){if(!LIVE)return toast('Chức năng xóa chỉ áp dụng dữ liệu thật');if(!S.isAdmin()&&['rooms','buildings','commissions'].includes(table))return toast('Chỉ Admin được xóa mục này');if(!confirm(`Xóa ${label}?\n\nDữ liệu đã xóa không thể khôi phục.`))return;try{setLoading(true,`Đang xóa ${label}…`);const {error}=await client.from(table).delete().eq('id',id);if(error)throw error;try{closeSheet()}catch{}await hydrate();toast(`Đã xóa ${label}`)}catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}};
  window.deleteRoom=(id,e)=>{S.stop(e);return S.del('rooms',id,'phòng')};
  window.deleteCustomer=(id,e)=>{S.stop(e);return S.del('customers',id,'khách hàng')};
  window.deleteAppointment=(id,e)=>{S.stop(e);return S.del('appointments',id,'lịch hẹn')};
  window.deleteBuilding=(id,e)=>{S.stop(e);return S.del('buildings',id,'tòa nhà (và các phòng thuộc tòa)')};
  window.deleteCatalog=(id,e)=>{S.stop(e);return S.del('catalogs',id,'catalog')};
  window.deleteCommission=(id,e)=>{S.stop(e);return S.del('commissions',id,'hoa hồng')};
  window.deleteHold=(id,e)=>{S.stop(e);return S.del('room_holds',id,'giữ phòng')};
  window.deleteRoomImages=async function(roomId,e){S.stop(e);if(!LIVE||!S.isManager())return toast('Bạn không có quyền xóa ảnh');const room=state.rooms.find(r=>r.id===roomId),imgs=room?.room_images||[];if(!imgs.length)return toast('Phòng chưa có ảnh');if(!confirm(`Xóa toàn bộ ${imgs.length} ảnh của phòng này?`))return;try{setLoading(true,'Đang xóa ảnh…');const paths=imgs.map(x=>x.storage_path).filter(Boolean);if(paths.length)await client.storage.from('room-media').remove(paths);const {error}=await client.from('room_images').delete().eq('room_id',roomId);if(error)throw error;await hydrate();closeSheet();openRoom(roomId);toast('Đã xóa ảnh phòng')}catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}};
})();

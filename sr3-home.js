/* SaleRoom v3 dashboard: viewing requests */
(() => {
  const S=window.SR3;
  const baseHomeView=homeView;
  homeView=function(){
    let html=baseHomeView();
    const leads=(state.catalogLeads||[]).filter(x=>x.action==='VIEWING'&&x.customer_phone).slice(0,8);
    const section=`<section class="home-leads"><div class="section-title"><h2>📞 Khách muốn xem phòng</h2><span>${leads.length}</span></div>${leads.map(x=>{const r=normalizeRoom(state.rooms.find(v=>v.id===x.room_id)||{});return `<article class="lead-card"><div><b>${esc(x.customer_name||'Khách')}</b><span>☎ ${esc(x.customer_phone||'')}</span><small>${esc(r.code||'Phòng')} · ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(x.created_at))}</small></div><div class="lead-actions"><button onclick="callPhone('${esc(x.customer_phone||'')}')">☎ Gọi</button><button class="lead-delete" onclick="deleteViewingLead('${x.id}',event)">🗑</button></div></article>`}).join('')||'<div class="empty-mini">Chưa có yêu cầu xem phòng mới.</div>'}</section>`;
    return html.replace('</main>',section+'</main>');
  };
  window.deleteViewingLead=async function(id,e){try{e?.stopPropagation?.()}catch{}if(!confirm('Xóa yêu cầu xem phòng này?'))return;try{const {error}=await client.from('catalog_feedback').delete().eq('id',id);if(error)throw error;await S.loadExtras();render();toast('Đã xóa yêu cầu')}catch(err){toast(errMessage(err),3500)}};
})();
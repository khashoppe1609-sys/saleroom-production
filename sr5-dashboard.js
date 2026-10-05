/* SaleRoom v5 funnel + care reminders */
(() => {
  const S=window.SR5;
  state.roomHolds=state.roomHolds||[];

  S.loadDashboardExtras=async function(){
    if(!LIVE||!state.profile)return;
    const {data,error}=await client.from('room_holds').select('*').order('created_at',{ascending:false});
    if(!error)state.roomHolds=data||[];
  };
  const prevHydrateDash=hydrate;
  hydrate=async function(){
    await prevHydrateDash();
    await S.loadDashboardExtras();
    if(state.profile)render();
  };

  S.distinctCount=arr=>new Set((arr||[]).filter(Boolean)).size;
  S.funnel=function(){
    const active=state.customers||[];
    const leadIds=new Set(active.map(c=>c.id));
    const viewing=new Set((state.appointments||[]).map(a=>a.customer_id).filter(id=>leadIds.has(id)));
    const deposits=new Set((state.roomHolds||[]).filter(h=>h.customer_id&&(Number(h.amount||0)>0||h.status==='ACTIVE')).map(h=>h.customer_id).filter(id=>leadIds.has(id)));
    const rented=new Set((state.commissions||[]).map(c=>c.customer_id).filter(id=>leadIds.has(id)));
    for(const c of active)if(/thue|thuê|chot|chốt/i.test(c.status||''))rented.add(c.id);
    return {leads:leadIds.size,viewing:viewing.size,deposits:deposits.size,rented:rented.size};
  };
  S.pct=(n,d)=>d?Math.round(n/d*100):0;
  S.reminders=function(){
    const now=Date.now(),limit=now+7*86400000;
    return (state.customers||[]).filter(c=>c.next_follow_up_at&&new Date(c.next_follow_up_at).getTime()<=limit)
      .sort((a,b)=>new Date(a.next_follow_up_at)-new Date(b.next_follow_up_at));
  };

  const prevHomeViewV5=homeView;
  homeView=function(){
    let html=prevHomeViewV5();
    const f=S.funnel(),rem=S.reminders(),now=Date.now();
    const funnel=`<section class="funnel-section"><div class="section-title"><h2>📈 Phễu bán hàng</h2><span>CRM</span></div><div class="funnel-grid"><div><b>${f.leads}</b><span>Khách</span></div><div><b>${f.viewing}</b><span>Xem phòng</span><small>${S.pct(f.viewing,f.leads)}%</small></div><div><b>${f.deposits}</b><span>Cọc / Giữ</span><small>${S.pct(f.deposits,f.viewing||f.leads)}%</small></div><div><b>${f.rented}</b><span>Thuê</span><small>${S.pct(f.rented,f.deposits||f.viewing||f.leads)}%</small></div></div></section>`;
    const reminder=`<section class="care-reminders"><div class="section-title"><h2>⏰ Nhắc chăm sóc</h2><span>${rem.length}</span></div>${rem.slice(0,8).map(c=>{const t=new Date(c.next_follow_up_at),late=t.getTime()<now;return `<article class="reminder-card ${late?'late':''}"><div><b>${esc(c.name)}</b><span>${late?'Quá hạn':'Sắp tới'} · ${new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(t)}</span><small>${esc(c.follow_up_note||'Chăm sóc khách')}</small></div><div class="reminder-actions"><button onclick="callPhone('${esc(c.phone||'')}')">☎</button><button onclick="snoozeCare('${c.id}')">+1 ngày</button><button class="done" onclick="completeCareReminder('${c.id}')">✓ Đã care</button></div></article>`}).join('')||'<div class="empty-mini">Không có lịch care trong 7 ngày tới.</div>'}</section>`;
    return html.replace('</main>',funnel+reminder+'</main>');
  };

  window.completeCareReminder=async function(id){
    const c=state.customers.find(x=>x.id===id);if(!c)return;
    try{
      const note=c.follow_up_note||'Hoàn tất lịch chăm sóc';
      const {error}=await client.from('customers').update({next_follow_up_at:null,follow_up_note:null,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
      await client.from('customer_care_notes').insert({organization_id:state.profile.organization_id,customer_id:id,author_id:state.profile.id,note:'✅ Đã care: '+note});
      await syncData(true);toast('Đã hoàn tất nhắc care');
    }catch(e){toast(errMessage(e),4000)}
  };
  window.snoozeCare=async function(id){
    const c=state.customers.find(x=>x.id===id);if(!c)return;
    const base=Math.max(Date.now(),new Date(c.next_follow_up_at||Date.now()).getTime());
    try{const {error}=await client.from('customers').update({next_follow_up_at:new Date(base+86400000).toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await syncData(true);toast('Đã dời lịch care +1 ngày')}catch(e){toast(errMessage(e),4000)}
  };
})();
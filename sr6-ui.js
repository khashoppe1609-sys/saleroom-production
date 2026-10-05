/* SaleRoom v6 UI polish: fixed sync, fixed dock, unified icons */
window.SR6 = window.SR6 || {};
(() => {
  const U=window.SR6;
  const svg=(body,cls='ui-svg')=>'<svg class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
  U.icons={
    home:svg('<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>','nav-svg'),
    rooms:svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 10h18M3 15h18"/>','nav-svg'),
    customers:svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>','nav-svg'),
    appointments:svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>','nav-svg'),
    profile:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>','nav-svg'),
    sync:svg('<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 1 0 1.2 7.2"/>'),
    filter:svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
    plus:svg('<path d="M12 5v14M5 12h14"/>'),
    copy:svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    trash:svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>'),
    edit:svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>'),
    call:svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>'),
    share:svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>'),
    download:svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
    upload:svg('<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>'),
    backup:svg('<path d="M4 7a8 8 0 1 1-1 8"/><path d="M4 3v4h4"/><path d="M12 8v5l3 2"/>'),
    restore:svg('<path d="M4 7a8 8 0 1 1-1 8"/><path d="M4 3v4h4"/>'),
    area:svg('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'),
    calendar:svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
    check:svg('<path d="m5 12 4 4L19 6"/>')
  };

  bottomNav=function(){
    const items=[
      ['home',U.icons.home,'Trang chủ'],
      ['rooms',U.icons.rooms,'Kho phòng'],
      ['customers',U.icons.customers,'Khách hàng'],
      ['appointments',U.icons.appointments,'Lịch hẹn'],
      ['profile',U.icons.profile,'Cá nhân']
    ];
    return '<nav class="bottom-nav modern-dock">'+items.map(([k,i,l])=>
      '<button class="nav-item '+(state.tab===k?'active':'')+'" onclick="go(\''+k+'\')" aria-label="'+l+'"><span class="ico nav-ico-wrap">'+i+'</span><span class="nav-label">'+l+'</span></button>'
    ).join('')+'</nav>';
  };

  const rules=[
    [/đồng bộ/i,'sync'],[/bộ lọc|lọc/i,'filter'],[/sao chép|copy/i,'copy'],[/xóa|xoá/i,'trash'],
    [/sửa|chỉnh sửa/i,'edit'],[/gọi/i,'call'],[/gửi|chia sẻ/i,'share'],[/import|upload/i,'upload'],
    [/export|xuất|tải file|tạo backup/i,'download'],[/khôi phục/i,'restore'],[/khu vực/i,'area'],
    [/lịch|hẹn/i,'calendar'],[/thêm|tạo mới/i,'plus'],[/đã care|hoàn tất/i,'check']
  ];

  U.cleanPrefix=t=>String(t||'').replace(/^[\s\u2000-\u3300\u{1F000}-\u{1FAFF}↻+✓✏︎✏️☎📞📤📋🗑⬆⬇↩]+/u,'').trim();

  U.decorateButton=function(btn){
    if(!btn||btn.classList.contains('nav-item')||btn.dataset.sr6Icon==='1')return;
    if(btn.id==='sr-sync-btn')return;
    const text=(btn.textContent||'').trim();
    if(!text)return;
    const hit=rules.find(([re])=>re.test(text));
    if(!hit)return;
    const key=hit[1],label=U.cleanPrefix(text);
    if(!U.icons[key])return;
    btn.dataset.sr6Icon='1';
    btn.classList.add('iconized-btn');
    btn.innerHTML='<span class="action-icon">'+U.icons[key]+'</span><span class="action-label">'+esc(label||text)+'</span>';
  };

  U.decorate=function(){
    document.querySelectorAll('button').forEach(U.decorateButton);
    const sync=document.getElementById('sr-sync-btn');
    if(sync){
      sync.className='sync-floating sync-top-right';
      sync.innerHTML='<span class="sync-icon">'+U.icons.sync+'</span><span class="sync-text">Đồng bộ</span>';
      sync.setAttribute('aria-label','Đồng bộ dữ liệu');
      sync.setAttribute('title','Đồng bộ dữ liệu');
    }
    document.querySelectorAll('.fab').forEach(b=>{
      if(b.dataset.sr6Fab)return;
      b.dataset.sr6Fab='1';
      if((b.textContent||'').trim()==='+')b.innerHTML=U.icons.plus;
    });
  };



  let sr6BaseViewport=window.visualViewport?.height||window.innerHeight||700;
  U.mobileViewportFix=function(){
    const vv=window.visualViewport;
    const h=Math.max(280,Math.round(vv?.height||window.innerHeight||700));
    const top=Math.max(0,Math.round(vv?.offsetTop||0));
    const full=Math.max(window.innerHeight||h,sr6BaseViewport||h);
    const keyboard=(full-h)>130 || h<full*.78;
    document.documentElement.style.setProperty('--sr-vv-height',h+'px');
    document.documentElement.style.setProperty('--sr-vv-top',top+'px');
    document.body.classList.toggle('sr-keyboard-open',keyboard);
    if(!keyboard)sr6BaseViewport=Math.max(sr6BaseViewport,h);
  };
  window.visualViewport?.addEventListener('resize',U.mobileViewportFix);
  window.visualViewport?.addEventListener('scroll',U.mobileViewportFix);
  window.addEventListener('resize',U.mobileViewportFix,{passive:true});
  document.addEventListener('focusin',e=>{
    if(!e.target?.matches?.('input,select,textarea'))return;
    setTimeout(()=>{
      U.mobileViewportFix();
      if(e.target.closest('#sheet-overlay')){
        try{e.target.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch{e.target.scrollIntoView()}
      }
    },260);
  },true);
  document.addEventListener('focusout',()=>setTimeout(U.mobileViewportFix,180),true);
  U.mobileViewportFix();

  U.mobileModalFix=function(){
    const open=!!document.getElementById('sheet-overlay');
    document.body.classList.toggle('sr-modal-open',open);
    const sync=document.getElementById('sr-sync-btn');
    if(sync&&window.innerWidth<=560){
      const t=sync.querySelector('.sync-text'); if(t)t.style.display='none';
      sync.style.width='42px'; sync.style.minWidth='42px'; sync.style.height='42px'; sync.style.padding='0';
    }
  };

  let raf=0;
  const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{U.decorate();U.mobileModalFix()})};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>{U.decorate();if(state?.profile&&!state?.publicCatalog)render()});
  setTimeout(()=>{U.decorate();U.mobileModalFix()},250);
})();
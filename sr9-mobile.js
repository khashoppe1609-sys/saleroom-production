/* SaleRoom v9 mobile runtime */
window.SR9=window.SR9||{};
(() => {
  const M=window.SR9;
  let baseViewport=window.visualViewport?.height||window.innerHeight;
  let focusTimer=0;

  M.updateViewport=()=>{
    const vv=window.visualViewport;
    const h=Math.max(320,Math.round(vv?.height||window.innerHeight||700));
    document.documentElement.style.setProperty('--sr-vvh',h+'px');

    const full=Math.max(window.innerHeight||h,baseViewport||h);
    const keyboard=(full-h)>140 || h<full*.76;
    document.body.classList.toggle('sr-keyboard-open',keyboard);
    if(!keyboard)baseViewport=Math.max(baseViewport,h);
  };

  M.updateModalState=()=>{
    const modal=!!document.querySelector('.overlay');
    document.body.classList.toggle('sr-modal-open',modal);
  };

  M.ensureFocusedVisible=e=>{
    const el=e.target;
    if(!el?.matches?.('input,select,textarea'))return;
    clearTimeout(focusTimer);
    focusTimer=setTimeout(()=>{
      if(el.closest('.sheet')){
        try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})}catch{el.scrollIntoView()}
      }
    },280);
  };

  M.markStandalone=()=>{
    const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone===true;
    document.body.classList.toggle('sr-standalone',!!standalone);
  };

  const observer=new MutationObserver(()=>{
    M.updateModalState();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.visualViewport?.addEventListener('resize',M.updateViewport);
  window.visualViewport?.addEventListener('scroll',M.updateViewport);
  window.addEventListener('resize',M.updateViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(M.updateViewport,120),{passive:true});
  document.addEventListener('focusin',M.ensureFocusedVisible,true);
  document.addEventListener('focusout',()=>setTimeout(M.updateViewport,160),true);

  window.addEventListener('load',()=>{
    M.updateViewport();
    M.updateModalState();
    M.markStandalone();
    setTimeout(M.updateViewport,300);
  });
  M.updateViewport();
  M.updateModalState();
})();
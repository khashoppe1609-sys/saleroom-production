/* SaleRoom v8 uploads: resumable TUS + progress + thumbnails + image ordering */
window.SR8 = window.SR8 || {};
(() => {
  const O=window.SR8;
  const M=window.SR7;

  O.activeUpload=null;
  O.activeReject=null;
  O.paused=false;

  O.rawKey=(roomId,file,kind)=>[
    'saleroom',state.profile?.organization_id||'org',roomId,kind,
    file?.name||'file',file?.size||0,file?.lastModified||0
  ].join(':');

  O.safeName=name=>String(name||'file').replace(/[^a-zA-Z0-9._-]/g,'-');

  O.pathKey=resumeKey=>'sr8:path:'+resumeKey;

  O.getStablePath=(roomId,file,folder,resumeKey)=>{
    const key=O.pathKey(resumeKey);
    let path=localStorage.getItem(key);
    if(path)return path;
    const token=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
    path=state.profile.organization_id+'/'+roomId+'/'+folder+'/'+token+'-'+O.safeName(file.name);
    localStorage.setItem(key,path);
    return path;
  };

  O.ensureProgress=()=>{
    let el=document.getElementById('sr8-upload-progress');
    if(el)return el;
    el=document.createElement('div');
    el.id='sr8-upload-progress';
    el.className='upload-progress-card';
    el.innerHTML='<div class="upload-progress-head"><div><b id="sr8-progress-title">Đang upload…</b><span id="sr8-progress-detail"></span></div><strong id="sr8-progress-pct">0%</strong></div><div class="upload-progress-track"><i id="sr8-progress-bar"></i></div><div class="upload-progress-actions"><button id="sr8-pause-btn" onclick="SR8.pauseActiveUpload()">⏸ Tạm dừng</button></div>';
    document.body.appendChild(el);
    return el;
  };

  O.showProgress=(title,pct=0,detail='',canPause=false)=>{
    const el=O.ensureProgress();
    el.classList.add('show');
    const p=Math.max(0,Math.min(100,Number(pct)||0));
    el.querySelector('#sr8-progress-title').textContent=title||'Đang xử lý…';
    el.querySelector('#sr8-progress-detail').textContent=detail||'';
    el.querySelector('#sr8-progress-pct').textContent=Math.round(p)+'%';
    el.querySelector('#sr8-progress-bar').style.width=p+'%';
    const btn=el.querySelector('#sr8-pause-btn');
    btn.style.display=canPause?'inline-flex':'none';
  };

  O.hideProgress=()=>{
    document.getElementById('sr8-upload-progress')?.classList.remove('show');
  };

  O.pauseActiveUpload=async()=>{
    if(!O.activeUpload)return;
    O.paused=true;
    try{await O.activeUpload.abort(false)}catch{}
    O.activeUpload=null;
    const reject=O.activeReject;O.activeReject=null;
    if(reject)reject(new Error('__UPLOAD_PAUSED__'));
  };

  O.projectRef=()=>{
    try{return new URL(cfg.SUPABASE_URL).hostname.split('.')[0]}catch{return 'qvistojgyvnaqewiwxvv'}
  };

  O.uploadResumable=async({file,path,resumeKey,label,onProgress})=>{
    if(!file)throw new Error('Thiếu file upload');
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw new Error('Phiên đăng nhập đã hết hạn');

    if(!window.tus?.Upload){
      const {error}=await client.storage.from('room-media').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});
      if(error)throw error;
      onProgress?.(100);
      return path;
    }

    const endpoint='https://'+O.projectRef()+'.storage.supabase.co/storage/v1/upload/resumable';
    return await new Promise((resolve,reject)=>{
      O.paused=false;
      O.activeReject=reject;
      const upload=new tus.Upload(file,{
        endpoint,
        retryDelays:[0,3000,5000,10000,20000],
        headers:{authorization:'Bearer '+session.access_token},
        uploadDataDuringCreation:true,
        removeFingerprintOnSuccess:true,
        storeFingerprintForResuming:true,
        chunkSize:6*1024*1024,
        fingerprint:()=>Promise.resolve(resumeKey+'|'+path),
        metadata:{
          bucketName:'room-media',
          objectName:path,
          contentType:file.type||'application/octet-stream',
          cacheControl:'31536000'
        },
        onError:error=>{
          O.activeUpload=null;O.activeReject=null;
          reject(error);
        },
        onProgress:(sent,total)=>{
          const pct=total?sent/total*100:0;
          onProgress?.(pct,sent,total);
        },
        onSuccess:()=>{
          O.activeUpload=null;O.activeReject=null;
          localStorage.removeItem(O.pathKey(resumeKey));
          resolve(path);
        }
      });
      O.activeUpload=upload;
      upload.findPreviousUploads().then(prev=>{
        if(prev.length)upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      }).catch(reject);
    });
  };

  O.makeVideoThumbnail=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),video=document.createElement('video');
    let done=false;
    const cleanup=()=>{if(done)return;done=true;video.pause();video.remove();URL.revokeObjectURL(url)};
    const fail=e=>{cleanup();reject(e instanceof Error?e:new Error('Không tạo được thumbnail video'))};
    video.muted=true;video.playsInline=true;video.preload='auto';video.src=url;
    video.style.cssText='position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0';
    document.body.appendChild(video);
    video.onloadedmetadata=()=>{
      try{video.currentTime=Math.min(Math.max(.2,(video.duration||1)*.08),1.2)}catch{}
    };
    video.onseeked=async()=>{
      try{
        const w=video.videoWidth||480,h=video.videoHeight||854,scale=Math.min(1,640/Math.max(w,h));
        const canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.round(w*scale));canvas.height=Math.max(2,Math.round(h*scale));
        const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(video,0,0,canvas.width,canvas.height);
        let blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.62));
        let ext='webp',type='image/webp';
        if(!blob||blob.type!=='image/webp'){blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.65));ext='jpg';type='image/jpeg'}
        cleanup();
        if(!blob)return resolve(null);
        resolve(new File([blob],'video-thumbnail.'+ext,{type,lastModified:Date.now()}));
      }catch(e){fail(e)}
    };
    video.onerror=()=>fail(new Error('Trình duyệt không đọc được video để tạo thumbnail'));
    setTimeout(()=>{if(!done)fail(new Error('Tạo thumbnail quá thời gian'))},12000);
  });

  window.uploadRoomImages=async function(roomId,files){
    const rawFiles=[...(files||[])].filter(f=>f.type?.startsWith('image/'));
    if(!LIVE||!rawFiles.length)return;
    let inserted=0,originalBytes=0,finalBytes=0;
    try{
      const {data:existing,error:e0}=await client.from('room_images').select('id,sort_order').eq('room_id',roomId).order('sort_order');
      if(e0)throw e0;
      let order=(existing||[]).length;

      for(let i=0;i<rawFiles.length;i++){
        const raw=rawFiles[i];
        originalBytes+=raw.size;
        O.showProgress('Đang tối ưu ảnh '+(i+1)+'/'+rawFiles.length,Math.round(i/rawFiles.length*100),raw.name,false);
        const file=await M.compressImage(raw);
        finalBytes+=file.size;

        const safe=O.safeName(file.name);
        const token=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
        const path=state.profile.organization_id+'/'+roomId+'/images/'+token+'-'+safe;

        const basePct=i/rawFiles.length*100;
        O.showProgress('Đang upload ảnh '+(i+1)+'/'+rawFiles.length,basePct,raw.name,false);
        const {error:up}=await client.storage.from('room-media').upload(path,file,{
          cacheControl:'31536000',
          upsert:false,
          contentType:file.type
        });
        if(up)throw up;

        O.showProgress('Đang lưu ảnh '+(i+1)+'/'+rawFiles.length,((i+.85)/rawFiles.length)*100,raw.name,false);
        const {data:urlData}=client.storage.from('room-media').getPublicUrl(path);
        const {error:db}=await client.from('room_images').insert({
          organization_id:state.profile.organization_id,
          room_id:roomId,
          storage_path:path,
          public_url:urlData.publicUrl,
          sort_order:order++,
          created_by:state.profile.id
        });
        if(db){await client.storage.from('room-media').remove([path]);throw db}
        inserted++;
        O.showProgress('Đã thêm ảnh '+inserted+'/'+rawFiles.length,(inserted/rawFiles.length)*100,raw.name,false);
      }

      await syncData(true);
      try{closeSheet()}catch{}
      openRoom(roomId);
      const saved=originalBytes?Math.max(0,Math.round((1-finalBytes/originalBytes)*100)):0;
      toast('Đã thêm '+inserted+' ảnh'+(saved?' · giảm khoảng '+saved+'% dung lượng':''),5000);
    }catch(e){
      console.error('SaleRoom image upload failed',e);
      toast('Không thêm được ảnh: '+errMessage(e),6500);
    }finally{
      O.hideProgress();
      O.activeUpload=null;
      O.activeReject=null;
    }
  };

  window.uploadRoomVideo=async function(roomId,files){
    const raw=[...(files||[])].find(f=>f.type.startsWith('video/'));if(!LIVE||!raw)return;
    let videoPath=null,thumbPath=null;
    try{
      const {count,error:cErr}=await client.from('room_videos').select('id',{count:'exact',head:true}).eq('room_id',roomId);
      if(cErr)throw cErr;if(Number(count||0)>=3)throw new Error('Mỗi phòng tối đa 3 video');

      O.showProgress('Đang nén video siêu nhẹ',0,'480p · bỏ âm thanh',false);
      const result=await M.compressVideo(raw);
      const file=result.file;
      O.showProgress('Đang tạo ảnh xem trước',2,'Thumbnail video',false);
      let thumb=null;
      try{thumb=await O.makeVideoThumbnail(file)}catch(e){console.warn(e)}

      const resumeKey=O.rawKey(roomId,raw,'video');
      videoPath=O.getStablePath(roomId,file,'videos',resumeKey);
      await O.uploadResumable({
        file,path:videoPath,resumeKey,
        onProgress:p=>O.showProgress('Đang upload video',p*.92,Math.round(p)+'% · '+M.formatBytes(file.size),true)
      });

      let thumbnailUrl=null;
      if(thumb){
        const thumbKey=resumeKey+':thumbnail';
        thumbPath=O.getStablePath(roomId,thumb,'video-thumbnails',thumbKey);
        await O.uploadResumable({
          file:thumb,path:thumbPath,resumeKey:thumbKey,
          onProgress:p=>O.showProgress('Đang upload thumbnail',92+p*.08,Math.round(p)+'%',true)
        });
        thumbnailUrl=client.storage.from('room-media').getPublicUrl(thumbPath).data.publicUrl;
      }

      const publicUrl=client.storage.from('room-media').getPublicUrl(videoPath).data.publicUrl;
      const {data:maxRow}=await client.from('room_videos').select('sort_order').eq('room_id',roomId).order('sort_order',{ascending:false}).limit(1).maybeSingle();
      const {error:db}=await client.from('room_videos').insert({
        organization_id:state.profile.organization_id,room_id:roomId,
        storage_path:videoPath,public_url:publicUrl,
        thumbnail_storage_path:thumbPath,thumbnail_url:thumbnailUrl,
        sort_order:Number(maxRow?.sort_order??-1)+1,
        duration_seconds:result.duration,mime_type:file.type,size_bytes:file.size,created_by:state.profile.id
      });
      if(db){
        await client.storage.from('room-media').remove([videoPath,thumbPath].filter(Boolean));
        throw db;
      }
      O.showProgress('Hoàn tất video',100,M.formatBytes(file.size),false);
      await syncData(true);try{closeSheet()}catch{};openRoom(roomId);
      const saved=result.originalSize?Math.max(0,Math.round((1-file.size/result.originalSize)*100)):0;
      toast('Đã thêm video '+M.formatBytes(file.size)+(saved?' · giảm '+saved+'%':''),6000);
    }catch(e){
      if(e?.message==='__UPLOAD_PAUSED__')toast('Video đã tạm dừng. Chọn lại cùng video để tiếp tục.',6000);
      else toast(errMessage(e),6500);
    }finally{O.hideProgress();O.activeUpload=null;O.activeReject=null}
  };

  window.moveRoomImage=async function(roomId,imageId,delta){
    try{
      const {data,error}=await client.from('room_images').select('id,sort_order').eq('room_id',roomId).order('sort_order').order('created_at');
      if(error)throw error;
      const rows=data||[],idx=rows.findIndex(x=>x.id===imageId),to=idx+Number(delta);
      if(idx<0||to<0||to>=rows.length)return;
      [rows[idx],rows[to]]=[rows[to],rows[idx]];
      for(let i=0;i<rows.length;i++){
        const {error:e}=await client.from('room_images').update({sort_order:i}).eq('id',rows[i].id);if(e)throw e;
      }
      await syncData(true);try{closeSheet()}catch{};openRoom(roomId);toast('Đã đổi thứ tự ảnh');
    }catch(e){toast(errMessage(e),4500)}
  };

  const prevDeleteVideo=window.deleteRoomVideo;
  window.deleteRoomVideo=async function(roomId,videoId){
    if(!confirm('Xóa video này?'))return;
    try{
      const {data,error}=await client.from('room_videos').select('storage_path,thumbnail_storage_path').eq('id',videoId).single();if(error)throw error;
      const paths=[data?.storage_path,data?.thumbnail_storage_path].filter(Boolean);
      if(paths.length)await client.storage.from('room-media').remove(paths);
      const {error:db}=await client.from('room_videos').delete().eq('id',videoId);if(db)throw db;
      await syncData(true);try{closeSheet()}catch{};openRoom(roomId);toast('Đã xóa video');
    }catch(e){toast(errMessage(e),4500)}
  };

  M.renderManager=async function(roomId){
    if(!LIVE||!state.profile)return;
    const [imgs,vids]=await Promise.all([
      client.from('room_images').select('id,public_url,storage_path,sort_order,created_at').eq('room_id',roomId).order('sort_order').order('created_at'),
      client.from('room_videos').select('*').eq('room_id',roomId).order('sort_order').order('created_at')
    ]);
    if(imgs.error||vids.error)return;
    const sheet=document.querySelector('.sheet');if(!sheet)return;
    const upload=sheet.querySelector('.upload-box');
    if(upload){
      upload.innerHTML='<div class="media-upload-actions"><label class="btn ghost media-upload-btn">🖼 Thêm ảnh<input type="file" accept="image/*" multiple hidden onchange="SR13.previewPendingMedia(this.files,this.closest(\'.upload-box\'),\'image\');requestAnimationFrame(()=>uploadRoomImages(\''+roomId+'\',this.files))"></label><label class="btn primary media-upload-btn">🎬 Thêm video<input type="file" accept="video/*" hidden onchange="SR13.previewPendingMedia(this.files,this.closest(\'.upload-box\'),\'video\');requestAnimationFrame(()=>uploadRoomVideo(\''+roomId+'\',this.files))"></label></div><small>Ảnh số 1 là đại diện. Có thể đổi thứ tự. Upload có % tiến trình và tự tiếp tục khi mạng gián đoạn.</small>';
    }
    sheet.querySelector('.room-media-manager')?.remove();
    const section=document.createElement('section');section.className='room-media-manager';
    const imageRows=imgs.data||[];
    const imageCards=imageRows.map((x,i)=>'<div class="media-item image-item">'+
      '<div class="media-preview"><img src="'+esc(x.public_url)+'" alt="Ảnh phòng">'+(i===0?'<span class="cover-badge">★ ẢNH ĐẠI DIỆN</span>':'<span class="order-badge">#'+(i+1)+'</span>')+'</div>'+
      '<div class="media-order-actions">'+
        '<button '+(i===0?'disabled':'')+' onclick="moveRoomImage(\''+roomId+'\',\''+x.id+'\',-1)">↑</button>'+
        '<button '+(i===imageRows.length-1?'disabled':'')+' onclick="moveRoomImage(\''+roomId+'\',\''+x.id+'\',1)">↓</button>'+
      '</div>'+
      '<div class="media-actions">'+(i===0?'<span class="media-status">Đang đại diện</span>':'<button onclick="setRoomCover(\''+roomId+'\',\''+x.id+'\')">★ Đại diện</button>')+
      '<button class="danger-mini" onclick="deleteRoomImage(\''+roomId+'\',\''+x.id+'\')">🗑</button></div></div>').join('');

    const videoCards=(vids.data||[]).map((v,i)=>'<div class="media-item video-item">'+
      '<video src="'+esc(v.public_url)+'" '+(v.thumbnail_url?'poster="'+esc(v.thumbnail_url)+'"':'')+' controls playsinline preload="metadata"></video>'+
      '<div class="video-meta"><b>🎬 Video '+(i+1)+'</b><span>'+M.formatDuration(v.duration_seconds)+' · '+M.formatBytes(v.size_bytes)+'</span></div>'+
      '<div class="media-actions"><span class="media-status">'+(v.thumbnail_url?'Có thumbnail':'Chưa có thumbnail')+'</span><button class="danger-mini" onclick="deleteRoomVideo(\''+roomId+'\',\''+v.id+'\')">🗑</button></div></div>').join('');

    section.innerHTML='<div class="section-title compact"><h3>🖼 Media phòng</h3><span>'+imageRows.length+' ảnh · '+(vids.data||[]).length+' video</span></div>'+
      '<p class="media-tip">Dùng ↑ ↓ để sắp xếp. Ảnh #1 luôn là ảnh đại diện trên Kho phòng và Catalog.</p>'+
      '<div class="media-list">'+(imageCards||'<div class="empty-mini">Chưa có ảnh.</div>')+'</div>'+
      ((vids.data||[]).length?'<div class="video-divider">VIDEO · LUÔN SAU ẢNH</div><div class="media-list video-list">'+videoCards+'</div>':'');
    const sticky=sheet.querySelector('.sticky-cta'),anchor=upload||sheet.querySelector('.internal-box')||sticky;
    if(anchor)anchor.insertAdjacentElement('afterend',section);else sheet.appendChild(section);
  };

  const prevPublicOpen=window.openPublicRoom;
  window.openPublicRoom=function(roomId){
    prevPublicOpen(roomId);
    requestAnimationFrame(()=>{
      const r=(state.publicCatalog?.rooms||[]).find(x=>x.id===roomId);
      if(!r)return;
      const videos=r.videos||[];
      document.querySelectorAll('.public-video-section .public-video-card video').forEach((el,i)=>{
        if(videos[i]?.thumbnail_url)el.poster=videos[i].thumbnail_url;
      });
    });
  };
})();
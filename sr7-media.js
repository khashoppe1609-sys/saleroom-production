/* SaleRoom v7 media manager: cover image + compressed room video */
window.SR7 = window.SR7 || {};
(() => {
  const M=window.SR7;
  const S5=window.SR5||{};

  M.formatBytes=n=>{
    const v=Number(n||0); if(!v)return '';
    if(v<1024)return v+' B';
    if(v<1024*1024)return (v/1024).toFixed(1)+' KB';
    return (v/1024/1024).toFixed(1)+' MB';
  };
  M.formatDuration=n=>{
    const sec=Math.max(0,Math.round(Number(n||0)));
    return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
  };

  M.loadVideos=async function(){
    if(!LIVE||!state.profile?.organization_id)return;
    const {data,error}=await client.from('room_videos').select('*').order('sort_order').order('created_at');
    if(error){console.warn('room_videos',error);return}
    const byRoom={};
    for(const v of data||[])(byRoom[v.room_id]||=[]).push(v);
    for(const r of state.rooms||[]){
      r.room_videos=byRoom[r.id]||[];
      r.videos=(r.room_videos||[]).map(v=>v.public_url).filter(Boolean);
    }
  };

  const prevHydrateV7=hydrate;
  hydrate=async function(){
    await prevHydrateV7();
    await M.loadVideos();
    if(state.profile)render();
  };

  M.compressImage=async function(file){
    if(!file?.type?.startsWith('image/'))return file;
    if(file.size>25*1024*1024)throw new Error(file.name+' lớn hơn 25MB');
    let bitmap;
    try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
    catch{
      bitmap=await new Promise((resolve,reject)=>{
        const img=new Image(),url=URL.createObjectURL(file);
        img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
        img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};
        img.src=url;
      });
    }
    const w=bitmap.width||bitmap.naturalWidth,h=bitmap.height||bitmap.naturalHeight;
    const scale=Math.min(1,1400/Math.max(w,h));
    const nw=Math.max(1,Math.round(w*scale)),nh=Math.max(1,Math.round(h*scale));
    const canvas=document.createElement('canvas');canvas.width=nw;canvas.height=nh;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,nw,nh);ctx.drawImage(bitmap,0,0,nw,nh);bitmap.close?.();
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.72));
    let ext='webp',type='image/webp';
    if(!blob||blob.type!=='image/webp'){
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.74));
      ext='jpg';type='image/jpeg';
    }
    if(!blob)return file;
    if(blob.size>=file.size&&scale===1)return file;
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+ext,{type,lastModified:Date.now()});
  };
  if(S5)S5.compressImage=M.compressImage;

  M.getVideoMeta=file=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),v=document.createElement('video');
    v.preload='metadata';v.muted=true;v.playsInline=true;v.src=url;
    v.onloadedmetadata=()=>{
      const meta={duration:Number(v.duration||0),width:v.videoWidth||0,height:v.videoHeight||0};
      URL.revokeObjectURL(url);resolve(meta);
    };
    v.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Không đọc được video'))};
  });

  M.pickRecorderMime=()=>{
    if(!window.MediaRecorder)return '';
    const choices=['video/webm;codecs=vp8','video/webm','video/mp4'];
    return choices.find(x=>MediaRecorder.isTypeSupported?.(x))||'';
  };

  M.compressVideo=async function(file){
    if(!file?.type?.startsWith('video/'))throw new Error('File không phải video');
    if(file.size>350*1024*1024)throw new Error('Video gốc lớn hơn 350MB');
    const meta=await M.getVideoMeta(file);
    if(meta.duration>180)throw new Error('Video tối đa 3 phút. Hãy cắt ngắn video trước khi upload.');
    if(!meta.duration)throw new Error('Không xác định được thời lượng video');

    const canCompress=!!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream);
    if(!canCompress){
      if(file.size>25*1024*1024)throw new Error('Thiết bị này không hỗ trợ nén video. Hãy chọn video dưới 25MB.');
      return {file,duration:meta.duration,compressed:false,originalSize:file.size};
    }

    const src=URL.createObjectURL(file);
    const video=document.createElement('video');
    video.src=src;video.muted=true;video.playsInline=true;video.preload='auto';
    video.style.cssText='position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(video);
    try{
      await new Promise((resolve,reject)=>{
        video.oncanplay=resolve;video.onerror=()=>reject(new Error('Không thể mở video để nén'));
        video.load();
      });
      const w=video.videoWidth||meta.width,h=video.videoHeight||meta.height;
      const scale=Math.min(1,854/Math.max(1,w),480/Math.max(1,h));
      const nw=Math.max(2,Math.round(w*scale/2)*2),nh=Math.max(2,Math.round(h*scale/2)*2);
      const canvas=document.createElement('canvas');canvas.width=nw;canvas.height=nh;
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.fillStyle='#000';ctx.fillRect(0,0,nw,nh);
      const stream=canvas.captureStream(15);
      const mime=M.pickRecorderMime();
      const opts={videoBitsPerSecond:280000};
      if(mime)opts.mimeType=mime;
      let recorder;
      try{recorder=new MediaRecorder(stream,opts)}
      catch{
        if(file.size>25*1024*1024)throw new Error('Thiết bị không thể nén video này. Hãy dùng video dưới 25MB.');
        return {file,duration:meta.duration,compressed:false,originalSize:file.size};
      }
      const chunks=[];
      const stopped=new Promise((resolve,reject)=>{
        recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
        recorder.onerror=e=>reject(e.error||new Error('Lỗi nén video'));
        recorder.onstop=resolve;
      });
      recorder.start(1000);
      let raf=0;
      const draw=()=>{
        if(video.ended||video.paused)return;
        try{ctx.drawImage(video,0,0,nw,nh)}catch{}
        raf=requestAnimationFrame(draw);
      };
      video.currentTime=0;
      await video.play();
      draw();
      await new Promise(resolve=>video.addEventListener('ended',resolve,{once:true}));
      cancelAnimationFrame(raf);
      if(recorder.state!=='inactive')recorder.stop();
      await stopped;
      const outType=recorder.mimeType||mime||'video/webm';
      const blob=new Blob(chunks,{type:outType});
      if(!blob.size)throw new Error('Không tạo được video nén');
      const ext=outType.includes('mp4')?'mp4':'webm';
      const out=new File([blob],file.name.replace(/\.[^.]+$/,'')+'-compressed.'+ext,{type:outType,lastModified:Date.now()});
      const chosen=out.size<file.size?out:file;
      return {file:chosen,duration:meta.duration,compressed:chosen===out,originalSize:file.size};
    }finally{
      video.pause();video.remove();URL.revokeObjectURL(src);
    }
  };

  window.uploadRoomImages=async function(roomId,files){
    if(!LIVE||!files?.length)return;
    try{
      setLoading(true,'Đang nén ảnh…');
      const {data:existing,error:e0}=await client.from('room_images').select('id,sort_order').eq('room_id',roomId).order('sort_order');
      if(e0)throw e0;
      let order=(existing||[]).length;
      let original=0,finalSize=0,count=0;
      for(const raw of [...files]){
        if(!raw.type.startsWith('image/'))continue;
        original+=raw.size;
        const file=await M.compressImage(raw);finalSize+=file.size;
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
        const token=globalThis.crypto?.randomUUID?.()||Date.now()+Math.random().toString(36).slice(2);
        const path=state.profile.organization_id+'/'+roomId+'/images/'+token+'-'+safe;
        const {error:up}=await client.storage.from('room-media').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});if(up)throw up;
        const {data:urlData}=client.storage.from('room-media').getPublicUrl(path);
        const {error:db}=await client.from('room_images').insert({organization_id:state.profile.organization_id,room_id:roomId,storage_path:path,public_url:urlData.publicUrl,sort_order:order++,created_by:state.profile.id});
        if(db){await client.storage.from('room-media').remove([path]);throw db}
        count++;
      }
      await syncData(true);closeSheet();openRoom(roomId);
      const saved=original?Math.max(0,Math.round((1-finalSize/original)*100)):0;
      toast('Đã thêm '+count+' ảnh'+(saved?' · giảm khoảng '+saved+'% dung lượng':''),5000);
    }catch(e){toast(errMessage(e),5500)}finally{setLoading(false)}
  };

  window.uploadRoomVideo=async function(roomId,files){
    if(!LIVE||!files?.length)return;
    const raw=[...files].find(f=>f.type.startsWith('video/'));if(!raw)return toast('Vui lòng chọn video');
    try{
      const {count,error:cErr}=await client.from('room_videos').select('id',{count:'exact',head:true}).eq('room_id',roomId);
      if(cErr)throw cErr;
      if(Number(count||0)>=3)throw new Error('Mỗi phòng tối đa 3 video');
      setLoading(true,'Đang nén video siêu nhẹ 480p…');
      const result=await M.compressVideo(raw);
      const file=result.file;
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
      const token=globalThis.crypto?.randomUUID?.()||Date.now()+Math.random().toString(36).slice(2);
      const path=state.profile.organization_id+'/'+roomId+'/videos/'+token+'-'+safe;
      setLoading(true,'Đang upload video đã nén…');
      const {error:up}=await client.storage.from('room-media').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});if(up)throw up;
      const {data:urlData}=client.storage.from('room-media').getPublicUrl(path);
      const {data:maxRow}=await client.from('room_videos').select('sort_order').eq('room_id',roomId).order('sort_order',{ascending:false}).limit(1).maybeSingle();
      const {error:db}=await client.from('room_videos').insert({
        organization_id:state.profile.organization_id,room_id:roomId,storage_path:path,public_url:urlData.publicUrl,
        sort_order:Number(maxRow?.sort_order??-1)+1,duration_seconds:result.duration,mime_type:file.type,size_bytes:file.size,created_by:state.profile.id
      });
      if(db){await client.storage.from('room-media').remove([path]);throw db}
      await syncData(true);closeSheet();openRoom(roomId);
      const saved=result.originalSize?Math.max(0,Math.round((1-file.size/result.originalSize)*100)):0;
      toast('Đã thêm video '+M.formatBytes(file.size)+(saved?' · giảm '+saved+'%':''),6000);
    }catch(e){toast(errMessage(e),6500)}finally{setLoading(false)}
  };

  window.setRoomCover=async function(roomId,imageId){
    try{
      setLoading(true,'Đang đổi ảnh đại diện…');
      const {data,error}=await client.from('room_images').select('id,sort_order').eq('room_id',roomId).order('sort_order').order('created_at');
      if(error)throw error;
      const rows=data||[],selected=rows.find(x=>x.id===imageId);if(!selected)return;
      const ordered=[selected,...rows.filter(x=>x.id!==imageId)];
      for(let i=0;i<ordered.length;i++){
        const {error:e}=await client.from('room_images').update({sort_order:i}).eq('id',ordered[i].id);if(e)throw e;
      }
      await syncData(true);closeSheet();openRoom(roomId);toast('Đã đặt ảnh đại diện');
    }catch(e){toast(errMessage(e),4500)}finally{setLoading(false)}
  };

  M.normalizeImageOrder=async roomId=>{
    const {data}=await client.from('room_images').select('id').eq('room_id',roomId).order('sort_order').order('created_at');
    for(let i=0;i<(data||[]).length;i++)await client.from('room_images').update({sort_order:i}).eq('id',data[i].id);
  };

  window.deleteRoomImage=async function(roomId,imageId){
    if(!confirm('Xóa ảnh này?'))return;
    try{
      const {data,error}=await client.from('room_images').select('storage_path').eq('id',imageId).single();if(error)throw error;
      if(data?.storage_path)await client.storage.from('room-media').remove([data.storage_path]);
      const {error:db}=await client.from('room_images').delete().eq('id',imageId);if(db)throw db;
      await M.normalizeImageOrder(roomId);await syncData(true);closeSheet();openRoom(roomId);toast('Đã xóa ảnh');
    }catch(e){toast(errMessage(e),4500)}
  };

  window.deleteRoomVideo=async function(roomId,videoId){
    if(!confirm('Xóa video này?'))return;
    try{
      const {data,error}=await client.from('room_videos').select('storage_path').eq('id',videoId).single();if(error)throw error;
      if(data?.storage_path)await client.storage.from('room-media').remove([data.storage_path]);
      const {error:db}=await client.from('room_videos').delete().eq('id',videoId);if(db)throw db;
      await syncData(true);closeSheet();openRoom(roomId);toast('Đã xóa video');
    }catch(e){toast(errMessage(e),4500)}
  };

  window.deleteRoomImages=async function(roomId,e){
    try{e?.stopPropagation?.()}catch{}
    if(!canManage())return toast('Bạn không có quyền xóa ảnh');
    if(!confirm('Xóa toàn bộ ảnh của phòng? Video vẫn được giữ.'))return;
    try{
      setLoading(true,'Đang xóa toàn bộ ảnh…');
      const {data,error}=await client.from('room_images').select('storage_path').eq('room_id',roomId);if(error)throw error;
      const paths=(data||[]).map(x=>x.storage_path).filter(Boolean);
      if(paths.length)await client.storage.from('room-media').remove(paths);
      const {error:db}=await client.from('room_images').delete().eq('room_id',roomId);if(db)throw db;
      await syncData(true);closeSheet();openRoom(roomId);toast('Đã xóa toàn bộ ảnh');
    }catch(err){toast(errMessage(err),5000)}finally{setLoading(false)}
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
      upload.innerHTML='<div class="media-upload-actions"><label class="btn ghost media-upload-btn">🖼 Thêm ảnh<input type="file" accept="image/*" multiple hidden onchange="uploadRoomImages(\''+roomId+'\',this.files)"></label><label class="btn primary media-upload-btn">🎬 Thêm video<input type="file" accept="video/*" hidden onchange="uploadRoomVideo(\''+roomId+'\',this.files)"></label></div><small>Ảnh đầu tiên là ảnh đại diện. Video luôn nằm sau ảnh. Video được nén mạnh xuống khoảng 480p và bỏ âm thanh để tiết kiệm dung lượng.</small>';
    }
    sheet.querySelector('.room-media-manager')?.remove();
    const section=document.createElement('section');section.className='room-media-manager';
    const imageCards=(imgs.data||[]).map((x,i)=>'<div class="media-item image-item">'+
      '<div class="media-preview"><img src="'+esc(x.public_url)+'" alt="Ảnh phòng">'+(i===0?'<span class="cover-badge">★ ẢNH ĐẠI DIỆN</span>':'')+'</div>'+
      '<div class="media-actions">'+(i===0?'<span class="media-status">Đang đại diện</span>':'<button onclick="setRoomCover(\''+roomId+'\',\''+x.id+'\')">★ Đặt đại diện</button>')+
      '<button class="danger-mini" onclick="deleteRoomImage(\''+roomId+'\',\''+x.id+'\')">🗑</button></div></div>').join('');
    const videoCards=(vids.data||[]).map((v,i)=>'<div class="media-item video-item">'+
      '<video src="'+esc(v.public_url)+'" controls playsinline preload="metadata"></video>'+
      '<div class="video-meta"><b>🎬 Video '+(i+1)+'</b><span>'+M.formatDuration(v.duration_seconds)+' · '+M.formatBytes(v.size_bytes)+'</span></div>'+
      '<div class="media-actions"><span class="media-status">Luôn sau ảnh</span><button class="danger-mini" onclick="deleteRoomVideo(\''+roomId+'\',\''+v.id+'\')">🗑</button></div></div>').join('');
    section.innerHTML='<div class="section-title compact"><h3>🖼 Media phòng</h3><span>'+(imgs.data||[]).length+' ảnh · '+(vids.data||[]).length+' video</span></div>'+
      '<p class="media-tip">Ảnh số 1 là ảnh đại diện trên Kho phòng và Catalog.</p>'+
      '<div class="media-list">'+(imageCards||'<div class="empty-mini">Chưa có ảnh.</div>')+'</div>'+
      ((vids.data||[]).length?'<div class="video-divider">VIDEO · HIỂN THỊ SAU ẢNH</div><div class="media-list video-list">'+videoCards+'</div>':'');
    const sticky=sheet.querySelector('.sticky-cta');
    const anchor=upload||sheet.querySelector('.internal-box')||sticky;
    if(anchor)anchor.insertAdjacentElement('afterend',section);else sheet.appendChild(section);
  };

  const prevOpenRoomV7=openRoom;
  openRoom=function(id){
    prevOpenRoomV7(id);
    setTimeout(()=>M.renderManager(id),80);
  };

  const prevPublicCardV7=publicRoomCard;
  publicRoomCard=function(r){
    let h=prevPublicCardV7(r);
    const n=(r.videos||[]).length;
    if(n){
      h=h.replace('Xem chi tiết phòng & ảnh →','Xem ảnh & video →');
      h=h.replace('Xem chi tiết →','Xem ảnh & video →');
      h=h.replace('<div class="public-card-hint">','<div class="public-video-pill">🎬 '+n+' video</div><div class="public-card-hint">');
    }
    return h;
  };

  const prevOpenPublicRoomV7=window.openPublicRoom;
  window.openPublicRoom=function(roomId){
    prevOpenPublicRoomV7(roomId);
    requestAnimationFrame(()=>{
      const r=(state.publicCatalog?.rooms||[]).find(x=>x.id===roomId);
      const videos=r?.videos||[];if(!videos.length)return;
      const sheet=document.querySelector('.sheet');if(!sheet||sheet.querySelector('.public-video-section'))return;
      const sec=document.createElement('section');sec.className='public-video-section';
      sec.innerHTML='<div class="video-divider">🎬 VIDEO PHÒNG · SAU HÌNH ẢNH</div>'+
        videos.map((v,i)=>'<div class="public-video-card"><video src="'+esc(v.url)+'" controls playsinline preload="metadata"></video><small>Video '+(i+1)+(v.duration_seconds?' · '+M.formatDuration(v.duration_seconds):'')+'</small></div>').join('');
      const gallery=sheet.querySelector('.public-detail-gallery');
      const hero=sheet.querySelector('.detail-hero');
      const anchor=gallery||hero||sheet.querySelector('.sheet-head');
      anchor?.insertAdjacentElement('afterend',sec);
    });
  };

  setTimeout(()=>{if(state.profile)M.loadVideos().then(()=>render())},700);
})();
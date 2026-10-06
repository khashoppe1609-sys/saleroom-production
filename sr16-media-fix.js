/* SaleRoom v16 media hotfix — reliable iPhone/Android uploads */
window.SR16=window.SR16||{};
(() => {
  const X=window.SR16;
  const O=window.SR8||{};
  const M=window.SR7||{};

  X.maxBytes=50*1024*1024;
  X.isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(
    navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1
  );

  X.standardUpload=async(file,path)=>{
    const {error}=await client.storage.from('room-media').upload(path,file,{
      cacheControl:'31536000',
      upsert:false,
      contentType:file.type||'application/octet-stream'
    });
    if(error)throw error;
    return path;
  };

  O.uploadResumable=async({file,path,resumeKey,onProgress})=>{
    if(!file)throw new Error('Thiếu file upload');
    if(file.size>X.maxBytes)throw new Error('File vượt quá 50MB');

    if(file.size<=6*1024*1024||!window.tus?.Upload){
      await X.standardUpload(file,path);
      onProgress?.(100,file.size,file.size);
      return path;
    }

    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw new Error('Phiên đăng nhập đã hết hạn');

    const projectRef=(()=>{
      try{return new URL(cfg.SUPABASE_URL).hostname.split('.')[0]}
      catch{return 'qvistojgyvnaqewiwxvv'}
    })();
    const endpoint='https://'+projectRef+'.storage.supabase.co/storage/v1/upload/resumable';

    return await new Promise((resolve,reject)=>{
      O.paused=false;
      O.activeReject=reject;
      const upload=new tus.Upload(file,{
        endpoint,
        retryDelays:[0,3000,5000,10000,20000],
        headers:{
          authorization:'Bearer '+session.access_token,
          apikey:cfg.SUPABASE_PUBLISHABLE_KEY
        },
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
          O.activeUpload=null;O.activeReject=null;reject(error);
        },
        onProgress:(sent,total)=>{
          onProgress?.(total?sent/total*100:0,sent,total);
        },
        onSuccess:()=>{
          O.activeUpload=null;O.activeReject=null;
          try{localStorage.removeItem(O.pathKey(resumeKey))}catch{}
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

  window.uploadRoomImages=async function(roomId,files){
    const raws=[...(files||[])].filter(f=>f?.type?.startsWith('image/'));
    if(!LIVE||!raws.length)return;
    let added=0,original=0,finalSize=0;
    try{
      const {data:existing,error:e0}=await client.from('room_images')
        .select('id,sort_order').eq('room_id',roomId).order('sort_order');
      if(e0)throw e0;
      let order=(existing||[]).length;

      for(let i=0;i<raws.length;i++){
        const raw=raws[i];
        if(raw.size>X.maxBytes)throw new Error(raw.name+' lớn hơn 50MB');
        original+=raw.size;
        O.showProgress?.('Đang tối ưu ảnh '+(i+1)+'/'+raws.length,i/raws.length*100,raw.name,false);

        let file=raw;
        try{
          if(typeof M.compressImage==='function')file=await M.compressImage(raw);
        }catch(err){
          console.warn('SaleRoom image fallback to original',err);
          file=raw;
        }
        if(file.size>X.maxBytes)throw new Error(file.name+' lớn hơn 50MB');
        finalSize+=file.size;

        const safe=(O.safeName?O.safeName(file.name):file.name.replace(/[^a-zA-Z0-9._-]/g,'-'));
        const token=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
        const path=state.profile.organization_id+'/'+roomId+'/images/'+token+'-'+safe;

        O.showProgress?.('Đang upload ảnh '+(i+1)+'/'+raws.length,i/raws.length*100,raw.name,false);
        await X.standardUpload(file,path);

        const publicUrl=client.storage.from('room-media').getPublicUrl(path).data.publicUrl;
        const {error:db}=await client.from('room_images').insert({
          organization_id:state.profile.organization_id,
          room_id:roomId,
          storage_path:path,
          public_url:publicUrl,
          sort_order:order++,
          created_by:state.profile.id
        });
        if(db){
          await client.storage.from('room-media').remove([path]);
          throw db;
        }
        added++;
        O.showProgress?.('Đã thêm ảnh '+added+'/'+raws.length,added/raws.length*100,raw.name,false);
      }

      await syncData(true);
      try{closeSheet()}catch{}
      openRoom(roomId);
      const saved=original?Math.max(0,Math.round((1-finalSize/original)*100)):0;
      toast('Đã thêm '+added+' ảnh'+(saved?' · giảm khoảng '+saved+'% dung lượng':''),5500);
    }catch(e){
      console.error('SaleRoom v16 image upload',e);
      toast('Không thêm được ảnh: '+errMessage(e),7000);
    }finally{
      O.hideProgress?.();
      O.activeUpload=null;O.activeReject=null;
    }
  };

  window.uploadRoomVideo=async function(roomId,files){
    const raw=[...(files||[])].find(f=>f?.type?.startsWith('video/'));
    if(!LIVE||!raw)return;

    try{
      const {count,error:cErr}=await client.from('room_videos')
        .select('id',{count:'exact',head:true}).eq('room_id',roomId);
      if(cErr)throw cErr;
      if(Number(count||0)>=3)throw new Error('Mỗi phòng tối đa 3 video');

      if(raw.size>X.maxBytes){
        throw new Error('Video lớn hơn 50MB. Hãy cắt ngắn video trước khi tải lên.');
      }

      let result={file:raw,duration:null,compressed:false,originalSize:raw.size,fallback:true};

      // iOS PWA prioritizes reliability; Safari canvas/MediaRecorder transcoding can fail.
      if(!X.isIOS&&typeof M.compressVideo==='function'){
        O.showProgress?.('Đang tối ưu video',0,'Đang nén video trước khi upload',false);
        try{
          result=await M.compressVideo(raw);
        }catch(err){
          console.warn('SaleRoom video fallback to original',err);
          result={file:raw,duration:null,compressed:false,originalSize:raw.size,fallback:true};
        }
      }else{
        O.showProgress?.('Chuẩn bị video',0,'iPhone: ưu tiên upload ổn định',false);
      }

      const file=result.file||raw;
      if(file.size>X.maxBytes)throw new Error('Video sau tối ưu vẫn lớn hơn 50MB');

      if(!result.duration&&typeof M.getVideoMeta==='function'){
        try{result.duration=(await M.getVideoMeta(raw)).duration||null}catch{}
      }

      let thumb=null;
      try{
        if(typeof O.makeVideoThumbnail==='function')thumb=await O.makeVideoThumbnail(file);
      }catch(err){console.warn('Thumbnail skipped',err)}

      const resumeKey=O.rawKey?O.rawKey(roomId,raw,'video'):
        ['saleroom',roomId,raw.name,raw.size,raw.lastModified].join(':');

      const safe=(O.safeName?O.safeName(file.name):file.name.replace(/[^a-zA-Z0-9._-]/g,'-'));
      const token=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
      const videoPath=state.profile.organization_id+'/'+roomId+'/videos/'+token+'-'+safe;

      await O.uploadResumable({
        file,path:videoPath,resumeKey,
        onProgress:p=>O.showProgress?.('Đang upload video',p*.94,Math.round(p)+'% · '+(M.formatBytes?M.formatBytes(file.size):''),true)
      });

      let thumbnailUrl=null,thumbPath=null;
      if(thumb){
        const tsafe=(O.safeName?O.safeName(thumb.name):thumb.name);
        thumbPath=state.profile.organization_id+'/'+roomId+'/video-thumbnails/'+token+'-'+tsafe;
        await X.standardUpload(thumb,thumbPath);
        thumbnailUrl=client.storage.from('room-media').getPublicUrl(thumbPath).data.publicUrl;
      }

      const publicUrl=client.storage.from('room-media').getPublicUrl(videoPath).data.publicUrl;
      const {data:maxRow}=await client.from('room_videos').select('sort_order')
        .eq('room_id',roomId).order('sort_order',{ascending:false}).limit(1).maybeSingle();

      const {error:db}=await client.from('room_videos').insert({
        organization_id:state.profile.organization_id,
        room_id:roomId,
        storage_path:videoPath,
        public_url:publicUrl,
        thumbnail_storage_path:thumbPath,
        thumbnail_url:thumbnailUrl,
        sort_order:Number(maxRow?.sort_order??-1)+1,
        duration_seconds:result.duration,
        mime_type:file.type,
        size_bytes:file.size,
        created_by:state.profile.id
      });
      if(db){
        await client.storage.from('room-media').remove([videoPath,thumbPath].filter(Boolean));
        throw db;
      }

      O.showProgress?.('Hoàn tất video',100,M.formatBytes?M.formatBytes(file.size):'',false);
      await syncData(true);
      try{closeSheet()}catch{}
      openRoom(roomId);

      const saved=result.originalSize?
        Math.max(0,Math.round((1-file.size/result.originalSize)*100)):0;
      toast('Đã thêm video'+(saved?' · giảm '+saved+'% dung lượng':''),6000);
    }catch(e){
      if(e?.message==='__UPLOAD_PAUSED__'){
        toast('Video đã tạm dừng. Chọn lại cùng video để tiếp tục.',6000);
      }else{
        console.error('SaleRoom v16 video upload',e);
        toast('Không thêm được video: '+errMessage(e),7000);
      }
    }finally{
      O.hideProgress?.();
      O.activeUpload=null;O.activeReject=null;
    }
  };

  X.patchUploadBox=roomId=>{
    const sheet=document.querySelector('#sheet-overlay .sheet')||document.querySelector('.sheet');
    const upload=sheet?.querySelector('.upload-box');
    if(!upload)return;
    upload.innerHTML=
      '<div class="media-upload-actions native-room-media">'+
        '<div class="native-media-picker"><b>🖼 Thêm ảnh</b>'+
          '<input class="room-media-image-input" type="file" accept="image/*" multiple>'+
          '<span>Chọn ảnh trực tiếp từ thư viện</span></div>'+
        '<div class="native-media-picker"><b>🎬 Thêm video</b>'+
          '<input class="room-media-video-input" type="file" accept="video/*">'+
          '<span>Tối đa 50MB/file</span></div>'+
      '</div>'+
      '<small>Ảnh hiển thị preview ngay khi chọn. Video lớn dùng resumable upload 6MB/chunk.</small>';

    const img=upload.querySelector('.room-media-image-input');
    const vid=upload.querySelector('.room-media-video-input');

    img?.addEventListener('change',()=>{
      SR13?.previewPendingMedia?.(img.files,upload,'image');
      const selected=[...(img.files||[])];
      if(selected.length)setTimeout(()=>uploadRoomImages(roomId,selected),80);
    });
    vid?.addEventListener('change',()=>{
      SR13?.previewPendingMedia?.(vid.files,upload,'video');
      const selected=[...(vid.files||[])];
      if(selected.length)setTimeout(()=>uploadRoomVideo(roomId,selected),80);
    });
  };

  if(M&&typeof M.renderManager==='function'){
    const previous=M.renderManager;
    M.renderManager=async function(roomId){
      await previous(roomId);
      X.patchUploadBox(roomId);
    };
  }

  // If a room sheet is already open when this module loads.
  setTimeout(()=>{
    const sheet=document.querySelector('#sheet-overlay .sheet')||document.querySelector('.sheet');
    if(!sheet)return;
    const title=sheet.querySelector('.room-code')?.textContent||'';
    if(title){
      const room=(state.rooms||[]).find(r=>title.includes(r.code));
      if(room)X.patchUploadBox(room.id);
    }
  },300);
})();
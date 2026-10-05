/* SaleRoom v5 image compression */
(() => {
  const S=window.SR5;
  S.compressImage=async function(file){
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
    const scale=Math.min(1,1600/Math.max(w,h));
    const nw=Math.max(1,Math.round(w*scale)),nh=Math.max(1,Math.round(h*scale));
    const canvas=document.createElement('canvas');canvas.width=nw;canvas.height=nh;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,nw,nh);ctx.drawImage(bitmap,0,0,nw,nh);
    bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
    if(!blob)return file;
    if(blob.size>=file.size&&scale===1)return file;
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
  };

  window.uploadRoomImages=async function(roomId,files){
    if(!LIVE||!files?.length)return;
    try{
      setLoading(true,'Đang tối ưu '+files.length+' ảnh…');
      let order=(state.rooms.find(r=>r.id===roomId)?.room_images||[]).length;
      let originalBytes=0,uploadedBytes=0;
      for(const original of [...files]){
        if(!original.type.startsWith('image/'))continue;
        originalBytes+=original.size;
        const file=await S.compressImage(original);uploadedBytes+=file.size;
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
        const token=globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random().toString(36).slice(2);
        const path=state.profile.organization_id+'/'+roomId+'/'+token+'-'+safe;
        const {error:upErr}=await client.storage.from('room-media').upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type});
        if(upErr)throw upErr;
        const {data:urlData}=client.storage.from('room-media').getPublicUrl(path);
        const {error:dbErr}=await client.from('room_images').insert({organization_id:state.profile.organization_id,room_id:roomId,storage_path:path,public_url:urlData.publicUrl,sort_order:order++,created_by:state.profile.id});
        if(dbErr){await client.storage.from('room-media').remove([path]);throw dbErr}
      }
      await syncData(true);closeSheet();openRoom(roomId);
      const saved=originalBytes>0?Math.max(0,Math.round((1-uploadedBytes/originalBytes)*100)):0;
      toast('Upload ảnh thành công'+(saved?' · giảm khoảng '+saved+'% dung lượng':''),5000);
    }catch(e){toast(errMessage(e),5000)}finally{setLoading(false)}
  };
})();
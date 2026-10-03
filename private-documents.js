(function(){
 'use strict';
 document.addEventListener('click',async function(event){
  const button=event.target.closest('[data-private-document]');if(!button||button.disabled)return;
  let path=button.dataset.privateDocument;
  try{
   if(/^https?:\/\//i.test(path)){
    const url=new URL(path),base=new URL(SUPABASE_URL),prefix='/storage/v1/object/public/documentos-clientes/';
    if(url.origin!==base.origin||!url.pathname.startsWith(prefix))throw new Error('invalid_path');
    path=decodeURIComponent(url.pathname.slice(prefix.length));
   }
   if(!path||path.includes('..'))throw new Error('invalid_path');
   button.disabled=true;
   const {data,error}=await supabaseClient.storage.from('documentos-clientes').createSignedUrl(path,60);
   if(error||!data?.signedUrl)throw new Error('document_unavailable');
   // Navigation occurs only after the server authorizes access. No public URL fallback.
   window.location.assign(data.signedUrl);
  }catch(error){alert('Não foi possível abrir o documento. Confira sua sessão e tente novamente.');}
  finally{button.disabled=false;}
 });
})();

// Offline tests: simulated DOM and Supabase. No network or database writes.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ids=new Map();
class Element {
  constructor(tag='div'){this.tagName=tag;this.value='';this.children=[];this.dataset={};this.style={};}
  set id(v){this._id=v;ids.set(v,this);}get id(){return this._id;}
  append(...children){children.forEach(c=>{this.children.push(c);c.parent=this;});}
  appendChild(c){this.append(c);return c;}
  replaceChildren(...children){this.children=[];this.append(...children);}
  add(c){this.append(c);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);if(this.id)ids.delete(this.id);}
  addEventListener(){}
}
const html=fs.readFileSync('admin.html','utf8');
for(const match of html.matchAll(/<(input|select|textarea|div|h2|button)[^>]*id="([^"]+)"/g)){const e=new Element(match[1]);e.id=match[2];}
const priceGrid=new Element();for(const day of [4,7,10,15,20,30]){const e=ids.get('preco'+day);priceGrid.append(e);}
const doc={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),querySelector:s=>s==='.price-grid'?priceGrid:null,querySelectorAll:s=>s==='[data-extra-period]'?priceGrid.children.filter(c=>c.dataset.extraPeriod):s==='.price-grid input'?Array.from(ids.values()).filter(e=>e.id?.startsWith('preco')&&e.tagName==='input'):[]};
const bag={id:'test-id',slug:'bvlgari-micro-amarela',nome:'Bvlgari Serpenti Micro',marca:'Bvlgari',valor_loja:7050,valor_pago:2464,valor_caucao:1000,ativa:true,destaque:false};
const rows={bolsas:bag,bolsa_precos:[{dias:4,valor:390,ativo:true},{dias:7,valor:490,ativo:true}],bolsa_imagens:[{url:'https://example.com/database-photo.jpg'}]};
let allowed=true,payload=null,rpcCalls=0,message='';
const client={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},single(){return Promise.resolve({data:rows[table]});},then(done){return Promise.resolve({data:rows[table]}).then(done);}};return q;},async rpc(name,data){if(name==='is_admin')return {data:allowed};rpcCalls++;payload=data;return {data:bag.id};}};
const context={console:{error(){}},URL,Option:function(label,value){const e=new Element('option');e.textContent=label;e.value=value;return e;},document:doc,bolsas:[bag],supabaseClient:client,renderBolsas(){},renderResumoCadastroBolsa(){},async carregarTudo(){},setMessage(id,text){message=text;},campoTexto:id=>String(ids.get(id)?.value||'').trim(),valorDecimal:id=>{const s=String(ids.get(id)?.value||'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');return s&&Number.isFinite(Number(s))?Number(s):null;},slugifyBolsa:v=>String(v||''),limparFormularioBolsa(){for(const [id,e]of ids)if(id.startsWith('novaBolsa')||id.startsWith('preco'))e.value='';}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('bag-manual-photos.js','utf8'),context);
vm.runInContext(fs.readFileSync('admin-bag-editor.js','utf8'),context);
(async()=>{
  await context.selecionarBolsaEditor(bag.id);
  const manual=context.TBR_MANUAL_PHOTOS[bag.slug];
  assert.equal(ids.get('novaBolsaImagem').value,manual.cover);
  assert.equal(ids.get('novaBolsaGaleria').value,manual.gallery.join('\n'));
  assert.equal(ids.get('novaBolsaSlug').readOnly,true);
  assert.equal(ids.get('preco7').value,'490');
  allowed=false;await context.cadastrarBolsa();assert.equal(rpcCalls,0);assert.match(message,/administradores/);
  allowed=true;ids.get('novaBolsaValorLoja').value='abc';await context.cadastrarBolsa();assert.equal(rpcCalls,0);assert.match(message,/numéricos/);
  ids.get('novaBolsaValorLoja').value='7050';ids.get('novaBolsaImagem').value='javascript:alert(1)';await context.cadastrarBolsa();assert.equal(rpcCalls,0);assert.match(message,/HTTP/);
  ids.get('novaBolsaImagem').value='https://example.com/cover.jpg';ids.get('novaBolsaGaleria').value='https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg';
  await context.cadastrarBolsa();assert.equal(rpcCalls,1);assert.equal(payload.p_id,bag.id);assert.equal(payload.p_bolsa.imagem_capa_url,'https://example.com/cover.jpg');assert.equal(payload.p_imagens.length,2);assert.equal(payload.p_precos[1].valor,490);assert.match(message,/Bolsa salva/);
  context.limparFormularioBolsa();assert.equal(ids.get('novaBolsaSlug').readOnly,false);assert.equal(ids.get('novaBolsaGaleria').value,'');
  console.log('PASS: carregar edição, preservar fotos manuais, impedir não-admin, validar valores/URLs, montar salvamento e limpar.');
})().catch(error=>{console.error(error);process.exitCode=1;});

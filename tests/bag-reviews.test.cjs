// Offline reviews test; no network requests or production writes.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.textContent='';}
  appendChild(node){this.children.push(node);return node;}
  append(...nodes){nodes.forEach(n=>this.children.push(n));}
  setAttribute(k,v){this.attrs[k]=v;}
  after(node){this.nextNode=node;}
}
function run(rows){
  const produto=new Element('div'),head=new Element('head');
  const ld={textContent:JSON.stringify({'@type':'Product',name:'Lady Dior',offers:{price:'890.00'}})};
  const document={readyState:'loading',addEventListener(){},head,
    getElementById:id=>id==='tbr-product-ld'?ld:null,
    querySelector:sel=>sel==='.produto'?produto:null,
    createElement:tag=>new Element(tag)};
  const calls=[];
  const fetch=async url=>{calls.push(url);return {ok:true,json:async()=>rows};};
  const context={document,URL,URLSearchParams,AbortSignal,fetch,window:{},console};
  const source=fs.readFileSync('bag-fields.js','utf8').replace('  function start() { product(); catalog(); homeCards(); }','  window.testReviews = reviews;\n  function start() { product(); catalog(); homeCards(); }');
  vm.runInNewContext(source,context);
  return context.window.testReviews({id:'abc'}).then(()=>({produto,ld:JSON.parse(ld.textContent),calls}));
}
(async()=>{
  const none=await run([]);
  assert.equal(none.produto.nextNode,undefined);
  assert.equal(none.ld.aggregateRating,undefined);
  assert.match(none.calls[0],/avaliacoes\?/);
  assert.match(decodeURIComponent(none.calls[0]),/bolsa_id=eq\.abc/);
  assert.doesNotMatch(decodeURIComponent(none.calls[0]),/cliente_auth_id|pedido_id/);

  const some=await run([
    {nota:5,comentario:'Impecável!',nome_exibicao:'Ana',created_at:'2026-11-01T10:00:00Z'},
    {nota:4,comentario:null,nome_exibicao:null,created_at:'2026-10-20T10:00:00Z'},
    {nota:9,comentario:'inválida',nome_exibicao:'X',created_at:'2026-10-01T10:00:00Z'}
  ]);
  assert.ok(some.produto.nextNode,'seção de avaliações aparece na página');
  assert.equal(some.ld.aggregateRating.ratingValue,'4.5');
  assert.equal(some.ld.aggregateRating.reviewCount,2);
  assert.equal(some.ld.review.length,2);
  assert.equal(some.ld.review[0].author.name,'Ana');
  assert.equal(some.ld.review[1].author.name,'Cliente The Bag Room');
  assert.equal(some.ld.review[0].datePublished,'2026-11-01');
  assert.equal(some.ld.offers.price,'890.00');
  console.log('PASS: avaliações só aparecem quando há aprovadas, nota média e marcação corretas, nota inválida ignorada.');
})().catch(e=>{console.error(e);process.exit(1);});

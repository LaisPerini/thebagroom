// Offline gallery adapter test; no network requests or production writes.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};}
  appendChild(node){node.parent=this;this.children.push(node);}
  querySelectorAll(tag){return this.children.filter(node=>node.tag===tag);}
  remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
  replaceChildren(){this.children=[];}
  addEventListener(name,fn){this.listeners[name]=fn;}
}
const slider=new Element('div'),dots=new Element('div'),count={};const original=new Element('img');slider.appendChild(original);
const document={readyState:'loading',addEventListener(){},getElementById:id=>id==='slider'?slider:id==='dots'?dots:null,querySelector:selector=>selector==='.tbr-gallery-count'?count:null,createElement:tag=>new Element(tag)};
const context={document,URL,images:[],imagens:[],dots:[],indexAtual:3,window:{}};
const source=fs.readFileSync('bag-fields.js','utf8').replace('  function start() { product(); catalog(); }','  window.testGallery = updateGallery;\n  function start() { product(); catalog(); }');
vm.runInNewContext(source,context);
context.window.testGallery([{url:'https://example.com/1.jpg'},{url:'https://example.com/2.jpg'},{url:'https://example.com/3.jpg'}],{nome:'Bolsa'});
assert.equal(slider.children[0],original);assert.equal(slider.children.length,3);assert.equal(dots.children.length,3);assert.equal(context.images.length,3);assert.equal(context.imagens.length,3);assert.equal(context.indexAtual,0);assert.equal(count.textContent,'1 / 3');assert.equal(context.window.tbrGalleryImage,'https://example.com/1.jpg');
context.window.testGallery([{url:'https://example.com/new.jpg'},{url:'javascript:alert(1)'}],{nome:'Bolsa'});
assert.equal(slider.children.length,1);assert.equal(original.src,'https://example.com/new.jpg');assert.equal(count.textContent,'1 / 1');
console.log('PASS: galeria preserva nós/layout, atualiza fotos, zoom/dots e imagem de checkout, rejeita URL inválida.');

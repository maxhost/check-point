// Iteración v002: elección de tipo de venta para gastronomía.
let saleType=null,tableName='',confirmedOrderSignature='';
const typeLabels={table:'Mesa',pickup:'Para retirar',delivery:'Delivery',counter:'Mostrador'};
const isGastronomy=()=>industry==='bakery';
const usesSaleTypes=()=>isGastronomy()&&mode==='attention';
const deferredOrder=()=>usesSaleTypes()&&saleType&&saleType!=='counter';
const orderSignature=()=>JSON.stringify({industry,saleType,tableName,cart});
const isConfirmedOrder=()=>!!confirmedOrderSignature&&confirmedOrderSignature===orderSignature();
const baseRender=render,baseReset=reset,baseCheckout=checkout;
reset=function(){baseReset();saleType=null;tableName='';confirmedOrderSignature=''};
render=function(){
 baseRender();
 if(!usesSaleTypes()||entry!=='sale')return;
 $('#mode-description').textContent='B · Gastronomía: primero eliges Mesa, Para retirar, Delivery o Mostrador. Mesa/retiro/delivery confirman una orden; Mostrador continúa directamente al cobro. Los otros rubros siguen en exploración.';
 if(!saleType){
  $('#business-title').textContent='Nueva orden';
  $('#entry-region').innerHTML=`<section class="queue"><h2>¿Qué tipo de venta vas a iniciar?</h2><p class="muted" style="margin-top:8px">Elige cómo vas a atender esta orden.</p><div class="queue-list">${[
   ['table','Mesa','Arma y confirma la orden para una mesa.'],
   ['pickup','Para retirar','Arma y confirma la orden sin asignar mesa.'],
   ['delivery','Delivery','Arma y confirma la orden para entrega.'],
   ['counter','Mostrador','Selecciona productos, identifica al cliente si corresponde y cobra.']
  ].map(([id,title,description])=>`<button class="queue-item" data-sale-type="${id}"><div><strong>${title}</strong><small>${description}</small></div><span>Elegir</span></button>`).join('')}</div><p class="muted" style="margin-top:14px;font-size:13px">Destinatario, dirección, horarios y seguimiento de entrega quedan por definir. Esta maqueta no los exige todavía.</p></section>`;
  $('#workspace').classList.add('hidden');$('.mobile-tabs').classList.add('hidden');$('#mobile-summary').classList.add('hidden');$('#pause').classList.add('hidden');
  $$('[data-sale-type]').forEach(button=>button.onclick=()=>{saleType=button.dataset.saleType;confirmedOrderSignature='';render()});
  return;
 }
 $('#business-title').textContent=`${saleType==='counter'?'Venta':'Orden'} · ${typeLabels[saleType]}`;
 $('#entry-region').innerHTML=`<section class="queue"><div class="apphead" style="margin-bottom:0"><div><strong>${typeLabels[saleType]}</strong><p class="muted" style="font-size:13px">${saleType==='counter'?'Cobro inmediato al terminar la venta.':'Confirma la orden y déjala lista para continuar después.'}</p></div><button id="change-sale-type">Cambiar tipo</button></div>${saleType!=='counter'?`<label style="max-width:320px;margin-top:16px">${saleType==='table'?'Mesa':'Identificador de la orden'}<input id="table-name" placeholder="${saleType==='table'?'Ej. Mesa 4':saleType==='pickup'?'Ej. Paula / Pedido 24':'Ej. Delivery 24 / Carlos'}" value="${esc(tableName)}" maxlength="60"></label>`:''}${isConfirmedOrder()?'<p class="note success" role="status">Orden confirmada en esta simulación. Sigue pendiente de cobro. No se acreditaron beneficios ni se registró un pago.</p>':''}</section>`;
 $('#change-sale-type').onclick=()=>{modal(`<h2 id="dialog-title">Cambiar tipo de venta</h2><p>Se conservarán productos y cliente. Se retirará la mesa y la orden volverá a borrador. Podrás elegir el nuevo tipo.</p><div class="actions"><button onclick="closeDialog()">Cancelar</button><button class="primary" id="confirm-type-change">Elegir otro tipo</button></div>`);$('#confirm-type-change').onclick=()=>{saleType=null;tableName='';confirmedOrderSignature='';closeDialog();render()}};
 $('#table-name')?.addEventListener('input',e=>{tableName=e.target.value;confirmedOrderSignature='';$('#sale-state').textContent='Borrador';$('#checkout').textContent='Confirmar orden';if(mobileView==='ticket')$('#review').textContent='Confirmar orden';$('#entry-region .note')?.remove()});
 if(deferredOrder()){
  const confirmed=isConfirmedOrder();$('#sale-state').textContent=confirmed?'Confirmada · Sin cobrar':'Borrador';
  $('#checkout').textContent=confirmed?'Continuar al cobro':'Confirmar orden';
  $('#checkout').disabled=!cart.length;
  if(mobileView==='ticket'){$('#review').textContent=confirmed?'Continuar al cobro':'Confirmar orden';$('#review').disabled=!cart.length}
 }
};
checkout=function(){
 if(!deferredOrder())return baseCheckout();
 if(!cart.length)return;
 if(isConfirmedOrder())return baseCheckout();
 if(saleType!=='counter'&&!tableName.trim()){
  toast(saleType==='table'?'Indica la mesa antes de confirmar la orden.':'Indica un identificador para distinguir esta orden.');$('#table-name')?.focus();return;
 }
 modal(`<h2 id="dialog-title">Confirmar orden</h2><p>${typeLabels[saleType]}${saleType!=='counter'?` · ${esc(tableName.trim())}`:''} · ${cart.length} conceptos</p><div class="receipt"><div class="totalrow"><span>Total actual</span><strong>${money(total())}</strong></div></div><p>La orden quedará confirmada y pendiente de cobro. Podrás continuar después.</p><p class="muted">Esta acción no cobra ni acredita beneficios. Los estados de preparación, entrega y sus efectos de inventario quedan por definir.</p><div class="actions"><button onclick="closeDialog()">Seguir editando</button><button class="primary" id="confirm-order">Confirmar orden simulada</button></div>`);
 $('#confirm-order').onclick=()=>{confirmedOrderSignature=orderSignature();closeDialog();render();toast('Orden confirmada · Pendiente de cobro')};
};
// La pausa conserva también tipo, mesa y confirmación, siempre en memoria.
$('#pause').onclick=()=>{
 if(saved){toast('Ya hay una venta pausada. Retómala antes de pausar otra.');return}
 saved={industry,mode,cart:structuredClone(cart),client,coupon,origin,saleType,tableName,confirmedOrderSignature};reset();render();toast('Venta pausada en memoria de esta pestaña');
};
$('#resume').onclick=()=>resetWithConfirm(()=>{
 const previous=saved;reset();industry=previous.industry;mode=previous.mode||mode;cart=previous.cart;client=previous.client;coupon=previous.coupon;origin=previous.origin;
 saleType=previous.saleType??null;tableName=previous.tableName??'';confirmedOrderSignature=previous.confirmedOrderSignature??'';saved=null;$('#industry').value=industry;render();
});
// Tarea precargada es un atajo del laboratorio; abre Mostrador si no se eligió tipo.
const previousTask=$('#task').onclick;
$('#task').onclick=()=>{
 if(!usesSaleTypes())return previousTask();
 resetWithConfirm(()=>{const selected=saleType;reset();saleType=selected||'counter';cart=[{id:'corn',q:5},{id:'croissant',q:2},{id:'french',q:1}];render();toast('Tarea de panadería cargada');});
};
$('#modes [data-mode="attention"]').textContent='B · Tipo de venta';
descriptions.direct='A · Exploración inicial: catálogo primero. Conservada para comparar con B; ya no es la recomendación vigente para gastronomía.';
mode='attention';render();

$('#checkout').onclick=()=>checkout();

// v004: ciclo de órdenes + configuración de peso. Datos efímeros, sin backend.
let posView='list',activeOrderId=null,orderFilter='open',orderSearch='',sequence=104;
let allowedWeightUnits=['kg','lb','g'],weightPricing={enabled:true,unit:'kg',price:3.60};
let passCoupon='discount';
const unitKg={kg:1,lb:0.45359237,g:0.001};
const unitName={kg:'kilogramo',lb:'libra',g:'gramo'};
const priceText=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:6}).format(n);
const orders=[
 {id:'101',industry:'bakery',type:'table',label:'Mesa 4',lines:[{id:'coffee',q:2,unitPrice:200},{id:'croissant',q:2,unitPrice:120}],status:'open'},
 {id:'102',industry:'bakery',type:'pickup',label:'Paula · Pedido 24',lines:[{id:'corn',q:5,unitPrice:40}],status:'open'},
 {id:'103',industry:'bakery',type:'delivery',label:'Delivery 25 · Carlos',lines:[{id:'sourdough',q:2,unitPrice:450}],status:'open'}
];
const currentRecord=()=>orders.find(o=>o.id===activeOrderId);
const recordTotal=o=>o.net??o.lines.reduce((sum,l)=>sum+Math.round(l.unitPrice*l.q),0);
const recordSignature=()=>JSON.stringify({saleType,tableName,cart});
const fullBaseReset=reset,fullBaseRender=render,fullBaseCheckout=checkout;
reset=function(){fullBaseReset();activeOrderId=null};
$('.head-actions').insertAdjacentHTML('afterbegin','<button id="orders-home">Órdenes</button>');
$('.config').insertAdjacentHTML('beforeend','<button id="business-settings">Unidades del negocio</button><button id="catalog-settings">Producto por peso</button><label>Cupón del pase simulado<select id="pass-coupon"><option value="discount">10 % de descuento</option><option value="free">Café gratis</option><option value="two">2×1 en café</option></select></label>');
$('#pass-coupon').onchange=e=>{passCoupon=e.target.value;render()};
function couponDiscount(){
 if(!client||!coupon)return 0;
 if(passCoupon==='discount')return subtotal()>=500?Math.round(subtotal()*.1):0;
 const line=cart.find(l=>l.id==='coffee');if(!line||line.q<(passCoupon==='two'?2:1))return 0;
 return Math.min(subtotal(),Math.round(line.unitPrice??item('coffee')[2]));
}
function navigateToOrders(){
 if(cart.length&&(!currentRecord()||currentRecord().signature!==recordSignature())){
  modal('<h2 id="dialog-title">Hay cambios sin confirmar</h2><p>La orden abierta conserva su última versión confirmada. Puedes seguir editando o volver al listado sin estos cambios.</p><div class="actions"><button onclick="closeDialog()">Seguir editando</button><button class="danger" id="leave-draft">Volver sin los cambios</button></div>');
  $('#leave-draft').onclick=()=>{closeDialog();reset();posView='list';render()};return;
 }
 reset();posView='list';render();
}
function startOrder(){navigateWithDraft(()=>{reset();posView='types';entry='sale';render()})}
function navigateWithDraft(action){if(cart.length&&(!currentRecord()||currentRecord().signature!==recordSignature()))return resetWithConfirm(action);action()}
$('#orders-home').onclick=navigateToOrders;
$('#entry-sale').onclick=startOrder;
function openStoredOrder(id){const record=orders.find(o=>o.id===id);if(!record)return;reset();industry=record.industry;mode='attention';entry='sale';saleType=record.type;tableName=record.label;cart=structuredClone(record.lines);activeOrderId=id;posView='order';confirmedOrderSignature=orderSignature();record.signature=recordSignature();render()}
function saveCurrentOrder(){
 let record=currentRecord();if(!record){record={id:String(sequence++),industry,status:'open'};orders.push(record);activeOrderId=record.id}
 Object.assign(record,{type:saleType,label:tableName.trim(),lines:structuredClone(cart),signature:recordSignature()});
}
render=function(){
 fullBaseRender();$('#entry-benefits').classList.add('hidden');$('#orders-home').classList.toggle('hidden',posView==='list');$('#entry-sale').textContent='Nueva orden';
 if(posView==='list'&&entry==='sale'){
  $('#business-title').textContent='POS';$('#pause').classList.add('hidden');['#workspace','.mobile-tabs','#mobile-summary'].forEach(s=>$(s).classList.add('hidden'));
  const rows=orders.filter(o=>o.industry===industry&&(orderFilter==='open'?o.status==='open':o.status!=='open')&&`${o.label} ${typeLabels[o.type]}`.toLowerCase().includes(orderSearch.toLowerCase()));
  $('#entry-region').innerHTML=`<section class="queue"><div class="apphead"><div><h2>Órdenes ${orderFilter==='open'?'abiertas':'cerradas y anuladas'}</h2><small>Principal · Datos ficticios</small></div></div><div class="entries"><button id="filter-open" class="${orderFilter==='open'?'primary':''}">Abiertas</button><button id="filter-closed" class="${orderFilter==='closed'?'primary':''}">Cerradas de hoy</button></div><input id="order-search" type="search" placeholder="Buscar mesa, nombre o identificador" aria-label="Buscar órdenes" value="${esc(orderSearch)}"><div class="agenda-list" style="margin-top:16px">${rows.length?rows.map(o=>`<button class="queue-item" data-open-order="${o.id}" style="width:100%;text-align:left"><div><strong>${esc(o.label||'Mostrador')} · #${o.id}</strong><small>${typeLabels[o.type]||'Venta'} · ${o.lines.length} conceptos · ${o.status==='open'?'Pendiente de cobro':o.status==='closed'?'Cerrada':'Anulada'}</small></div><strong>${money(recordTotal(o))}</strong></button>`).join(''):'<p class="empty">No hay órdenes en esta vista. Puedes iniciar una nueva orden.</p>'}</div><p class="muted" style="margin-top:16px;font-size:13px">La confirmación guarda una orden abierta; el cobro la cierra. Esta lista se conserva solo mientras esta pestaña permanezca abierta.</p></section>`;
  $('#filter-open').onclick=()=>{orderFilter='open';render()};$('#filter-closed').onclick=()=>{orderFilter='closed';render()};$('#order-search').oninput=e=>{const selection=e.target.selectionStart;orderSearch=e.target.value;render();$('#order-search').focus();$('#order-search').setSelectionRange(selection,selection)};
  $$('[data-open-order]').forEach(b=>b.onclick=()=>openStoredOrder(b.dataset.openOrder));return;
 }
 if(saleType)posView='order';
 const record=currentRecord();
 if(record&&record.status!=='open'){
  $('#business-title').textContent=`${record.label||'Mostrador'} · ${record.status==='closed'?'Cerrada':'Anulada'}`;
  ['#workspace','.mobile-tabs','#mobile-summary','#pause'].forEach(s=>$(s).classList.add('hidden'));
  $('#entry-region').innerHTML=`<section class="customer-first"><h2>Orden #${record.id}</h2><p>${record.lines.map(l=>`${esc(item(l.id)[1])} × ${l.q}`).join('<br>')}</p><p style="margin-top:16px"><strong>Total registrado: ${money(recordTotal(record))}</strong></p><p class="muted">Registro de simulación · Esta orden ya no se puede editar ni cobrar.</p></section>`;return;
 }
 if(usesSaleTypes()&&saleType==='counter')$('#sale-state').textContent='Borrador';
 if(usesSaleTypes()&&saleType){
  if(record){$('#business-title').textContent=`${tableName} · #${record.id}`;$('#entry-region').insertAdjacentHTML('beforeend','<div class="head-actions" style="margin-top:12px"><button id="return-list">Volver a órdenes</button><button class="danger" id="void-order">Anular orden</button></div>');$('#return-list').onclick=navigateToOrders;
   $('#void-order').onclick=()=>{modal('<h2 id="dialog-title">¿Anular la orden abierta?</h2><p>La orden saldrá de abiertas sin registrar pago. Esta acción de prueba no cancela ninguna cita.</p><div class="actions"><button onclick="closeDialog()">Conservar orden</button><button class="danger" id="confirm-void">Anular orden simulada</button></div>');$('#confirm-void').onclick=()=>{record.status='voided';closeDialog();reset();posView='list';render()}};
  }
  if(deferredOrder()&&isConfirmedOrder()){$('#checkout').textContent='Cobrar y cerrar orden';if(mobileView==='ticket')$('#review').textContent='Cobrar y cerrar orden'}
 }
 // Los importes por peso se presentan en la unidad que el negocio eligió; cálculo interno normalizado.
 $$('.line').forEach((row,index)=>{
  const line=cart[index];if(line?.id!=='french')return;
  const weighted=!!line.priceUnit,unit=line.priceUnit,price=line.priceAmount;
  row.querySelector('small').textContent=weighted?`${priceText(price)} / ${unitName[unit]}`:`${money(line.unitPrice??item(line.id)[2])} / ud.`;
  const controls=row.querySelector('.qty');
  controls.innerHTML=weighted?`<button data-weight="french">${new Intl.NumberFormat('es',{maximumFractionDigits:6}).format(line.q/unitKg[unit])} ${unit} · Editar</button><button class="quiet remove" data-remove="french">Quitar</button>`:`<button data-french-delta="-1" aria-label="Quitar una unidad de Pan francés">−</button><input id="french-units" type="number" min="1" step="1" value="${line.q}" aria-label="Cantidad de Pan francés"><button data-french-delta="1" aria-label="Añadir una unidad de Pan francés">+</button><button class="quiet remove" data-remove="french">Quitar</button>`;
  controls.querySelector('[data-weight]')?.addEventListener('click',()=>weight('french'));
  controls.querySelector('[data-remove]').onclick=()=>{cart=cart.filter(l=>l!==line);render()};
  controls.querySelectorAll('[data-french-delta]').forEach(b=>b.onclick=()=>{line.q+=Number(b.dataset.frenchDelta);if(line.q<=0)cart=cart.filter(l=>l!==line);render()});
  controls.querySelector('#french-units')?.addEventListener('change',e=>{const q=Number(e.target.value);if(!Number.isInteger(q)||q<1){toast('Ingresa una cantidad entera mayor que cero');render();return}line.q=q;render()});
 });
 const label=$('#client .benefit label');if(label){label.lastChild.textContent=passCoupon==='free'?'Cupón del pase · Café gratis':passCoupon==='two'?'Cupón del pase · 2×1 en café':'Cupón del pase · 10 %';$('#client .benefit p').textContent=passCoupon==='discount'?(subtotal()>=500?'Disponible para esta venta.':'Se aplica desde $5 de compra.'):passCoupon==='free'?'Requiere un café en la venta. El cupón ya fue obtenido en la PWA.':'Requiere dos cafés. El cupón ya fue obtenido en la PWA.'}
 if(cart.length&&total()===0&&(!deferredOrder()||isConfirmedOrder())){$('#checkout').textContent='Cerrar venta sin cobro';if(mobileView==='ticket')$('#review').textContent='Cerrar venta sin cobro'}
 if(discount()){$('#totals .success span').textContent=passCoupon==='free'?'Café gratis':passCoupon==='two'?'2×1 en café':'Cupón · 10 %'}
};
checkout=function(){
 const payingRecord=currentRecord();
 fullBaseCheckout();
 if($('#modal').open&&$('#confirm-order')){
  $('#confirm-order').onclick=()=>{confirmedOrderSignature=orderSignature();saveCurrentOrder();closeDialog();reset();posView='list';orderFilter='open';orderSearch='';render();toast('Orden confirmada · Disponible en abiertas')};return;
 }
 const confirm=$('#confirm-payment');if(!confirm||!$('#modal').open)return;
 if(total()===0){$('.payment-options').classList.add('hidden');$('#cash-label').classList.add('hidden');$('#change').classList.add('hidden');$('#dialog-title').textContent='Cerrar venta sin cobro';confirm.textContent='Confirmar venta de $0';}
 const previousConfirm=confirm.onclick;
 confirm.onclick=()=>{previousConfirm();if(!done)return;let record=payingRecord;if(!record){record={id:String(sequence++),industry,type:saleType||'counter',label:tableName||'Mostrador',lines:structuredClone(cart)};orders.push(record)}record.status='closed';record.net=total();$('#next-sale').textContent='Volver a órdenes';$('#next-sale').onclick=()=>{reset();closeDialog();posView='list';orderFilter='open';orderSearch='';render()}};
};
const fullAdd=add;
add=function(id){fullAdd(id);const line=cart.find(l=>l.id===id);if(line&&line.unitPrice===undefined){line.unitPrice=item(id)[2];render()}};
const fullRenderProducts=renderProducts;
renderProducts=function(){fullRenderProducts();const button=$('[data-product="french"]');if(button){button.querySelector('small').textContent=weightPricing.enabled?'Ingresa el peso de la balanza':'Panes';button.querySelector('.price>span').textContent=`${priceText(weightPricing.price)} / ${weightPricing.enabled?weightPricing.unit:'ud.'}`;const line=cart.find(l=>l.id==='french');if(line?.priceUnit&&button.querySelector('.count'))button.querySelector('.count').textContent=`${new Intl.NumberFormat('es',{maximumFractionDigits:3}).format(line.q/unitKg[line.priceUnit])} ${line.priceUnit}`}};
weight=function(id){
 const product=item(id),existing=cart.find(l=>l.id===id),pricingUnit=existing?.priceUnit||weightPricing.unit,price=existing?.priceAmount??weightPricing.price;
 modal(`<h2 id="dialog-title">${esc(product[1])}</h2><p>${priceText(price)} por ${unitName[pricingUnit]} · Ingresa el peso neto indicado por la balanza.</p><div class="weightrow"><label>Peso neto<input id="weight" inputmode="decimal" placeholder="Ej. 0,750" value="${existing?String(existing.q/unitKg[pricingUnit]).replace('.',','):''}"></label><label>Unidad<select id="weight-unit">${[...new Set([pricingUnit,...allowedWeightUnits])].map(u=>`<option value="${u}" ${u===pricingUnit?'selected':''}>${u}</option>`).join('')}</select></label></div><p id="weight-preview"></p><p class="error" id="weight-error" role="alert"></p><div class="actions"><button onclick="closeDialog()">Cancelar</button><button class="primary" id="weight-save">${existing?'Actualizar peso':'Añadir a la venta'}</button></div>`);
 const mass=()=>Number($('#weight').value.trim().replace(',','.'))*unitKg[$('#weight-unit').value];
 const preview=()=>{const kg=mass();$('#weight-preview').textContent=Number.isFinite(kg)&&kg>0?`${new Intl.NumberFormat('es',{maximumFractionDigits:6}).format(kg/unitKg[pricingUnit])} ${pricingUnit} × ${priceText(price)}/${pricingUnit} = ${money(Math.round(kg/unitKg[pricingUnit]*price*100))}`:'Ingresa un peso mayor que cero.'};
 $('#weight').oninput=preview;let previousUnit=pricingUnit;$('#weight-unit').onchange=()=>{const number=Number($('#weight').value.replace(',','.'));if(Number.isFinite(number)&&number>0)$('#weight').value=String(Number((number*unitKg[previousUnit]/unitKg[$('#weight-unit').value]).toFixed(9)));previousUnit=$('#weight-unit').value;preview()};preview();
 $('#weight-save').onclick=()=>{const kg=mass();if(!Number.isFinite(kg)||kg<=0){$('#weight-error').textContent='Ingresa un peso mayor que cero.';return}const data={id,q:kg,unitPrice:price*100/unitKg[pricingUnit],priceUnit:pricingUnit,priceAmount:price};if(existing)Object.assign(existing,data);else cart.push(data);closeDialog();render()};
};
$('#business-settings').onclick=()=>{
 modal(`<h2 id="dialog-title">Unidades del negocio · Simulación</h2><p>Representa la configuración futura de backoffice/business. Elige las unidades de peso que utiliza el comercio.</p>${['kg','lb','g'].map(u=>`<label style="display:flex;align-items:center;gap:10px"><input style="width:20px;min-height:20px" type="checkbox" data-business-unit="${u}" ${allowedWeightUnits.includes(u)?'checked':''}>${unitName[u]} (${u})</label>`).join('')}<p class="error" id="units-error"></p><div class="actions"><button onclick="closeDialog()">Cancelar</button><button class="primary" id="save-business-units">Guardar unidades simuladas</button></div>`);
 $('#save-business-units').onclick=()=>{const selected=$$('[data-business-unit]:checked').map(i=>i.dataset.businessUnit);if(!selected.length){$('#units-error').textContent='Elige al menos una unidad.';return}if(!selected.includes(weightPricing.unit)){$('#units-error').textContent='Conserva la unidad usada por el producto o cambia primero su configuración.';return}allowedWeightUnits=selected;closeDialog();render()};
};
$('#catalog-settings').onclick=()=>{
 modal(`<h2 id="dialog-title">Pan francés · Catálogo simulado</h2><label style="display:flex;align-items:center;gap:10px"><input id="sold-by-weight" style="width:20px;min-height:20px" type="checkbox" ${weightPricing.enabled?'checked':''}>Este producto se vende por peso</label><label>Precio de venta (USD)<input id="catalog-price" inputmode="decimal" value="${weightPricing.price}"></label><label id="price-unit-label">Precio por<select id="catalog-price-unit">${allowedWeightUnits.map(u=>`<option value="${u}" ${u===weightPricing.unit?'selected':''}>${unitName[u]} (${u})</option>`).join('')}</select></label><p class="muted">No necesitas convertir el precio. Si indicas $4 por libra, el POS calcula con esa referencia. Los importes guardados en órdenes anteriores se conservan.</p><p id="catalog-error" class="error"></p><div class="actions"><button onclick="closeDialog()">Cancelar</button><button class="primary" id="save-catalog-weight">Guardar producto simulado</button></div>`);
 const toggle=()=>$('#price-unit-label').classList.toggle('hidden',!$('#sold-by-weight').checked);$('#sold-by-weight').onchange=toggle;toggle();
 $('#save-catalog-weight').onclick=()=>{const price=Number($('#catalog-price').value.replace(',','.'));if(!Number.isFinite(price)||price<=0){$('#catalog-error').textContent='Ingresa un precio mayor que cero.';return}weightPricing={enabled:$('#sold-by-weight').checked,unit:$('#catalog-price-unit').value,price};const p=data.bakery.items.find(p=>p[0]==='french');p[2]=weightPricing.enabled?price*100/unitKg[weightPricing.unit]:price*100;p[3]=weightPricing.enabled?'kg':'ud.';closeDialog();render()};
};
const fullTask=$('#task').onclick;$('#task').onclick=()=>{
 if(industry!=='bakery'){posView='types';return fullTask()}
 resetWithConfirm(()=>{reset();posView='types';saleType='counter';cart=[{id:'corn',q:5,unitPrice:40},{id:'croissant',q:2,unitPrice:120},{id:'french',q:1,unitPrice:item('french')[2],...(weightPricing.enabled?{priceUnit:weightPricing.unit,priceAmount:weightPricing.price}:{})}];render()});
};
$('#checkout').onclick=()=>checkout();render();

const fullResume=$('#resume').onclick;$('#resume').onclick=()=>{posView='order';fullResume()};

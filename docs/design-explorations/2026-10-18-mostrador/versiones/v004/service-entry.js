// v003: entradas por agenda y venta rápida, sin descarte de citas.
let serviceChoice=null,selectedAppointmentId=null;
const completedAppointments=new Set();
const agendaIndustries=['spa','garage','dental','vet'];
const hasAgenda=()=>agendaIndustries.includes(industry);
const serviceMode=()=>mode==='attention'&&(hasAgenda()||industry==='gym');
const agendaRows=()=>[
 {id:`${industry}-1030`,time:'10:30',name:'Ana López',identified:true,service:d().service,description:d().items.find(p=>p[0]===d().service)[1]},
 {id:`${industry}-1130`,time:'11:30',name:industry==='garage'?'Vehículo XYZ-456':industry==='vet'?'Luna · Responsable pendiente':'Reserva sin cliente identificado',identified:false,service:d().service,description:d().items.find(p=>p[0]===d().service)[1]},
 {id:`${industry}-1230`,time:'12:30',name:'Ana López',identified:true,service:d().service,description:d().items.find(p=>p[0]===d().service)[1]}
];
data.vet={name:'Veterinaria · Local Principal',question:'Servicios y productos',program:'Cuidamos a tu mascota',reward:'1 punto por cada $1 neto',type:'points',categories:['Todo','Servicios','Productos'],items:[['vetconsult','Consulta veterinaria',3000,'consulta','Servicios'],['vaccine','Vacunación',2500,'sesión','Servicios'],['food','Alimento para mascotas',1500,'ud.','Productos']],appointment:'Ana · Luna · Consulta veterinaria',service:'vetconsult'};
data.spa.items.push(['soap','Jabón artesanal',650,'ud.','Productos']);
$('#industry').insertAdjacentHTML('beforeend','<option value="vet">Veterinaria</option>');
const serviceBaseReset=reset,serviceBaseRender=render,serviceBaseCheckout=checkout;
reset=function(){serviceBaseReset();serviceChoice=null;selectedAppointmentId=null};
function hideServiceWorkspace(){['#workspace','.mobile-tabs','#mobile-summary','#pause'].forEach(s=>$(s).classList.add('hidden'))}
function chooseService(choice){reset();serviceChoice=choice;render()}
function openAppointment(id){const row=agendaRows().find(a=>a.id===id);if(!row||completedAppointments.has(id))return;reset();serviceChoice='appointment';selectedAppointmentId=id;client=row.identified;cart=[{id:row.service,q:1}];origin=`Cita de ${row.time}`;render()}
render=function(){
 serviceBaseRender();
 $('#totals').classList.toggle('has-discount',discount()>0);
 if(mobileView==='ticket')$('#summary-count').textContent='Total';
 if(!serviceMode()||entry!=='sale')return;
 const rows=agendaRows();
 $('#mode-description').textContent=industry==='gym'?'B · Gimnasio: recorrido propio pendiente. No se presupone agenda ni cobro mensual.':'B · Rubros con agenda: Cita agendada abre la agenda del día; Venta rápida abre directamente el catálogo. La cancelación de citas se gestionará desde Agenda.';
 if(industry==='gym'&&!serviceChoice){
  $('#business-title').textContent='Gimnasio · Flujo por definir';hideServiceWorkspace();
  $('#entry-region').innerHTML='<section class="customer-first"><h2>El gimnasio necesita su propio recorrido</h2><p class="muted">Todavía no decidimos sus entradas. No asumimos que la persona viene a pagar una mensualidad ni que necesita una cita.</p><div class="head-actions"><button id="gym-preview">Explorar catálogo provisional</button></div><p class="muted" style="margin-top:12px;font-size:13px">Esta vista es solo una referencia para seguir conversando; no es un flujo aprobado.</p></section>';
  $('#gym-preview').onclick=()=>chooseService('preview');return;
 }
 if(!serviceChoice){
  $('#business-title').textContent='Nueva operación';hideServiceWorkspace();
  $('#entry-region').innerHTML='<section class="queue"><h2>¿Qué vas a hacer?</h2><div class="queue-list"><button class="queue-item" id="scheduled-entry"><div><strong>Cita agendada</strong><small>Abre la agenda del día y elige una cita.</small></div><span>Elegir</span></button><button class="queue-item" id="quick-entry"><div><strong>Venta rápida</strong><small>Vende productos o servicios sin una cita.</small></div><span>Elegir</span></button></div></section>';
  $('#scheduled-entry').onclick=()=>chooseService('agenda');$('#quick-entry').onclick=()=>chooseService('quick');return;
 }
 if(serviceChoice==='agenda'){
  $('#business-title').textContent='Agenda del día';hideServiceWorkspace();
  $('#entry-region').innerHTML=`<section class="queue"><div class="apphead"><div><h2>Hoy · 18 de octubre de 2026</h2><small>Agenda simulada · ${d().name}</small></div><button id="back-service-types">Volver</button></div><div class="agenda-list">${rows.map(row=>`<button class="queue-item appointment-row" data-appointment="${row.id}" ${completedAppointments.has(row.id)?'disabled':''}><div><strong>${row.time} · ${esc(row.name)}</strong><small>${esc(row.description)}</small></div><span class="tag">${completedAppointments.has(row.id)?'Realizada':'Abrir cita'}</span></button>`).join('')}</div><p class="muted" style="margin-top:16px;font-size:13px">Aquí eliges qué cita atender. Cancelaciones y otras gestiones quedarán en Agenda.</p></section>`;
  $('#back-service-types').onclick=()=>chooseService(null);$$('[data-appointment]').forEach(b=>b.onclick=()=>openAppointment(b.dataset.appointment));return;
 }
 const appointment=rows.find(row=>row.id===selectedAppointmentId);
 $('#business-title').textContent=appointment?`Orden de cita · ${appointment.time}`:industry==='gym'?'Venta provisional · Gimnasio':'Venta rápida';
 $('#entry-region').innerHTML=`<section class="queue"><div class="apphead" style="margin-bottom:0"><div><strong>${appointment?esc(appointment.description):'Venta desde el catálogo'}</strong><p class="muted" style="font-size:13px">${appointment?`${client?'Ana L\u00f3pez · Cliente identificado.':`${esc(appointment.name)} · Puedes identificar al cliente antes de cobrar.`}`:'Puedes vender productos y servicios sin una cita agendada.'}</p></div><button id="back-service-types">${appointment?'Agenda del día':'Cambiar operación'}</button></div>${appointment?'<p class="note">Puedes añadir productos o servicios. Al confirmar el cobro, la cita se marcará como realizada. No se descartan citas desde aquí.</p>':''}</section>`;
 $('#back-service-types').onclick=()=>{
  if(!cart.length)return chooseService(appointment?'agenda':null);
  // Conservar la orden abierta al mirar agenda; no ofrecer su descarte como gestión de cita.
  modal('<h2 id="dialog-title">Hay una orden en curso</h2><p>Pausa la orden para consultar otra operación. La cita permanece agendada.</p><div class="actions"><button onclick="closeDialog()">Seguir con la orden</button><button class="primary" id="pause-and-back">Pausar orden y volver</button></div>');
  $('#pause-and-back').onclick=()=>{closeDialog();$('#pause').onclick();serviceChoice=appointment?'agenda':null;render()};
 };
 $('#sale-state').textContent=appointment?'Cita · Pendiente de cobro':'Borrador';
 if(appointment){$('#checkout').textContent='Cobrar y finalizar cita';if(mobileView==='ticket')$('#review').textContent='Cobrar y finalizar cita'}
};
checkout=function(){
 serviceBaseCheckout();
 if(!serviceMode()||serviceChoice!=='appointment'||!$('#modal').open||!$('#confirm-payment'))return;
 const appointmentId=selectedAppointmentId;
 $('#dialog-title').textContent='Cobrar y finalizar cita';
 $('#confirm-payment').textContent='Confirmar cobro y finalizar cita';
 const previousConfirm=$('#confirm-payment').onclick;
 $('#confirm-payment').onclick=()=>{
  previousConfirm();
  if(done&&appointmentId){completedAppointments.add(appointmentId);$('#dialog-content .receipt').insertAdjacentHTML('beforeend','<p class="success">Cita marcada como realizada en esta simulación.</p>')}
 };
};
const servicePause=$('#pause').onclick;
$('#pause').onclick=()=>{const context={serviceChoice,selectedAppointmentId};const wasSaved=!!saved;servicePause();if(!wasSaved&&saved)Object.assign(saved,context)};
$('#resume').onclick=()=>resetWithConfirm(()=>{
 const previous=saved;reset();industry=previous.industry;mode=previous.mode||mode;cart=previous.cart;client=previous.client;coupon=previous.coupon;origin=previous.origin;
 saleType=previous.saleType??null;tableName=previous.tableName??'';confirmedOrderSignature=previous.confirmedOrderSignature??'';serviceChoice=previous.serviceChoice??null;selectedAppointmentId=previous.selectedAppointmentId??null;saved=null;$('#industry').value=industry;render();
});
const serviceTask=$('#task').onclick;
$('#task').onclick=()=>{if(!serviceMode())return serviceTask();resetWithConfirm(()=>{reset();serviceChoice='quick';cart=[{id:d().service,q:1}];render();toast('Venta rápida de prueba cargada; no procede de una cita')})};
$('#checkout').onclick=()=>checkout();render();

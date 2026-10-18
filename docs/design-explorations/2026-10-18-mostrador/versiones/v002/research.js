document.querySelector('#report').innerHTML=`<p class="note"><strong>Nota v002:</strong> esta investigaci\u00f3n corresponde a v001. La direcci\u00f3n actual para gastronom\u00eda es elegir primero el tipo de venta. Consulta el <a href="../../decisiones.html">registro vigente</a>. Las recomendaciones iniciales se conservan como antecedente.</p>
<h1>De Mostrador a un espacio de venta y atención</h1>
<p>Investigación exploratoria · 18 de octubre de 2026. Basada en documentación oficial, heurísticas y lectura del producto actual. No incluye entrevistas ni mediciones con operadores. Las propuestas son hipótesis, no mejoras demostradas.</p>
<h2>La recomendación</h2>
<p><strong>Un núcleo compartido de venta, cliente y beneficios, con entradas distintas según la tarea.</strong> Panadería entra al catálogo; servicios con cita entran a una atención; fidelización tiene un acceso directo sin cobro. El comercio configura sus capacidades, sin elegir su rubro en cada operación.</p>
<p>En teléfono, Catálogo y Venta son dos vistas del mismo borrador. El cliente se puede identificar antes o después de agregar conceptos. Cobrar tiene una revisión final con importe, beneficio y medio de pago. En escritorio, catálogo y venta conviven en columnas.</p>
<p>El usuario confirmó dos prioridades: teléfono para la panadería y acceso directo a fidelización sin registrar cobro. La apariencia de esta maqueta es provisional: estamos comparando tareas y navegación, no aprobando un nuevo sistema visual.</p>
<h2>Qué hay hoy y qué cambia</h2>
<p>La consola actual de Mostrador comienza con Escanear: idle → scanning → resolved → done. La portada pide un QR para acreditar. Su catálogo ya aporta búsqueda, categorías y carrito; el POS reutiliza parte de ese trabajo y añade orden, cliente y cobro. La entrada actual hace depender la operación de la identificación, que es el desajuste para una venta espontánea.</p>
<p>La evolución propuesta permite crear una venta sin cliente y asociarlo después. QR es un mecanismo de identificación; no es el inicio obligatorio ni define el tipo de operación. Hay que preservar aislamiento por comercio/local y las reglas reales de cupones/programas.</p>
<h2>Lo que enseñan las referencias</h2>
<div class="tablewrap"><table><thead><tr><th>Referencia comprobada</th><th>Patrón observado</th><th>Inferencia para CheckPass</th></tr></thead><tbody>
<tr><td><a href="https://squareup.com/help/us/en/article/6694-sell-items-by-weight" target="_blank" rel="noreferrer">Square · Venta por peso</a></td><td>Peso manual, balanza conectada y etiquetas son mecanismos distintos. La captura manual muestra peso e importe antes de añadir.</td><td>Unidad y precisión son atributos del artículo. Empezar con peso neto manual; balanza y tara automáticas son otro alcance.</td></tr>
<tr><td><a href="https://help.shopify.com/en/manual/sell-in-person/shopify-pos" target="_blank" rel="noreferrer">Shopify · POS</a></td><td>Carrito con productos, cambios y descuentos antes de aceptar el pago.</td><td>La venta debe existir como intención de trabajo antes de exigir fidelización.</td></tr>
<tr><td><a href="https://www.fresha.com/help-center/academy/run-your-business/record-a-sale/lessons/100257" target="_blank" rel="noreferrer">Fresha · Crear una venta</a></td><td>Venta desde cero o desde una cita. La cita carga cliente y servicios; se pueden añadir otros conceptos antes de pagar.</td><td>Agenda como origen de una venta, con un cobro común. No crear un checkout distinto para cada rubro.</td></tr>
<tr><td><a href="https://help.cliniko.com/en/articles/1023936-set-up-billable-items" target="_blank" rel="noreferrer">Cliniko · Conceptos facturables</a></td><td>Define conceptos cobrables para añadir a facturas; admite servicios y otros conceptos.</td><td>Un consultorio puede tener conceptos de cobro sin necesitar un catálogo comercial visible al paciente.</td></tr>
<tr><td><a href="https://support.glofox.com/hc/en-us/articles/46428636957716" target="_blank" rel="noreferrer">Glofox · Pagos de membresías</a></td><td>Distingue pago único, recurrente, fecha de fin, renovación y cuota de inscripción.</td><td>Vender un plan no basta para modelar una membresía. Titular, vigencia y derechos son datos propios; renovación automática queda fuera de esta maqueta.</td></tr>
<tr><td><a href="https://www.nngroup.com/articles/recognition-and-recall/" target="_blank" rel="noreferrer">NN/g · Reconocimiento</a> y <a href="https://www.nngroup.com/articles/progressive-disclosure/" target="_blank" rel="noreferrer">divulgación progresiva</a></td><td>Hacer visibles las opciones ayuda a reconocerlas; mostrar detalles según necesidad reduce complejidad inicial.</td><td>Productos frecuentes visibles, categorías estables y búsqueda. Peso solo al seleccionar un artículo por peso; vigencia solo para planes.</td></tr>
</tbody></table></div>
<p>Estas fuentes describen patrones de otros productos. No demuestran que una alternativa sea más rápida en nuestros comercios. La transferencia a CheckPass debe validarse.</p>
<h2>Tres alternativas que puedes probar</h2>
<div class="tablewrap"><table><thead><tr><th>Alternativa</th><th>Centro del trabajo</th><th>Fortaleza</th><th>Riesgo</th></tr></thead><tbody>
<tr><td>A · Venta directa</td><td>Catálogo y venta en curso. Cliente opcional.</td><td>Evita una puerta previa para una compra rápida. Recomendada como inicio de la panadería.</td><td>Necesita una entrada clara desde cita o trabajo pendiente cuando exista.</td></tr>
<tr><td>B · Atenciones</td><td>Elegir un trabajo en curso o iniciar una venta sin cita.</td><td>Da continuidad a servicios, pedidos y trabajos de taller.</td><td>Una lista de atenciones agrega un paso inútil si casi todas las ventas son inmediatas.</td></tr>
<tr><td>C · Cliente primero</td><td>Identificar a la persona y después operar.</td><td>Puede servir para consultas de beneficios y relaciones recurrentes.</td><td>Hace lento el comercio anónimo y reproduce el cuello de botella actual.</td></tr>
</tbody></table></div>
<p>La recomendación no es elegir una pantalla universal. Es compartir el espacio de trabajo de A y permitir que B lo abra con contexto. C se conserva como entrada a beneficios y consultas del cliente. No mostrar tres alternativas al operador: el selector existe solo para nuestra comparación.</p>
<h2>El modelo común y los límites por rubro</h2>
<div class="tablewrap"><table><thead><tr><th>Rubro</th><th>Entrada natural</th><th>Qué se cobra</th><th>Capacidad adicional</th></tr></thead><tbody>
<tr><td>Panadería</td><td>Nueva venta</td><td>Unidades y peso neto</td><td>Existencias por unidad/medida y precisión; recetas si corresponden.</td></tr>
<tr><td>Spa</td><td>Venta o cita</td><td>Servicios y productos</td><td>Profesional, recursos, duración; usar un paquete no es volver a venderlo.</td></tr>
<tr><td>Gimnasio</td><td>Cliente o venta</td><td>Plan, sesión, producto</td><td>Titular, vigencia, accesos, renovaciones. Membresía comercial y programa de fidelización son relaciones distintas.</td></tr>
<tr><td>Odontología</td><td>Paciente o cita</td><td>Consulta, procedimiento, cuota</td><td>Atención clínica y plan de tratamiento separados del cobro. Una cita no equivale a un procedimiento ni a una factura.</td></tr>
<tr><td>Taller</td><td>Orden de trabajo</td><td>Mano de obra y repuestos</td><td>Vehículo, presupuesto aprobado y estado del trabajo. Una agenda sola no alcanza.</td></tr>
</tbody></table></div>
<p><strong>Objetos conceptuales:</strong> cliente → relaciones y programas; venta → líneas, precios y descuentos; pago → dinero recibido y estado; atención/cita/trabajo → origen opcional; beneficio → elegibilidad, acreditación o canje. El catálogo puede contener artículos físicos, servicios y planes. La agenda organiza tiempo y recursos, y puede iniciar un cobro sin reemplazar sus conceptos.</p>
<p>La interfaz debería habilitar capacidades: venta inmediata, venta por peso, agenda, órdenes de trabajo, planes. Evitar una bifurcación rígida por rubro: un spa puede vender cremas; una panadería puede tomar pedidos para retirar. Tampoco conviene construir todas esas capacidades ahora.</p>
<h2>Flujos que deben quedar claros</h2>
<ol>
<li><strong>Venta inmediata:</strong> agregar conceptos → corregir cantidad/peso → identificar cliente opcionalmente → revisar cupón y total → registrar/confirmar pago → cierre y efectos confirmados.</li>
<li><strong>Desde una cita:</strong> abrir atención → cargar cliente y conceptos asociados → revisar lo efectivamente realizado → añadir extras → cobro común. Cobrar, atender y agendar tienen estados distintos.</li>
<li><strong>Solo beneficios:</strong> identificar cliente → acreditar compra externa o canjear premio → revisar consecuencias → confirmar. Nunca crear un segundo ingreso por una compra que ya se registró afuera.</li>
<li><strong>Reanudar:</strong> pausar una venta, atender otra persona y retomar sin mezclar clientes, cupones ni locales. En este prototipo es memoria temporal; persistencia y permisos quedan por definir.</li>
</ol>
<p>Identificar al cliente no prueba automáticamente que esté enrolado en el programa pertinente. Producción debe distinguir cliente encontrado, no enrolado, programa inactivo y pase inválido. No inscribir ni acreditar silenciosamente. En esta maqueta Ana ya está enrolada en el programa de cada escenario.</p>
<h2>Dinero, inventario y fidelización</h2>
<ul>
<li>El borrador no descuenta inventario, no consume cupones y no acredita beneficios. Una previsión debe decir “se acreditará”. El éxito solo se muestra después de una confirmación real.</li>
<li>Cierre coordinado e idempotente: venta, pago, cupón, stock y beneficios no pueden duplicarse por reintento o doble toque. Si el pago ya ocurrió y la respuesta se pierde, se consulta el estado antes de volver a cobrar.</li>
<li>Venta, entrega y servicio realizado pueden ocurrir en momentos diferentes. Primera fase: entrega inmediata. Anticipos, deudas, pagos parciales y entregas diferidas requieren reglas posteriores.</li>
<li>Salida por venta y merma son movimientos diferentes. Las pérdidas de pan o insumos no se infieren del cobro. Un servicio puede consumir insumos mediante una receta; no debe descontar stock de producto terminado por defecto.</li>
<li>Peso: unidad visible, conversión g/kg, precisión autorizada, precio base y redondeo monetario explícito. La maqueta calcula una línea por peso; producción necesita contrato decimal exacto y política de stock compatible.</li>
<li>Un beneficio puede exigir productos, un importe mínimo, local, fechas o un programa. El cupón fijo de esta maqueta no sustituye las reglas que ya tiene POS. Acumulación de cupones/premios y base de acreditación necesitan decisión explícita.</li>
<li>Canjear un premio puede descontar saldo y entregar stock sin recibir dinero. Un total cero no es necesariamente una venta vacía. Devoluciones deben revertir o compensar los efectos correspondientes.</li>
<li>Para compras externas se necesita referencia y prevención de duplicados. La versión real debe explicar si la fuente externa ya controla inventario. Esta simulación acredita únicamente fidelización.</li>
</ul>
<h2>Nombre y navegación</h2>
<p>Probaría <strong>“Vender”</strong> como acceso principal de la panadería y <strong>“Beneficios”</strong> como acceso directo independiente. <strong>“Atenciones”</strong> describe mejor la continuidad de servicios cuando exista esa capacidad. “Caja” es ambiguo si también administra turnos y efectivo; “Mostrador” limita la percepción del producto. El nombre debe probarse con tareas, no decidirse por preferencia interna.</p>
<p>El restaurante conserva su entrada por mesas y órdenes. No hace falta reemplazar el POS que ya funciona. La convergencia debería empezar por los conceptos compartidos y por el cierre, comprobando qué contratos actuales se pueden reutilizar.</p>
<h2>Guion de prueba antes de implementar</h2>
<p>Probar con 3–5 operadores como primera ronda cualitativa, en un teléfono real y con interrupciones. Comparar A/B/C con orden alternado y las mismas tareas. Medir éxito sin ayuda, tiempo hasta el cobro, correcciones de cantidad, errores de cliente/beneficio, retrocesos y comprensión del resultado. Esa muestra encuentra problemas; no demuestra una mejora estadística.</p>
<ol>
<li>Panadería: 5 panes de maíz, 2 medialunas, 1 kg de pan francés. Subtotal ficticio $8,00. Identificar a Ana al final, aplicar 10 % → $7,20. Recibir $10 → cambio $2,80 y 1 sello según la regla de ejemplo.</li>
<li>Cambiar el peso a 750 g → $2,70 de pan francés. Verificar precio, unidad y total sin convertir mentalmente ni perder otras líneas.</li>
<li>Venta sin cliente: completar sin QR. Después empezar otra con persona conocida; comprobar que no hereda la identidad anterior.</li>
<li>Interrumpir una venta: pausar, iniciar otra y retomar. Quitar cliente debe quitar su cupón y conservar productos. Fallo de registro debe conservar el borrador.</li>
<li>Spa: partir de una cita y añadir una crema. Distinguir finalizar el servicio de registrar el pago.</li>
<li>Gimnasio: vender plan con titular y fecha; explicar qué se activa y que no hay renovación automática en esta prueba.</li>
<li>Consultorio/taller: abrir atención y revisar conceptos. Preguntar qué falta para su trabajo real: tratamiento, aprobación, vehículo, pagos parciales, etc.</li>
<li>Solo beneficios: acreditar compra cobrada afuera y canjear premio. Preguntar si se registró un nuevo ingreso; la respuesta debe ser no.</li>
</ol>
<p>Criterio de avance: ninguna pérdida de borrador ni cierre con importe/cliente equivocado; ninguna atribución de beneficios duplicada; todas las tareas principales se completan sin ayuda después de corregir los hallazgos. Determinar metas de tiempo después de medir la línea base.</p>
<h2>Alcance de esta entrega</h2>
<p>HTML/CSS/JavaScript autónomos, cinco escenarios ficticios, tres entradas comparables, teléfono y escritorio. QR, pago, agenda, stock y acreditación son simulados. No hay backend, cámara, conexión con la plataforma, balanza, persistencia al recargar ni documentos fiscales. No certifica políticas de clínica o de membresías. El prototipo conserva una sola venta pausada.</p>
<p>La siguiente decisión es elegir el flujo inicial y cerrar reglas de peso, venta anónima, cliente/programa, cupones y cierre para la panadería. Después se escribe la spec y el contrato HTTP para implementar en los módulos reales. Agenda, membresías recurrentes y órdenes de trabajo son extensiones a definir, no promesas de la primera fase.</p>
`;

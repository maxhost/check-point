# Ideas laterales para la red local: el producto como sistema

> Síntesis del ejercicio de pensamiento lateral del 2026-09-29. Insumos: las siete notas de
> `research_notes/Ideas laterales para la red local/` (perfil del consumidor, juegos y hábitos, canales sin
> app, capacidad y descubrimiento, social y referidos, pagos y aliados, industrias lejanas) y
> `docs/red-y-atencion.md`. **Nada de esto está decidido.** Es una propuesta de producto para discutir con el
> owner.

## Cómo leer las cifras

Cada cifra lleva la confianza **tal como viene en su nota**. No se subió ninguna.

- **[A]** o **[V]**: la nota la leyó en la fuente (primaria, oficial o paper). Es lo único que se puede
  citar tal cual.
- **[NV]** = **no verificado**. Agrupa todo lo demás: M (fuente secundaria o, en algunas notas, «de
  memoria»), B (blog o dato de segunda mano), [M] (conocimiento previo del modelo) y «sin fuente». Al lado
  va la etiqueta original, por ejemplo **[NV: M]**.
- Cuando el dato es **auto-reportado por la empresa** (ClassPass, Block, Duolingo, Vitality), se dice
  explícitamente. Aunque se haya leído, no prueba que el efecto sea incremental.

**Límites de la síntesis:**

- Las siete notas agotaron el cupo de búsquedas web a mitad del trabajo, así que varias cifras quedaron en
  B o «sin fuente».
- **No hay ningún dato de Cuenca.** No se tocó ninguna base de datos. Toda cifra sobre la red de Cuenca es
  una hipótesis a medir.
- Los números que aparecen en las historias de cada semana son **ilustrativos**, no pronósticos.
- Los umbrales de «éxito» de los experimentos son una **propuesta de esta síntesis**. Los decide el owner.

---

## 0. La tesis en una página

**CheckPass tiene tres cosas que ninguna otra empresa de Cuenca junta en el mismo lugar:**

1. **Una visita física verificada.** El escaneo en el mostrador es un hecho, no un clic ni una encuesta.
2. **La misma persona vista en muchos comercios distintos.** Hay un solo pase para toda la red.
3. **Un grupo de control que ya existe** (`campaign_pushes.holdout`, ADR 0066). Con él se puede probar que
   una visita **no habría ocurrido igual**.

Las siete notas llegan, por caminos distintos, a la misma conclusión. **El producto no es «un canal de
avisos»** (el tope de 3 por día lo hace imposible). Es **un ciclo que aprende**:

```
   ESCANEO en el mostrador ──► el PERFIL aprende (reloj, respuesta, rubros, zona)
        ▲                                   │
        │                                   ▼
   VISITA medida contra              DECIDE qué ve cada uno y por dónde:
   el grupo de control  ◄──────────  1) recibo del escaneo  2) «Mis beneficios»
   (¿habría venido igual?)           3) frente del pase en silencio  4) aviso escaso
```

Los seis conceptos son piezas de ese ciclo:

| # | Concepto | Rol en el sistema | Resultado de la misión que empuja |
|---|---|---|---|
| 1 | **El mostrador como canal** (recibo de red) | La superficie de entrega principal: no tiene cupo y el cliente está presente | Los dos |
| 2 | **El cerebro de la red** (perfil causal) | Decide a quién, qué, cuándo y por qué canal; ahorra cupones | (1) más visitas de la base |
| 3 | **Llegar como conocido** (captación con progreso, estatus y referidos) | Convierte al cliente de otro comercio en cliente nuevo que vuelve | (2) clientes nuevos |
| 4 | **Horas valle y excedente** | Vende el hueco, no el producto; captación sin canibalizar | Los dos |
| 5 | **El juego de la ciudad** (racha de red, álbum, «Tu mes en Cuenca») | La razón para abrir «Mis beneficios» sin que lo empujen | (1) y hábito |
| 6 | **El aliado que paga** (cooperativa o banco + informe de lift) | Financia el beneficio y, eventualmente, los US$10 del comercio | Sostenibilidad |

**Qué percibe el comercio que paga ~US$10/mes.** Un informe mensual «en plata», con tres renglones que
solo la red puede darle, **siempre medidos contra el grupo de control**:

- *«Vinieron N visitas más de tu propia base de las que habrían venido igual.»*
- *«Llegaron M clientes nuevos desde la red, y K volvieron una segunda vez.»* Con el origen de cada uno:
  recibo de otro comercio, referido, ruta u hora valle.
- *«No regalamos X cupones a clientes que volvían igual.»*

La nota de capacidad estima que a un café le alcanza con **~8–10 cafés extra por mes** en la franja valle
para pagar los US$10. **[NV: [M], costo del café de ~US$0,30–0,40 estimado sin fuente.]**

**Qué percibe el consumidor y por qué abriría «Mis beneficios» sin que lo empujen:**

- Cosas **ya guardadas a su nombre**, que se pierden si no las usa.
- **Su racha y su progreso** en la ciudad.
- **Un solo** comercio nuevo recomendado por día, no una lista de 40.
- El **resumen de su mes**.

El recibo del escaneo, que ve varias veces por semana, es la puerta a esa pantalla. **Honestidad:** que la
gente abra la pantalla sin aviso es la hipótesis **menos probada** de todo el sistema. Por eso el primer
experimento la mide (§7).

---

## 1. El mostrador como canal: «el recibo de la red»

### 1.1 La cadena A → B → C

- **Supermercados (Catalina Marketing).** El cupón impreso en la caja, elegido según lo que compraste,
  aprovecha el momento de mayor atención e intención → **B:** el momento del pago es el mejor espacio
  publicitario que existe. [NV: M, «conocimiento general»]
- **Aerolíneas.** El pase de embarque se actualiza solo (puerta, asiento), sin notificar cada cambio → **B:**
  el pase es una vidriera que se consulta sin gastar avisos. (Mecánica de campos y `changeMessage`: doc de
  Apple [A]; casos de uso: Pushwoosh [NV: M].)
- **Restaurantes con QR en la mesa, App Clips.** Un soporte físico abre una experiencia sin instalar nada
  → **B:** el QR o NFC del mostrador es una puerta de entrada. (App Clips y Messages for Business: doc de
  Apple [A].)
- **Loterías de facturas (Taiwán, Portugal, São Paulo)** → **B:** un premio chico atado a la transacción
  hace que **el cliente** pida que lo registren (ver §5).
- **C para CheckPass:** el escaneo deja de ser un contador y pasa a ser **el canal principal de la red**.
  Tiene tres piezas:
  1. **Recibo de red.** Después de cada escaneo, la vista web del cliente y el pase muestran: «+1 sello en
     Café A (4/8) · Por estar acá: Gimnasio B, a 2 cuadras, te regala la primera clase». Este es el cupón
     cruzado que el owner ya había pensado, pero elegido por el cerebro (§2): rubro no competidor, ≤ 2 km,
     algo que todavía no vio, algo que la gente de su perfil canjeó.
  2. **Titular silencioso del pase por etapa.** El campo del frente se actualiza **sin notificación** (`TEXT`
     y no `TEXT_AND_NOTIFY` en Google; sin `changeMessage` en Apple) con un texto que depende de la etapa
     del cliente:
     - *nuevo:* «te falta 1 visita para tu primer premio»;
     - *frecuente:* «3 comercios a 300 m te dan algo hoy»;
     - *en riesgo:* «Café A te guarda un 2x1 hasta el viernes».
     **Separa escribir de avisar.** Hoy cada «+1 sello» gasta uno de los 3 avisos
     (`wallet/google-object.ts:147-164`, citado en `red-y-atencion.md` §1).
  3. **QR/NFC inverso en el mostrador y en las mesas** (`/l/cafe-a`):
     - al que no tiene cuenta: alta y botón «Agregar a Wallet»;
     - al que ya tiene: «Estás en Café A», sus beneficios de acá y de dos cuadras a la redonda.
     Funciona como **check-in sin GPS**. **Nunca suma sellos**, para evitar fraude desde casa.
  4. **«¿Cuándo volvés? [lun] [mié] [sáb]»** en el recibo (intenciones de implementación, Milkman et al.
     2011, +~4 puntos de vacunación; **[NV: M, de memoria]**). El aviso de ese día deja de ser marketing y
     pasa a ser un **recordatorio que el cliente pidió**.

### 1.2 Una semana en Cuenca

**Carla** trabaja cerca del Parque Calderón.

- **Lunes, 8:10.** Escanea su pase en la cafetería de siempre. En la vista que se abre ve «6/8 sellos» y,
  abajo: «Por estar acá: Panadería La Esquina, a 250 m, te regala un pan de yuca en tu primera visita». Toca
  «¿Cuándo volvés?» → miércoles.
- **Martes.** No recibe ningún aviso. Cuando abre la Wallet para pagar el bus ve el frente del pase: «Te
  faltan 2 cafés para tu premio».
- **Miércoles.** A las 7:50 le llega el único aviso del día, el que ella pidió: «Hoy es tu día de café».
  Vuelve. El recibo le recuerda el pan de yuca.
- **Jueves.** Pasa por la panadería y lo canjea. Queda inscripta ahí (su primer escaneo) sin cargar otro
  pase.

**Rosa**, dueña de La Esquina, no hizo nada distinto. Aprobó una sola vez su «bienvenida» (pan de yuca). El
viernes su panel dice: «4 clientes nuevos llegaron desde recibos de comercios vecinos esta semana» (número
ilustrativo). La cafetería tampoco hizo nada: su cliente siguió siendo suyo.

### 1.3 Evidencia

- Google distingue `TEXT` de `TEXT_AND_NOTIFY`. El tope de 3 por 24 h aplica a los avisos con
  notificación. **[A]** (doc oficial, leída por el orquestador, `red-y-atencion.md` §1; `TEXT`/`TEXT_AND_NOTIFY`
  según la nota de canales).
- Apple solo notifica si el campo trae `changeMessage`. Los push que no cambian datos se estrangulan en
  silencio. **[NV: M]** (Loyably, blog de proveedor.)
- Apple, guía de diseño de Wallet: «Never use a change message for marketing or other noncritical
  communication». **[A]** (verificado por el orquestador, `red-y-atencion.md` §6b.) → Refuerza el diseño: el
  marketing va en silencio o en la vista web, nunca como aviso de Wallet en iPhone.
- Hay un hueco declarado: un cliente de iPhone que tiene el pase pero no la PWA **no puede recibir ningún
  aviso de marketing** (`red-y-atencion.md` §6b). El mostrador es el canal que **sí** le llega.
- Precedente: Fivestars y SumUp muestran al comercio en la pantalla de cobro de comercios vecinos no
  competidores **[A: SumUp oficial]** (en `red-y-atencion.md` §4 y en el informe de redes).
- Intenciones de implementación: +~4 puntos. **[NV: M, de memoria]**.
- Costo del display QR+NFC: ~US$1–3 por local. **[NV: sin fuente]**.

### 1.4 Por qué es difícil de copiar

Un POS o una tarjeta de sellos de un solo comercio **no puede recomendar a otro comercio**, porque no sabe
dónde más compra el cliente. El valor no está en el QR sino en lo que hay detrás (la red y el perfil). Y el
pase único puede **elegir entre comercios** qué titular mostrar. Un pase por comercio no puede.

### 1.5 Riesgos y qué verificar

- **El cliente no mira el teléfono después del escaneo** (el escaneo lo hace el comercio). Mitigación: el
  recibo vive también en el frente del pase y en «Mis beneficios».
- **Apple podría estrangular** actualizaciones silenciosas frecuentes. No está documentado; hay que medirlo
  en un teléfono.
- **Google Wallet, política de uso:** un pase no debe promocionar productos de **otro emisor**. CheckPass es
  el único emisor, así que en la letra se cumple. En el espíritu, promocionar a otro comercio es **zona
  gris**: consultar a Google (`red-y-atencion.md` §6b, **[A]** sobre el texto).
- **LOPDP:** elegir el cupón cruzado con datos de otros comercios es perfilamiento (ver §2.5). Sin
  consentimiento de red, el recibo cae a reglas simples (rubro distinto y ≤ 2 km), que no usan historial
  cruzado.

### 1.6 Experimento de una semana

- **Set-up:** 2 cafés + 2 comercios de otro rubro a ≤ 2 km. Cupón cruzado en el recibo para la mitad de
  los clientes (usa el grupo de control existente). La otra mitad, sin cupón.
- **Métrica que decide:** **primeros escaneos en B con origen «recibo de A»** por semana, contra la mitad
  sin recibo.
- **Métrica secundaria:** el % de clientes que abre la vista web después del escaneo. Esto responde si
  alguien mira el recibo.
- **Umbral propuesto:** ≥ 1 cliente nuevo incremental por comercio receptor por semana. Si nadie abre la
  vista después del escaneo, el canal real es el frente del pase y hay que rediseñar alrededor de eso.

---

## 2. El cerebro de la red: perfil causal que decide qué ve cada uno y por dónde

### 2.1 La cadena A → B → C

- **Telcos, modelos de uplift.** Predicen el **efecto incremental** de contactar a alguien, no la
  probabilidad de que responda. Separan cuatro tipos de cliente: *persuadibles* (vuelven solo si los
  contactás), *seguros* (vuelven igual), *causas perdidas* (no vuelven con nada) y *no molestar* (el
  contacto los aleja). **[A]** (concepto, Wikipedia y guía de uplift-modeling.)
- **Starbucks Deep Brew.** Aprendizaje por refuerzo para elegir la oferta de cada miembro. **[A]**
  (Microsoft 2019; la cifra de «+15 % de engagement» es **[NV: B]**, no es de Starbucks.)
- **dunnhumby, Tesco y Payback (coaliciones).** El dato de una categoría mejora la oferta de otra.
  Clubcard **[NV: M]**; Payback > 35 M de clientes **[A]**; Kroger ~70 % de redención de cupones
  personalizados **[NV: B]**.
- **Ensayos micro-aleatorizados en salud** (HeartSteps). Cada aviso posible se sortea para aprender qué le
  sirve a cada persona. **[NV: M, de memoria]**.
- **Braze e Iterable** eligen el canal más barato que funciona para cada persona. **[NV: M, conocimiento
  general]**.
- **B:** aprender **qué le cambia la conducta a cada persona**, no quién «responde».
- **C para CheckPass**, en cuatro productos:
  1. **Reloj personal.** Las etapas «te extrañamos / en riesgo / perdido» se disparan en **múltiplos de la
     cadencia propia** de la persona en ese rubro (por ejemplo 1,5× / 2,5× / 4×). Cuando hay poca historia,
     se usa la regla por rubro como punto de partida. **Esto corrige el ejemplo del owner.** «Responde a
     *perdido* y no a *te extrañamos*» casi siempre es un tema de **reloj**, no de tono: el «te extrañamos»
     de los 21 días le llega a quien vuelve naturalmente cada 40.
  2. **«No regales a quien vuelve igual».** A los *seguros*, mensaje sin cupón. A los *persuadibles*,
     cupón. A las *causas perdidas*, nada (así no se gasta cupo). El comercio ve: «Este mes no regalamos 38
     cafés a clientes que volvían igual, y la tasa de vuelta no cambió» (número ilustrativo).
  3. **Escalera de canales por persona.** El orden de peldaños:
     1) «Mis beneficios»; 2) titular silencioso del pase; 3) proximidad; 4) recibo del escaneo; 5) email;
     6) aviso de Wallet o Web Push (escaso); 7) SMS (solo lo de alto valor).
     Regla: **quien canjea desde el pase silencioso nunca recibe aviso.** El aviso se gasta en quien solo
     responde a aviso.
  4. **Árbitro del cupo.** Entre los comercios que compiten por el aviso del día gana el **uplift esperado
     para esta persona y este tipo de mensaje**, no el rendimiento general del comercio. Se combina con
     rotación y cercanía (borrador de `red-y-atencion.md` §3).
- **Cómo se comparte sin exponer datos:** con **encogimiento estadístico** (bayes empírico; técnica
  estándar, **[NV: sin fuente]**). La estimación de cada persona empieza como el promedio de su segmento y
  se corre hacia su propia evidencia a medida que la acumula. El comercio N.º 6 hereda lo aprendido en los
  otros cinco **sin ver el dato de ninguno**. El comercio **nunca ve el perfil**: ve efectos agregados.

### 2.2 Una semana en Cuenca

**Diego** va a su peluquería cada ~35 días y a la panadería del barrio dos veces por semana.

- **Hoy, sin el cerebro:** la peluquería le manda «te extrañamos» el día 21. Diego iba a volver el 35
  igual. La peluquería regala un 20 % para nada y gasta uno de sus 3 avisos del día.
- **Con el cerebro:**
  - El día 21 no pasa nada.
  - El día 52 (1,5× su ritmo) aparece en su «Mis beneficios»: «Tu corte con 15 %, guardado hasta el
    domingo». No hay aviso: en tres comercios distintos, Diego canjeó desde la pantalla sin que lo
    avisaran.
  - Esa semana el único aviso de Diego lo gana otro comercio, el café al que dejó de ir, donde su historial
    en la red dice que el aviso sí le cambia la conducta.

**Andrea**, dueña de la peluquería, recibe su informe el viernes: «A 25 de tus 80 clientes dormidos no les
mandamos cupón porque en la red vuelven sin cupón; les mandamos solo el recordatorio. Resultado contra el
grupo de control: …» (el número lo da la medición).

### 2.3 Evidencia

- **Lo que ya existe en el código** (nota de perfil, verificado en el árbol):
  - holdout en `campaign-push.ts:47`;
  - `sent_at` y `clicked_at` en `campaign-push.ts:34-55`;
  - cupón tipado en `campaign.ts:58-107`;
  - `marketingOptOutAt` por comercio en `consumer.ts:138-150`;
  - `category_gcid` y lat/long de los locales en `business.ts`.
  **No se verificaron** columna por columna las tablas de escaneo y canje.
- Uplift: concepto **[A]**. Deep Brew: **[A]** para el mecanismo.
- Kroger 70 %: **[NV: B]**. Cupón masivo 1–3 %: **[NV: sin fuente]**.
- Duolingo, que es un aprendizaje de otro rubro sobre la retención: ver §5.
- Coaliciones: **las canibalizaciones entre socios superan a las sinergias, salvo entre socios chicos no
  competidores** (Dorotic et al., JAMS 2021, **confianza media-alta** en el informe de redes). → El cerebro
  **no** debe aprender entre competidores del mismo `category_gcid`.

### 2.4 Por qué es difícil de copiar

- El valor **crece con la cantidad de comercios por consumidor**. Un comercio solo nunca tiene eventos
  suficientes para aprender qué mensaje sirve.
- Casi ningún programa local mide contra un grupo de control; CheckPass ya lo hace.
- El dato se acumula con cada escaneo. Quien llegue después arranca de cero.

### 2.5 Riesgos y qué verificar

- **Volumen.** Todo depende de una métrica que **hoy nadie conoce**: qué fracción de consumidores es
  miembro de ≥ 3 comercios. Si es < 10 % (umbral de la nota de perfil), el nivel «persona» no aporta y el
  cerebro trabaja solo a nivel segmento (rubro × etapa × franja), que igual sirve.
- **LOPDP.** La nota de perfil leyó el texto de la ley: **[A]**, Registro Oficial Supl. 459, 26-may-2021.
  - La ley define **«elaboración de perfiles»** exactamente como lo que se quiere hacer: incluye
    preferencias, intereses, ubicación y movimiento físico.
  - **Art. 8:** el consentimiento hoy es **por comercio** (escanear = afiliarse). Cruzar datos entre
    comercios es **otra finalidad** y necesita su propio consentimiento, revocable por un camino similar al
    que se usó para darlo.
  - **Art. 16.2:** derecho de oposición a la mercadotecnia directa, «incluida la elaboración de perfiles».
    Hace falta un interruptor de red **«no me perfiles»**, distinto del opt-out por comercio. Si lo activa,
    el cliente vuelve a las reglas por rubro.
  - **Art. 20:** derecho a no ser objeto de decisiones automatizadas con efectos jurídicos, y a pedir una
    explicación. Dar descuentos distintos a personas distintas se acerca a ese límite. Diseño: un **«¿por
    qué veo esto?»** en cada beneficio.
  - **Art. 26:** datos de salud. Farmacias, clínicas, ópticas y laboratorios **no alimentan el perfil de
    red**.
  - **Art. 21:** menores. Sin perfilamiento automatizado.
  - **Art. 33:** el perfil **no sale de CheckPass** (el comercio ve efectos, nunca personas de otros
    comercios).
  - **Art. 42:** evaluación de impacto. Posiblemente no es obligatoria aquí; hacerla es barato y
    defendible.
  - La vigencia de las sanciones desde 2023 es **[NV: M]**.
- **Sobreprometer personalización individual con ruido.** Empezar con segmentos y decirlo así.

### 2.6 Experimento de una semana

Tiene dos partes, ninguna necesita construir producto:

1. **Consulta en una rama de Neon, no en producción** (regla del repo):
   - distribución de memberships por consumidor;
   - para quienes tienen ≥ 3, **correlación entre «vuelve después de un cupón» en un comercio y en otro**;
   - tasa de vuelta tratado vs holdout por etapa y tipo de mensaje, en las campañas ya corridas.
   **Decide:** si la correlación es ~0, la hipótesis del owner («si no respondió en 5 comercios, tampoco en
   el 6.º») **no se sostiene con estos datos** y se ahorra construir el nivel persona.
2. **Tres brazos en 5 comercios** que ya corren «te extrañamos»: mensaje sin cupón / mensaje con cupón /
   holdout. **Métrica que decide:** visita a los 14 días. Si el cupón no agrega sobre el mensaje entre los
   clientes «regulares», el producto «no regales a quien vuelve igual» ya tiene su primer número. (La
   medición completa lleva 14 días; la semana alcanza para lanzarla.)

---

## 3. Llegar como conocido: el cliente de la red entra a un comercio nuevo con ventaja

### 3.1 La cadena A → B → C

- **Lavadero de autos (Nunes y Drèze, *JCR* 2006).** Una tarjeta de 10 sellos con 2 ya puestos se completó
  más que una de 8 vacía, con la misma distancia real. Paper **[A]**; las cifras 34 % vs 19 % son
  **[NV: M]** (salen de resúmenes secundarios, a confirmar con el PDF). **B:** quien siente que ya empezó,
  termina.
- **Aerolíneas, niveles de estatus y *status match*.** Los niveles se pierden si no se recalifican, y una
  aerolínea competidora reconoce el nivel de otra. **[NV: M, sin fuente abierta]**. **B:** un estatus
  portable atrae a los mejores clientes de otro lugar.
- **Meta y Google, audiencias parecidas (*lookalikes*).** Buscan personas parecidas a los mejores
  clientes. Google Demand Gen **[A]**; guías de Meta **[NV: M]**. **B:** se capta gente parecida a la
  buena, sin definirla a mano.
- **Hinge, «Most Compatible» + «We Met».** Una sola sugerencia por día, elegida por interés **mutuo**, y la
  cita real alimenta la siguiente. Declara 8× más citas **[NV: M, dato de la empresa]**.
- **Dropbox, referido de dos lados.** De 100.000 a 4 M de altas en 15 meses, ~35 % de las altas diarias
  por referido **[NV: M]**. **Nubank:** ~90 % de clientes orgánicos o por referido **no pagado**, CAC de
  US$4,95 **[A: prospecto F-1 ante la SEC]**. **B:** el pago acelera el referido; lo que lo causa es que el
  producto guste.
- **WeChat, sobres rojos.** El regalo fue la excusa para superar la fricción (vincular la tarjeta). 1.200 M
  de sobres en la gala de 2015 **[NV: M]**.
- **C para CheckPass: un solo embudo de captación con cuatro puertas y una sola llegada.**
  - **Llegada con progreso dotado.** Quien ya es cliente de otro comercio de la red arranca su tarjeta en
    el comercio nuevo en **2/10** («2 sellos por ser de la red»), no en 0/8. El esfuerzo exigido es el
    mismo, así que **el comercio no regala nada**.
  - **Nivel de red portable** («Vecino» → «Vecino frecuente» → «Vecino de oro», por visitas a la red en un
    trimestre y con un mínimo de comercios distintos). El comercio nuevo **ve que llega un cliente bueno**:
    frecuente en otros lados, no un cazador de ofertas. Puede darle un trato de nivel desde el día 1.
    **Solo ve el nivel, nunca el historial.**
  - **Puerta 1, «tu comercio del día»:** una sola recomendación diaria en «Mis beneficios» de un comercio
    donde todavía no es miembro. Se elige por encaje **mutuo**: le conviene al consumidor (rubro, horario,
    zona) **y** al comercio (tiene lugar a esa hora, busca ese tipo de cliente).
  - **Puerta 2, recibo de otro comercio** (§1).
  - **Puerta 3, referido cruzado de dos lados:** «Trajiste a Ana al Café A → tenés 1 sello extra en la
    Panadería B, donde ya sos cliente». El premio del que invita **lo paga otro comercio**, que a cambio
    recibe una visita. Se libera **en el primer escaneo del invitado**, con una persona física en el
    mostrador (esto corta el fraude de autoreferirse).
  - **Puerta 4, premio transferible:** «Regalá tu café gratis a alguien que nunca vino». El premio ya
    estaba ganado, así que al comercio le cuesta lo mismo y gana una cara nueva.
  - **El «We Met» de CheckPass es el escaneo.** No hay que preguntar si la visita ocurrió. Se agrega un
    toque: «¿Volverías?».

### 3.2 Una semana en Cuenca

**Mateo** es «Vecino frecuente»: va a 4 comercios de la red en El Vergel.

- **Lunes.** En «Mis beneficios» ve su comercio del día: «Heladería Nieve, a 400 m: tu primera visita
  arranca con 2 sellos por ser de la red».
- **Miércoles.** Va. La cajera ve en su pantalla «Vecino frecuente: primera visita» y le ofrece probar un
  sabor. Su tarjeta arranca en 2/10.
- **Sábado.** Mateo le regala a su hermana el café gratis que tenía ganado en su cafetería. Ella crea la
  cuenta para canjearlo.

**La heladería** recibió un cliente nuevo **pre-calificado**. **La cafetería** recibió una cara nueva sin
costo extra. **La panadería** donde Mateo es habitual le dio a él 1 sello por el referido y ganó una visita.
Los tres ven en su panel de dónde vino cada cliente nuevo y si volvió.

### 3.3 Evidencia

- **Progreso dotado.** Paper **[A]**; 34 % vs 19 % **[NV: M]**. Es el único mecanismo de toda la
  investigación con un **experimento de campo publicado hecho justo con tarjetas de sellos**.
- **Gradiente de meta** (Kivetz et al., 2006): se acelera cerca del premio. **[NV: M, de memoria]**.
- **Nubank, 90 % orgánico, CAC de US$4,95:** **[A]**.
- **Dropbox:** **[NV: M]**. **Hinge 8×:** **[NV: M]**.
- **Belly Bites** cobraba ~US$5–7 por cliente nuevo, segmentado por lo que el cliente hacía en otros
  comercios Belly, y evitaba a los clientes de la competencia. **Confianza media** (informe de redes).
  Belly terminó vendida en US$3 M **[A: 10-K de Mobivity]**. → Adquirir con descuento no garantiza que el
  cliente se quede; por eso la métrica acá es **la segunda visita**.
- **Groupon** (ver §4.3): solo ~20 % de los compradores volvió a precio completo **[A]**. → El diseño apunta
  a la segunda visita, no a la primera.

### 3.4 Por qué es difícil de copiar

Una tarjeta de sellos suelta **no puede dotar progreso «por ser de la red»**, porque no sabe quién sos. El
estatus portable es **el efecto de red hecho visible**:

- cada comercio que se suma hace más valioso el nivel;
- cada cliente de nivel alto hace más atractiva la red para el comercio.

El referido pagado en un tercer comercio es imposible fuera de una red.

### 3.5 Riesgos y qué verificar

- **Que el comercio lea «me regalan mis sellos».** Hay que mostrarle que el esfuerzo es el mismo.
- **Fraude:** cuentas dobles y «amigos» que ya eran clientes. Mitigación: se libera en el primer escaneo
  físico, un premio por par de personas, tope por mes.
- **Canal de compartir.** El owner descartó WhatsApp **como canal de la plataforma**. Acá comparte el
  cliente, desde su teléfono, con el menú nativo del sistema. **Es una pregunta para el owner, no una
  decisión**.
- **Nivel sin beneficio = título vacío.** Hace falta al menos un beneficio garantizado.
- **Lookalike con poco volumen** degenera en «vive cerca» (que igual sirve).
- **LOPDP:** el nivel de red y el lookalike son perfilamiento; aplica §2.5.

### 3.6 Experimento de una semana

- **Set-up:** 2 comercios nuevos de la red. A la mitad de los clientes de la red que se suman (sorteo con
  el grupo de control) se les da 2/10; a la otra mitad, 0/8. En paralelo, en 3 comercios de un mismo
  barrio: link de referido hecho a mano más una planilla.
- **Métrica que decide:** **segunda visita dentro de los 14 días** (2/10 vs 0/8), y **primeros escaneos por
  referido por comercio y por semana**.
- **Umbral propuesto** (de la nota social): ≥ 1 cliente nuevo atribuible por comercio por semana.

---

## 4. Horas valle y excedente: vender el hueco, no el producto

### 4.1 La cadena A → B → C

- **ClassPass (SmartRate y SmartSpot).** El estudio fija un piso de precio confidencial y la red solo abre
  los lugares que sobran. **[V]**, confianza **M** (auto-reportado por el vendedor, sin control):
  - ~20 % más de pago y más del doble de visitantes nuevos;
  - **94 % de los usuarios son nuevos** para el estudio que visitan.
- **Too Good To Go.** La «bolsa sorpresa» del cierre es una muestra gratis que el cliente paga y **no
  canibaliza** la venta normal. **[V]**, confianza **M-B**:
  - 58 % probó comercios nuevos;
  - 76 % *dice* haber vuelto a precio completo (es una encuesta, no retorno medido).
- **Aerolíneas, hoteles y Eatigo (*yield management*).** La misma silla vale distinto según la hora; en
  Eatigo, mayor descuento a las 15 h y ninguno a las 20 h. **[V]**, confianza **M**, sin datos de
  resultado.
- **Groupon, la advertencia.** **[V]**, confianza **A** (Dholakia; Wharton):
  - solo ~20 % volvió a precio completo;
  - 21,7 % ni siquiera canjeó;
  - en 324 negocios, 55,5 % ganó plata y 26,6 % perdió;
  - restaurantes y bares, peor que los servicios con capacidad ociosa.
- **B:** se vende **el hueco** (la silla vacía de las 15:30, el pan que sobra a las 19:00) y **solo a quien
  no es cliente** o está dormido. Así el descuento no canibaliza la hora pico ni al cliente fiel.
- **C para CheckPass:**
  1. **«Ahora mismo, cerca tuyo».** Beneficios que existen **solo** en la franja muerta de cada local,
     visibles **solo** para no-clientes o dormidos. La franja **la propone la red** desde los escaneos
     («tu martes 15–17 h tiene 70 % menos escaneos que tu promedio», ilustrativo). El comercio aprueba la
     franja y su «piso», es decir lo máximo que está dispuesto a regalar.
  2. **Sellos ×2 en hora valle.** Una versión sin descuento: no baja el precio, sube el premio. No sale
     plata de la caja hoy. Se ve en el frente del pase («sello ×2 hasta las 17 h»).
  3. **«Rescates de hoy».** Bolsa de panadería de las 19 h, reservable en la PWA, que se retira mostrando el
     pase. **El retiro es el primer escaneo**: el cliente de la bolsa entra al ciclo de vida del comercio.
     TGTG entrega al cliente y lo suelta; CheckPass lo retiene.

### 4.2 Una semana en Cuenca

**Sofía** estudia en la Universidad de Cuenca y tiene huecos a media tarde.

- **Martes, 15:20.** En «Mis beneficios» ve «Ahora mismo, a 300 m: Café Molino, capuchino con humita al
  precio del capuchino, hasta las 17 h». Nunca fue a ese café. Va, y su tarjeta arranca en 2/10 (§3).
- **Jueves, 18:45.** Reserva una «bolsa de las 19 h» en una panadería que no conocía y la retira con su
  pase.
- **Tres semanas después** vuelve a la panadería a precio completo un sábado: ese es el número que importa.

**Don Luis**, del Café Molino, aprobó una sola cosa: «mi martes 15–17 h, hasta 1 humita por persona». Su
informe dice cuántos clientes nuevos llegaron en esa franja, cuántos volvieron fuera de ella, y (contra el
grupo de control) si fueron visitas extra o las mismas mudadas de hora.

### 4.3 Evidencia

- Groupon **[A]**. Es la cifra más dura de este concepto y es una **advertencia**: marca las reglas de
  diseño (nunca a cualquiera, nunca a cualquier hora, medir el retorno a precio completo).
- ClassPass 94 % nuevos, ~20 % más de pago **[V/M]** (auto-reportado). La historia del cierre del plan
  «ilimitado» en 2016 **[NV: B]**.
- TGTG 58 % / 76 % **[V/M-B]** (encuesta). Escala de ~164.000 comercios y ~62 M usuarios **[V/M]**.
- Panera Sip Club: **corregido el 2026-09-29** — el «~4 → ~10 visitas por mes» no aparece en las fuentes; lo
  leído dice +200 % de frecuencia y 15+ días por mes en el piloto (cifras de la empresa; ver
  `docs/red-horas-valle-y-modelo.md` §1).
- Blackbird, bonus en días flojos para un segmento **[V/M]**, sin datos públicos de resultado.

### 4.4 Por qué es difícil de copiar

- **La curva de ocupación por hora sale gratis del escaneo.** Un directorio o un Instagram no la tienen.
- Groupon no podía saber quién ya era cliente; **CheckPass sí**.
- El grupo de control puede probar algo que ClassPass nunca publicó: **si la visita en hora valle fue
  incremental**.

### 4.5 Riesgos y qué verificar

- **Canibalización horaria:** el cliente fiel se muda de hora sin sumar una visita. Mitigación: se muestra
  solo a no-clientes, y se mide visitas por cliente por semana, no escaneos en la franja.
- **Cazadores de gangas** que no vuelven (el problema de Groupon). Métrica: vuelta a precio completo a 30
  días.
- **No-show de las bolsas** si no se paga por adelantado (hoy no hay medios de pago propios). Mitigación:
  límite de reservas por persona.
- **Rubro:** funciona mejor donde el costo marginal del hueco es ~0 (gimnasio, peluquería a las 11, café
  a la tarde, panadería al cierre) que en un restaurante lleno de insumos. **[A]**, derivado de Groupon.

### 4.6 Experimento de una semana

- **Set-up:** 3 cafés. Del historial se saca la peor franja de cada uno. Se crea un beneficio válido solo
  en esa franja y visible solo para miembros de la red que **nunca** escanearon ahí. La mitad de esa
  audiencia no lo ve (control). En paralelo: 3 panaderías con 5 bolsas por día.
- **Métricas que deciden:**
  - escaneos en la franja contra el control y **visitas totales por cliente por semana** (para saber si
    suma o solo muda);
  - en las bolsas, **% de retirantes que vuelve a escanear a precio completo en 30 días**. Este número es
    el argumento de venta de los US$10.

---

## 5. El juego de la ciudad: la razón para abrir «Mis beneficios» sin que lo empujen

### 5.1 La cadena A → B → C

- **Loterías de facturas.** Tres casos:
  - Taiwán, desde 1951, con premios chicos cobrables en el mismo minimercado **[A: mecánica]**; recaudación
    +~75 % el primer año **[NV: M]**.
  - Portugal: facturas con NIF +36,3 % al año y +51,2 % a los dos años; costó €4,3 M **[NV: M]**.
  - **São Paulo (Naritomi, *AER* 2019):** ventas declaradas +≥ 21 % en 4 años, con un efecto propio de la
    lotería **[A]**.
  **B:** un premio aleatorio y barato atado a la transacción cambia **quién pide que se registre**: deja de
  depender del cajero y pasa a depender del cliente.
- **Duolingo, rachas.** Racha de 7 días → 3,6× más probabilidad de terminar el curso; pasar de 1 a 2
  comodines («streak freeze») → +0,38 % de aprendices activos diarios **[A: la empresa lo publica;
  correlacional]**. La reducción de ~21 % del abandono con el comodín y el +22 % de las rachas con amigos
  son **[NV: B]**.
- **Strava Local Legends** corrige el error de las «alcaldías» de Foursquare, que en los lugares populares
  se volvían inalcanzables. La leyenda de un tramo es quien **más veces** lo recorrió **en 90 días
  móviles**, sin importar la velocidad **[A: soporte de Strava]**.
- **Ale Trails y álbumes de figuritas.** Una colección finita y con nombre hace deseable visitar lugares
  nuevos **[A: mecánica]**. **No se encontró ninguna medición de visitas incrementales.**
- **Spotify Wrapped.** 1,2 M de posts en Twitter en 2019 **[NV: M]**.
- **6AM City, newsletters de ciudad.** Contenido local que la gente abre y monetización con comercios
  **[A: entrevistas; cifras autodeclaradas]**.
- **Efecto dotación:** «guardado para vos» se valora más que «hay una oferta» **[NV: M, de memoria]**.
- **Pokémon GO y BeReal, la advertencia.** El pico de novedad se va:
  - Pokémon GO pasó de ~45 M a ~30 M de usuarios diarios en 6 semanas **[NV: M]**;
  - BeReal pasó de 15 M a ~6 M **[NV: M]**.
  → **El juego trae el pico y el hábito lo sostiene.** Toda mecánica tiene que terminar en una segunda
  visita.
- **C para CheckPass.** Cinco piezas, todas sin push y todas dentro de «Mis beneficios» y el frente del
  pase:
  1. **Racha semanal de red.** «12 semanas seguidas comprando local en Cuenca», en **cualquier** comercio
     de la red. Un comodín por mes. Se ve en el frente del pase. **El único aviso** que usa es «tu racha
     de 11 semanas termina el domingo»: el aviso con mejor relación valor/cupo, porque lo pide la pérdida.
  2. **Álbum de Cuenca y rutas.** Una figurita por rubro. Los huecos grises dicen «la más cercana: Heladería
     Z, a 300 m». Las figuritas raras (comercios nuevos, barrios menos visitados) **empujan el tráfico a
     donde la red lo necesita**. La ruta arranca con 1 de 5 sellos puestos (progreso dotado) y el escalón
     final **exige volver** a uno de los comercios.
  3. **Todo «guardado para vos».** Cada beneficio aparece ya asignado, con nombre y vencimiento. Un solo
     vencimiento destacado por vez.
  4. **«Tu mes en Cuenca».** Resumen mensual (anual en diciembre): «7 visitas en 4 comercios, US$11
     ahorrados, sos del 5 % más fiel de El Patio». Se puede compartir, siempre por opt-in. **Es el momento
     natural para pedir el consentimiento de red** que exige la LOPDP (§2.5): muestra el valor del perfil y
     pone el interruptor al lado. Del lado del comercio, su propio «Wrapped»: el informe en plata, armado
     para que el comercio **lo quiera publicar**.
  5. **Sorteo de la red por escaneo.** Cada escaneo es un boleto; muchos premios chicos donados por los
     comercios (un café, al instante) y uno grande de red por mes. Variante: una «hora dorada» secreta,
     revelada después. **Condicionado a lo legal (ver 5.5).**

### 5.2 Una semana en Cuenca

**Valeria** lleva 9 semanas de racha de red.

- **Lunes.** Abre «Mis beneficios» sin que nadie la avise, para ver su racha (está en 9) y su álbum: le
  faltan heladería y peluquería en «Página El Centro».
- **Miércoles.** Escanea en su panadería. El recibo dice «Boleto #4812 para el sorteo del domingo · 5
  boletos este mes · boleto doble en un comercio donde nunca estuviste».
- **Viernes.** Pasa por la heladería que le faltaba: figurita, y boleto doble.
- **Domingo.** Ve los ganadores en la PWA. No ganó, pero un café en su panadería le salió «¡Sorpresa!» el
  miércoles.

**Los comercios** no hicieron nada nuevo. La panadería aportó 5 cafés al pozo del mes. **El cajero** dejó
de tener que pedir el pase: **lo pide Valeria**. Eso resuelve un problema operativo real, el del cajero que
se olvida de escanear.

### 5.3 Evidencia

- Naritomi (*AER* 2019): +≥ 21 % **[A]**. Es la evidencia **más dura** del dominio de juegos, aunque es
  fiscal, no comercial.
- Duolingo 3,6× y +0,38 % **[A, auto-reportado y correlacional]**.
- Strava **[A, mecánica]**. Ale Trails **[A, mecánica; sin medición de efecto]**.
- Taiwán +75 % y Portugal +36,3 % **[NV: M]**. Starbucks, +23 % de visitas por gamificación **[NV: B]**.
- 6AM City **[A, cifras autodeclaradas]**.

### 5.4 Por qué es difícil de copiar

- Una tarjeta de cartón no lleva una racha, y la **racha de red** solo existe si hay red. Además es
  robusta: la sostiene el comercio que le queda cerca esa semana.
- Un comercio suelto no junta un pozo que valga la pena; 100 comercios con un premio chico cada uno, sí.
- El álbum convierte la regla del owner (rubros no competidores) en el juego mismo.
- «Tu año en Cuenca» es imposible sin ver los cruces entre comercios.

### 5.5 Riesgos y qué verificar

- **SORTEOS EN ECUADOR: sin fuente.** Ninguna nota lo verificó. Los sorteos promocionales pueden requerir
  autorización o reglas de «sin obligación de compra». **Consulta legal antes de cualquier experimento con
  azar**, incluido el «¡Sorpresa!». Mientras tanto, las piezas 1–4 no tienen azar y se pueden hacer.
- **Privacidad de los rankings:** mostrar nombres en «Leyenda del local» es un riesgo, igual que el feed
  de Venmo (**[NV: B]** sobre los escándalos). Solo alias, inicial u opt-in, y escalones por percentil
  («Top 10 del local») para que la meta sea alcanzable.
- **Rachas infladas** con compras mínimas. Poner un monto mínimo o aceptarlo como costo del hábito.
- **Datos pobres en el piloto** (el resumen queda vacío). Hacerlo trimestral al principio.
- **Novedad que decae.** Por eso cada mecánica termina en una segunda visita.

### 5.6 Experimento de una semana

- **Set-up:** a la mitad de los usuarios activos (control existente) se le muestra en «Mis beneficios» y en
  el frente del pase la **racha semanal de red** y el **álbum de 6 rubros** de un barrio. A la otra mitad,
  nada.
- **Métrica que decide todo el sistema:** **aperturas de «Mis beneficios» por usuario por semana SIN aviso
  previo**. Se mide el tratamiento contra el control y contra la semana anterior.
- **Métrica secundaria:** clientes existentes que abren un comercio nuevo de la red en 2 semanas.
- El sorteo **no entra** en este experimento hasta tener la respuesta legal.

---

## 6. El aliado que paga: la cooperativa financia el beneficio y CheckPass pone red y medición

### 6.1 La cadena A → B → C

- **Block, Cash App Neighborhoods.** El consumidor gana «Local Cash» (10 % del subtotal, tope US$10) que
  gasta **en cualquier comercio de la red**. **Cash App financia el saldo durante el arranque.** El
  procesamiento cuesta 1 %.
  - Mecanismo: **[A]**.
  - Los seguidores hacen ~10 % del volumen del comercio y transaccionan 50 % más seguido: **[NV: M,
    cifras de Block sin grupo de control]**.
  - US$1.000 M de volumen anualizado en junio de 2026: **[NV: M]**.
- **Bancos y billeteras de Ecuador.**
  - **Deuna (Banco Pichincha): 0 % de comisión al comercio en QR presencial [A].** Además paga cashback
    (Club Deuna **[NV: M]**).
  - **JEP, cooperativa nacida en Cuenca:** JEPFast, >100 mil establecimientos, paga el **Tranvía de
    Cuenca**, parte de la red CHAS **[A]**.
  - Banco Guayaquil, Banco del Barrio: >4.600 tiendas como corresponsales **[A]**.
  - El tamaño de Deuna (314 mil vs 620 mil comercios) es **[NV: B]**: las cifras no cuadran.
- **Telcos (Claro Club).** Cupones con QR que paga el comercio, para bajar el churn **[NV: M; Ecuador no
  leído, B]**.
- **B:** en Ecuador **el QR ya es gratis**. Tres entidades gastan plata para llevar transacciones al
  comercio chico, pero sus promos visibles son con **cadenas** (TIA), porque **no tienen cómo llegar a la
  panadería de la esquina con una promo segmentada ni cómo medir si trajo una visita que no iba a pasar**.
- **C para CheckPass:**
  1. **El acuerdo.** El aliado pone un presupuesto de beneficio y su QR. CheckPass pone la red, la
     distribución (recibo y «Mis beneficios», sin gastar avisos), la segmentación por etapa (el cashback va
     al que está «en riesgo», no al que venía igual) y **el informe de lift contra el grupo de control**:
     «costo por visita incremental: US$X». **Ningún banco en Ecuador recibe hoy ese número de su promo.**
  2. **El premio mayor: que el aliado pague los US$10/mes de los comercios** que aceptan su QR, como ya
     regala el QR. Resuelve el precio que el owner ve como límite.
  3. **La escalera hacia los «pagos propios» sin pelear por comisión:**
     1) fidelización + medición;
     2) beneficio financiado por el aliado y activado pagando con su QR;
     3) **saldo de red emitido por el aliado** (así CheckPass evita necesitar licencia de dinero
        electrónico);
     4) score de salud del comercio para crédito.
     Liquidación manual con una lista mensual en la fase 1.

### 6.2 Una semana en Cuenca

**El tranvía y la panadería.**

- **Lunes.** **Jorge** paga su pan con JEPFast, como siempre. El recibo de CheckPass dice: «Pagando con
  JEPFast, tu sello vale doble esta semana». El cajero no hizo nada distinto: escaneó el pase y cobró con el
  QR de JEP.
- **Fin de mes.** CheckPass le entrega a JEP un informe: «Los 1.000 clientes con el beneficio vs 1.000 sin
  él hicieron N visitas más; costo por visita incremental US$X» (N y X los da la medición). La panadería ve
  en su panel que la suscripción de ese mes la pagó JEP.

### 6.3 Evidencia

- Deuna 0 % y JEP **[A]**. Block, mecanismo **[A]**; efectos **[NV: M, auto-reportados]**.
- Del informe de redes: **las redes de comercios chicos que sobreviven tienen detrás un procesador de
  pagos o un ancla con caja**. Belly, que vendía sola a la pyme, terminó en US$3 M **[A]**.
- El «Tuya» de Bancolombia y Éxito **[NV: M]**. Cardlytics y Pacificard **[NV: sin fuente]**.

### 6.4 Por qué es difícil de copiar

El banco podría armar su propio programa, pero **no tiene la frecuencia por comercio ni la etapa del ciclo
de vida**, ni un grupo de control en comercios que no alcanza. El pitch local («la cooperativa de Cuenca
financia el consumo en los comercios de Cuenca») encaja con la identidad de JEP. Pichincha decide en Quito.

### 6.5 Riesgos y qué verificar

- **Regulación de dinero electrónico:** un saldo canjeable en muchos comercios se le parece. **[NV: sin
  fuente, verificar con abogado.]** Salida: que el saldo sea **del banco** y CheckPass solo lo muestre y lo
  mida.
- **LOPDP, art. 33:** pasarle al banco una lista de visitas es comunicar datos a un tercero y necesita
  consentimiento del titular. Diseño: el banco recibe **agregados**, o la lista va solo con consentimiento
  explícito del cliente.
- **Ciclo de venta** a un banco o cooperativa: meses.
- **Jardín Azuayo** también sería cuencana **[NV: sin fuente]**. **Mercado Pago no opera en Ecuador [NV:
  B]**. **Rappi en Cuenca: no confirmado [NV: M]**.

### 6.6 Experimento de una semana

- **Set-up, sin firmar nada:** 5 comercios, cartel «pagando con JEPFast o Deuna tu sello vale doble». Lo
  absorbe el comercio: un sello no cuesta plata.
- **Métricas:** % que paga con QR, y visitas contra la semana anterior y contra el grupo de control.
- **Decide** si hay un PDF con el que pedir la reunión en JEP. Variante «saldo cruzado»: US$1 para gastar
  en cualquiera de 4 locales vecinos, pagado por CheckPass con tope de US$100. Métrica: **% de redención en
  un local distinto del que lo dio**, y cuántos eran nuevos ahí.

---

## 7. Orden de construcción

El criterio: **primero lo que habilita todo lo demás y cuesta casi nada**; después lo que produce el número
que el comercio percibe; lo que necesita volumen o terceros, al final.

| Paso | Qué | Por qué va acá | Depende de |
|---|---|---|---|
| **0. Cimientos** | (a) **Etiquetar el canal** de cada entrega y cada canje (recibo, «Mis beneficios», pase silencioso, aviso, proximidad). (b) **Holdout en todo**, no solo en las campañas. (c) **Consentimiento de red** separado del de cada comercio, más «no me perfiles». (d) Rubros de salud fuera del perfil. (e) Las métricas que faltan (memberships por consumidor, columnas de escaneo y canje). | Sin (a) y (b) nada se puede medir. Sin (c) el perfil cruzado choca con los arts. 8 y 16.2 de la LOPDP. | Nada |
| **1. El mostrador** (§1) | Recibo de red post-escaneo con cupón cruzado por reglas; titular silencioso del pase por etapa. | Es la superficie donde se **entrega** todo lo demás. No tiene cupo, llega al iPhone sin PWA y separa escribir de avisar. | 0 |
| **2. Experimento de apertura** (§5.6) | Racha semanal de red + álbum en «Mis beneficios». | Mide la hipótesis más débil del sistema (que la gente abra la pantalla sola). Si falla, el peso se corre al recibo y al frente del pase. | 1 |
| **3. Cerebro, nivel segmento** (§2) | Reloj personal + «no regales a quien vuelve igual» + árbitro del cupo por uplift de segmento. Informe en plata v1. | Usa lo que ya existe (holdout, etapas, cupones). Da el primer número que el comercio percibe. | 0, 1 |
| **4. Llegar como conocido** (§3) | Progreso dotado para clientes de la red → referido cruzado → premio transferible → nivel de red. Al final, lookalike y «comercio del día». | El progreso dotado es casi gratis y tiene la mejor evidencia de campo. El lookalike necesita volumen. | 1, 3 |
| **5. Horas valle** (§4) | Franja valle sugerida para no-clientes; sellos ×2; bolsas de las 19 h. | Reusa la curva de escaneos, el recibo y la segmentación. | 1, 3 |
| **6. Aliado** (§6) | Experimento de doble sello con QR → reunión en JEP con el informe de lift. | Necesita 2–3 meses de lift medido para tener algo que vender. La **conversación** puede empezar antes. | 3 |
| **7. Resto del juego** (§5) | «Tu mes en Cuenca» (momento de consentimiento), rutas, Leyenda del local con alias. El **sorteo, solo tras el OK legal**. | Mejoran el hábito; ninguna habilita a otra pieza. «Tu mes» podría adelantarse si el consentimiento de red lo necesita. | 1, 3 |

---

## 8. Cómo encaja con lo que ya existe

| Ya existe | Qué le hace el sistema |
|---|---|
| **Sellos / puntos** | Se les suman tres atributos: **progreso dotado** (sellos iniciales por ser de la red), **multiplicador por franja** (×2 en valle) y **racha**. El saldo pasa a mostrarse en el recibo y en el frente del pase. |
| **Campañas por etapa** (te extrañamos / en riesgo / perdido, días por rubro; spec 0110 en espera) | Los días por rubro pasan a ser el **punto de partida** del reloj personal (múltiplos de la cadencia propia). La campaña deja de ser «un push» y pasa a ser **una entrega** en «Mis beneficios» con un aviso opcional que decide el árbitro. |
| **Cupones** (tipados: costo, descuento, producto) | Se vuelven los **«brazos»** que el cerebro sortea (sin cupón / % / producto gratis). El cupón cruzado, el de bienvenida y el de franja valle son cupones con una regla de elegibilidad nueva: **solo no-clientes**. |
| **Proximidad del pase** (ADR 0065, ~100 m) | Sigue siendo el canal gratis a pie. La idea loca (§10) es elegir sus hasta 10 ubicaciones por cliente. |
| **Grupo de control** (ADR 0066) | Es **el activo central**. Convierte segmentación en aprendizaje causal, da el informe en plata, da el pitch al aliado y es la única prueba independiente de clientes incrementales, que el informe de redes dice que **nadie publicó**. |
| **«Mis beneficios»** como inicio de la PWA (owner) | Es la pantalla del juego (§5) y la bandeja donde todo se **entrega**. |
| **Filtro de 2 km y rubro no competidor** (owner) | Es la regla dura del recibo, del álbum y del cerebro. El cerebro **tampoco aprende entre competidores** del mismo `category_gcid`. |

---

## 9. Qué se descarta y por qué

| Descartado | Por qué | Fuente |
|---|---|---|
| **SMS como canal de campañas** | ~US$0,05 por SMS [NV: B]. A 1.000 clientes × 4 SMS/mes ≈ US$200/mes, más de lo que paga una red chica. Solo como último peldaño o pagado por resultado. | canales |
| **RCS for Business** | Los proveedores lo listan como **no disponible en Ecuador** [NV: M]. Se vuelve a mirar si aparecen Claro o Movistar Ecuador. | canales |
| **App Clips** | **Exigen app nativa** [A]. El equivalente sin app es QR/NFC → PWA (§1). | canales |
| **Apple Messages for Business** | Lo inicia el cliente y exige un proveedor aprobado. Sirve para atención, no para campañas [A]. | canales |
| **WhatsApp como canal de la plataforma** | Descartado por el owner. (El compartir **del cliente** es una pregunta abierta, §3.5.) | red-y-atencion |
| **Marketing por aviso de Wallet en iPhone** | Apple: «Never use a change message for marketing» [A]. En iPhone, el marketing va por Web Push o en silencio. | red-y-atencion §6b |
| **Descuento tipo Groupon** (a cualquiera, a cualquier hora) | Solo ~20 % vuelve a precio completo; 26,6 % de los negocios perdió plata [A]. | capacidad |
| **Moneda local propia** (Bristol Pound, Banco Palmas) | Bristol cerró cuando se cortó el subsidio [NV: M]. Hay canibalización entre socios (Dorotic) y posible regulación de dinero electrónico [NV: sin fuente]. Si hay saldo de red, **lo emite el aliado** (§6). | social, pagos |
| **Personalización individual por RL en el piloto** | No hay volumen. Primero segmentos con encogimiento estadístico. | perfil |
| **Ofertas con tarjeta de crédito (Diners, Pacificard) como prioridad** | Ticket chico y costo de tarjeta de 2,5–4,5 % [NV: M]. Queda en una llamada para averiguar, no en producto. | pagos |
| **Feed social con nombres** («Juan canjeó en…») | Privacidad y LOPDP. Solo agregados y arriba de un umbral. | social |
| **«Faro» en un mapa en tiempo real** (por ahora) | Necesita masa crítica mirando el mapa, y la novedad decae (lección de Pokémon GO) [NV: M]. Se retoma cuando haya volumen. | juegos |
| **«Mesa completa»** (grupos estilo Pinduoduo) y **«Parche»** (rachas de a dos) | Adopción baja del vínculo y riesgo de fracaso público si no se completa el grupo. Diferidos, no muertos. | social, juegos |
| **Newsletter de ciudad escrito a mano** | Necesita una persona produciendo. Solo la versión generada a partir de lo que cargan los comercios, con revisión. | industrias |

---

## 10. Ideas locas que vale la pena discutir

1. **Cobrar por cliente nuevo INCREMENTAL, verificado contra control** (perfil §6, juegos §7). US$10 base,
   más US$X **solo** por cada cliente nuevo que vino por la red **y que no habría venido** (medido contra el
   grupo que no vio la bienvenida). Resuelve de raíz «¿por qué pagar?»: pagás si funciona.
   - Precedentes: Belly cobraba ~US$5–7 por cliente, **sin probar** que era incremental (confianza media);
     Niantic cobraba < US$0,50 por visita única diaria [A/M].
   - Riesgos: con poco volumen la factura se discute, y monetizar el perfil sube la exigencia de la LOPDP.
2. **«Pase Cuenca»: el consumidor financia la red** (capacidad §5). US$5–8/mes por un café por día hábil
   en franja valle en cualquier café de la red, con tope por local. **La red le paga a cada comercio** su
   piso por canje (por ejemplo US$0,80 por un café de US$1,50, ilustrativo). El comercio deja de pagar por
   un software y **cobra** por el cliente que le llega en su hora muerta.
   - Aritmética de la nota: 1.000 suscriptores × US$6 ≈ lo que pagarían 600 comercios a US$10.
   - Riesgos: cobrar sin medio de pago propio y los usuarios intensivos (la lección de ClassPass [NV: B]).
   - Se prueba regalando 50 pases con ~US$150 de la red.
3. **Las 10 ubicaciones del pase como radar de descubrimiento** (canales). Un pase de Apple admite hasta 10
   ubicaciones [NV: M]. Se elegirían **por cliente y por día**: 5 de sus comercios en riesgo + 5 que **no
   conoce**, en su recorrido habitual. La pantalla bloqueada sería captación sin gastar un aviso.
   - A verificar: si Apple penaliza reescribirlas seguido, si iOS 17+ muestra la sugerencia igual (Apple la
     volvió más pasiva) y qué hace Google Wallet con las geovallas.
4. **«Cita a ciegas con un comercio»** (industrias). Una vez por semana: «algo dulce, a 600 m, vale US$3».
   Si acepta, se revela el comercio y tiene 48 h. Si no lo usa, el sábado ve cuál era («te perdiste el
   alfajor de X»): el arrepentimiento de la lotería de Volpp [NV: M/B]. El comercio paga por cita
   concretada, es decir por escaneo. **Tiene azar → mismo freno legal que el sorteo.**
5. **Copa de Barrios** (juegos, Ingress [NV: M]). Cada escaneo suma al barrio del comercio; el barrio
   ganador tiene su «feria» y aparece primero en la web pública. Busca **cooperación entre comercios
   vecinos**, que la literatura dice que no ocurre sola. Puede no importarle a nadie; experimento: 2
   barrios, 1 mes, con un cartel.
6. **El sobre de las fiestas de Cuenca** (social, WeChat [NV: M]). En noviembre, un sobre grupal donde cada
   amigo se lleva un premio **al azar** de un comercio distinto. Es captación masiva en fecha propia de la
   ciudad. Azar → freno legal.
7. **El pase como tarjeta del Tranvía + monedero JEP** (pagos). Cada viaje sería un contacto diario («bajaste
   en la parada X: a 100 m tenés tu café 9/10»). Choca con permisos, con el integrador del tranvía y con la
   regulación, pero convierte el pase en infraestructura de la ciudad.
8. **«Cuenca pendiente»** (social, café sospeso [NV: M]). Los sellos que se van a vencer se donan al café
   pendiente del comercio. Es la única idea que **no es un descuento**, le da a la red un relato de barrio
   y aprovecha un pasivo que hoy se pierde.

---

## 11. Lo que hay que medir o verificar antes de decidir

**Datos propios** (en una rama de Neon, nunca contra `DATABASE_URL`):

1. Fracción de consumidores con ≥ 3 memberships y ≥ 2 rubros. Decide si existe el nivel «persona» del
   cerebro y si el lookalike tiene universo.
2. Volumen de campañas ya corridas con holdout.
3. Correlación de «responde a cupón» de una misma persona entre comercios (la hipótesis del owner).
4. Columnas exactas de escaneo y canje (no verificadas por ninguna nota).
5. **Si alguien abre la vista web después del escaneo** (§1.6) y **si abre «Mis beneficios» sin aviso**
   (§5.6).

**Legal y plataformas:**

6. **Sorteos promocionales en Ecuador:** requisitos, autorización, «sin obligación de compra». **Sin
   fuente.**
7. **LOPDP:** el diseño del consentimiento de red y del «no me perfiles», con un abogado. Art. 20
   (descuentos distintos por persona) y art. 33 (listas al aliado).
8. **Google Wallet:** consultar la zona gris del pase que promociona a otro comercio.
9. **Apple:** si estrangula las actualizaciones silenciosas frecuentes y cómo se comporta la sugerencia de
   la pantalla bloqueada en iOS 17+. **Probar en un teléfono.**
10. **Dinero electrónico:** si un saldo de red emitido por un aliado evita la licencia. Con abogado.
11. Si el aviso de vencimiento de un **pase de oferta** de Google consume el mismo cupo de 3 que el pase de
    fidelidad («probablemente otro cupo», a medir).

**Cifras a re-verificar antes de citarlas a un aliado o en una spec:** Kroger 70 %, Nunes y Drèze 34/19
(confirmar con el PDF), Taiwán +75 %, Portugal +36,3 %, las cifras de Block (10 % / 50 %), el tamaño de
Deuna, Claro Club en Ecuador, Showcases de Apple Maps en Ecuador, precio del SMS.

---

## 12. Las cifras que más pesan en las decisiones

| Cifra | Qué decide | Confianza |
|---|---|---|
| Google Wallet: **3 avisos con notificación por pase cada 24 h**, y el pase es uno para toda la red | Que el producto sea entrega + mostrador y no avisos | **[A]** (doc oficial, `red-y-atencion.md` §1) |
| Groupon: **~20 %** volvió a precio completo; **26,6 %** de los negocios perdió plata | Solo no-clientes, solo en valle, medir la segunda visita | **[A]** (Dholakia; Wharton) |
| Nota Fiscal Paulista: **+≥ 21 %** de ventas declaradas en 4 años por la lotería | Que el sorteo por escaneo valga la consulta legal | **[A]** (Naritomi, *AER* 2019) |
| Progreso dotado: **34 % vs 19 %** de tarjetas completadas | Sellos iniciales por ser de la red | Paper **[A]**; cifras **[NV: M]** |
| Block Neighborhoods: seguidores **~10 %** del volumen, **50 %** más frecuentes | Que una red de comercios chicos con saldo común mueve volumen | Mecanismo **[A]**; cifras **[NV: M, auto-reportadas, sin control]** |
| Deuna: **0 %** de comisión en QR presencial | No competir por comisión; ser la capa de fidelización sobre el QR de otro | **[A]** |
| Nubank: **~90 %** de clientes orgánicos o por referido **no pagado**; CAC US$4,95 | El referido lo causa el producto; el premio solo acelera | **[A]** (F-1, SEC) |
| ClassPass: **94 %** de los usuarios son nuevos para el estudio | Que la capacidad ociosa es un canal de captación | **[V]**, confianza **M** (auto-reportado) |
| Café: **~8–10** cafés extra por mes pagan los US$10 | El umbral del informe en plata | **[NV: [M], estimado sin fuente]** |
| Duolingo: racha de 7 días → **3,6×** de terminar | Racha de red | **[A]** que lo publican; **correlacional** |

# La red y la atencion compartida del cliente — planteo en curso

> **Estado: BORRADOR DE ESTRATEGIA, nada decidido salvo lo marcado «owner».** Es el insumo del ADR que
> va a reemplazar el «un push por campaña» del motor de marketing. Abierto el 2026-09-29. Lo marcado
> *(orquestador)* es una propuesta para discutir, no una decision. Las fuentes externas estan en
> `reports/Redes de comercios y atención compartida.md` y sus notas en `research_notes/`.

## 1. El problema

CheckPass es una RED: el cliente tiene **un solo pase** para todos los comercios (ADR 0031/0033). Esa es la
gracia (se suma a otro comercio sin cargar otro pase), y tambien el limite:

- **Un pase por cliente y por proveedor**, con un unico campo «Ultima novedad» compartido: el ultimo comercio
  que escribe pisa al anterior (`schema/consumer.ts:40-45`, `:102`). Entre comercios, el unico freno hoy es
  un cooldown de 3 minutos (`wallet/push.ts:21-24`).
- **Google Wallet: 3 avisos con notificacion por pase cada 24 h**; el cuarto responde `QuotaExceededException`
  (documentacion oficial, leida el 2026-09-29). Como el pase es uno, **el cupo es de toda la red**, y hoy cada
  «+1 sello» gasta uno (`wallet/google-object.ts:147-164`: `TEXT_AND_NOTIFY`).
- **Apple no publica un tope numerico**; su guia pide mensajes de cambio solo para lo urgente, y hay reportes
  de limitacion no documentada.
- **Cuenta del owner (2026-09-29):** un cliente en 20 comercios que lanzan campañas genera mas avisos de los
  que salen (3/dia): la cola crece mas rapido de lo que se vacia. **Conclusion del owner: el push del pase
  compartido, solo, no justifica que un comercio pague.**

## 2. El giro: entregar no es avisar (owner acepto el rumbo)

- **ENTREGAR = sin tope.** Toda campaña de todo comercio cae en **«Mis beneficios»**, la cuenta del cliente.
  Owner: «"mis beneficios" seria la pantalla inicial [de la PWA], no el QR con el pase». El pase ya enlaza a
  la vista del cliente (`wallet/apple.ts:101-103`, `wallet/google-object.ts:112` → `/c/[webViewToken]`).
- **AVISAR = escaso.** El push deja de ser «un aviso por campaña».
- **Filtro de lo que se ve (owner, 2026-09-29):**
  - rubro NO competidor = distinto `category_gcid` que el comercio de referencia («mismo rubro exacto»);
  - cercania: **radio de 2 km**;
  - desde donde: **GPS del telefono**; si niega el permiso, el ultimo local donde escaneo;
  - **«Todo filtrado»**: tambien los beneficios de comercios donde ya es miembro.
  - *Efecto sin acordar:* el «te extrañamos» del Cafe A no se ve si el cliente esta a > 2 km o escanea en otro cafe.

## 3. Los 3 avisos diarios (idea del owner, «quizas», a pensar mas)

- 1 = **timbre general** («visita tus beneficios») para que abra su cuenta.
- 2 restantes = no desperdiciarlos: **«te extrañamos»** (recurrencia), con un ORDEN entre los comercios que
  compiten, y «nisiquiera conviene que salgan dos te extraño el mismo dia».
- Idea: si el consumidor esta en el radio de 2 km del comercio, recibe su «te extrañamos».

**Borrador del orquestador (para discutir):**
- Presupuesto por pase y por dia: 1 timbre + 1 aviso dirigido + 1 reserva para lo que vence hoy.
- **El escaneo como disparador**: es el unico momento en que sabemos donde esta el cliente sin GPS (el local
  donde escaneo). Tras un escaneo, compiten los comercios donde es miembro y esta en etapa de reactivacion,
  a ≤ 2 km de ese local y de otro rubro. Orden: al que hace mas tiempo no le toca (rotacion) → el mas cercano
  → el de mejor rendimiento (lift del ADR 0066).
- Lo que no sale como aviso sigue en «Mis beneficios»: el aviso es un empujon, no la entrega.
- Canal que ya existe y no gasta avisos: la **proximidad** del pase (ADR 0065, radio ~100 m, pantalla de
  bloqueo; Apple la llama pasiva). Dos capas: proximidad a pie, aviso tras un escaneo en la zona.

**Preguntas abiertas (el owner: «no tengo idea» → investigar):** ¿priorizar al cliente mas cerca de perderse o
al mas facil de recuperar? ¿el aviso dirigido va tras el primer escaneo del dia o se guarda? ¿tocar un aviso de
Wallet abre el pase o la PWA? (probar en un telefono).

## 4. Captar clientes nuevos

- **Cupon cruzado en el escaneo** (owner, ya pensado): el Cafe A escanea y el cliente recibe un cupon del
  Gym B. Sin pago entre comercios: el valor es que el comercio lo perciba. Viaja en el escaneo, no gasta avisos.
- **Rutas en la web publica** (owner, ya pensado): rutas con descuentos y beneficios exclusivos.
- Evidencia externa: Fivestars/SumUp muestran al comercio en la pantalla de cobro de comercios vecinos (SumUp,
  oficial: «Your business pops up on customer screens at nearby spots»); Belly cobraba por cliente nuevo desde
  la red (Belly Bites, TechCrunch 2013); en coaliciones, la canibalizacion entre socios supera a la sinergia,
  salvo entre socios chicos no competidores (Dorotic et al., JAMS 2021). **Nadie probo de forma independiente
  que una red traiga clientes incrementales**: nuestro grupo de control puede ser el diferencial.

## 5. Estrategia comercial (owner, 2026-09-29)

- El paso de hoy es **entrar y establecerse como red**: el beneficio tiene que ser claro — atraer clientes
  nuevos o vender mas sobre la base existente.
- Precio: **$10 por comerciante** seria aceptable (vs $20: «en Cuenca es mucho»).
- A mediano plazo, si la red se consolida: **medios de pago propios** con comisiones bajas y **delivery** tipo
  Rappi/Uber con costos bajos y mejor reparto para los repartidores.
- Descartado por ahora: WhatsApp. Ya previsto: el informe «en plata» dentro de estadisticas.

## 6. Investigaciones

- Hechas: `research_notes/ciclo-de-vida-por-rubro/CONSOLIDADO.md` (dias por rubro) y
  `reports/Redes de comercios y atención compartida.md` (Fivestars/SumUp, Belly, coaliciones, marketplaces,
  pago por resultado, promocion cruzada).
- Pedidas por el owner (2026-09-29): industrias paralelas; cruzar la tabla de visitas por rubro; **tecnologia
  web** que se pueda usar dado el limite («queremos construir un canal que le permita a los pequeños/medianos
  comercios crecer, conseguir nuevos clientes»).

## 7. Que queda en espera

La **spec 0110** (etapas por rubro) no se implementa hasta el ADR de este modelo: su calendario pasaria a
decidir que entra a «Mis beneficios» y cuando, no cuantos push salen.

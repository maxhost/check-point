---
spec: 0098
fecha: 2026-09-25
actualizada: 2026-09-26
estado: cerrada
resumen: Unificar la consulta, edición y cierre de fidelización con el sistema del wizard merchant, conservando modalidades, pasos, contratos y reglas del programa.
disjunta: no
archivos: apps/merchant/src/app/backoffice/loyalty/, apps/merchant/src/app/backoffice/backoffice-navigation.tsx, apps/merchant/src/ui/, apps/merchant/src/app/globals.css, docs/design-system.md, tests/e2e/loyalty-design-system.spec.ts
---

# 0098 — Loyalty usa el sistema de diseño del backoffice

Pedido del owner: analizar `/backoffice/loyalty`, compararla con el sistema que se aplica
en las otras pantallas y preparar el spec antes de implementar. Referencia explícita:
inputs, labels y placeholders del wizard de creación de merchant.

Diseño aprobado para implementar después de `/clear` el 2026-09-26. El owner indicó:
«ok, si estas listo podemos hacer clear y regresas para implementar el spec 0098».
Referencia de decisión: [ADR 0089](../adr/0089-loyalty-reutiliza-el-sistema-del-wizard-merchant.md).

Revisión del 2026-09-26 a pedido del owner: lectura completa de los contratos
[0079](0079-contratos-de-api.md) y [0086](0086-contratos-de-api.md). El 0079 §2–3
rige cuerpo y éxito del PUT; el 0086 §1–2/6–8 actualiza permisos y rechazos del guard.
Se corrige la exclusión inicial de staff: el acceso delegado ya es una decisión
vigente del ADR 0079, no un cambio de producto pendiente.

## Problema y evidencia

Diagnóstico del árbol local el 2026-09-25. El intento de abrir la URL con la herramienta web
falló; no se inspeccionó una sesión autenticada de producción ni se confirmó su SHA.
Las diferencias de markup y CSS están verificadas por lectura; el aspecto renderizado
actual y final deberá contrastarse en navegador durante la implementación.

| Superficie | Tenemos hoy, con evidencia | Deberíamos tener |
| --- | --- | --- |
| Nombres y objetivo | `steps/step-units.tsx:7`, `step-stamp-basics.tsx:7`: labels e inputs nativos | `TextField` y `NumberField` del wizard; ayuda y error asociados |
| Acumulación | `steps/accrual-fields.tsx:38`: chips con radios ocultos y números nativos | Elección accesible, enteros con stepper y monto decimal con moneda explícita |
| Premios | `steps/step-rewards.tsx:33`, `:64`, `:120`: chips, select nativo, costo y ayuda manuales | Opciones, `SelectField`, `NumberField`, descripción y acciones del catálogo |
| Términos | `steps/step-terms.tsx:25`, `ui.tsx:45`: textarea propio con autoaltura | Campo multilínea con la misma anatomía de label, valor, ayuda, error y foco |
| Diseño de tarjeta | `steps/step-card-design.tsx:35`: colores, checkbox, rango y archivo con controles heredados | Controles consistentes, carga con botones reconocibles y vista previa conservada |
| Progreso y acciones | `program-editor.tsx:123`, `:136`: contador textual y `.button` | `ProgressIndicator`, título del paso, foco al avanzar y `Button` |
| Consulta del programa | `program-view.tsx:17`: modalidad, editar/cerrar y términos | Resumen de mecánica, meta/unidades, premios, opción avanzada y tarjeta de sellos guardados |
| Cierre | `program-closing.tsx:22`, `loyalty-page.tsx:88`: fechas nativas y confirmaciones heredadas | Fechas con anatomía del sistema, zona horaria visible y diálogo coherente |
| Carga fallida | `use-loyalty-program.ts:73–93` guarda el error en toast; `loyalty-page.tsx:38` retorna skeleton antes de montarlo | Estado de error persistente y reintento de lectura visible |
| Color y geometría | `globals.css:389–417`, `:1698–1889`, `:3509–3595`: valores literales, labels de 14 px y estilos propios | Tokens semánticos; labels/valores de 16 px y controles de 48 px como el wizard |

La referencia ejecutable es `business/onboarding/_components/business-step.tsx:92`
y `program-step.tsx:147`, bajo `app/[locale]/(merchant)/`: formularios `grid gap-5`,
`description`, `errorMessage`, placeholders explícitos y estado de submit.
La anatomía vive en `src/ui/{text-field,number-field,select-field,button}.tsx`.
Marca ya usa esos campos en `brand-identity.tsx` y `regional-fields.tsx`; Catálogo en
sus filtros (spec 0095). No copiar controles propios de esas pantallas cuando exista
un equivalente en `src/ui`.

## Alcance

**Entra:** todas las vistas de esta ruta: carga/error, creación, edición, revisión,
programa activo, programa en cierre, formulario de fechas y sus tres confirmaciones.
Reutilizar componentes y completar las piezas de formulario que faltan en el catálogo.
Validación visible, navegación con teclado, responsive y estados asíncronos forman parte
de la adaptación. La consulta usa los datos ya disponibles, sin métricas nuevas.
Adaptar página y navegación al permiso `loyalty`, con consulta/creación/edición para
staff autorizado y cierre/cancelación de cierre exclusivamente para owner.

**No entra:** nuevos tours o ayudas, cambios de mecánica/premios/cálculos económicos,
plantillas o interpretación legal de términos, Wallet/consumer, backend, migraciones,
rediseño del shell, modificación del wizard de alta o migración del resto del backoffice.
No se modifican permisos del servidor ni se introduce granularidad CRUD. El gate actual
`requireOwner()` de la página (`page.tsx:8`) es una falta de adaptación al 0086;
corregirlo consume la autorización existente, sin ampliar capacidades del backend.

## Diseño

### Composición y jerarquía

- Conservar `merchant-shell`, navegación y `ModuleHeader`, con el patrón de las pantallas
  actuales. Usar título «Tu programa de fidelización» en consulta; estado «Activo» o
  «En cierre» como texto visible. Editor: «Editá tu programa» / «Creá tu programa».
  Cierre: «Programá el cierre». Copy nuevo en el voseo utilizado por el wizard.
- Secciones con título, descripción breve y superficie/borde del sistema, usando los
  roles de `brand-section` como referencia. CSS nuevo acotado a Loyalty; radios, sombra
  y colores desde tokens. Una acción primaria por vista, secundarios junto a ella.
- Formularios simples limitados a `--content-form` (34 rem), sin centrado que rompa la
  alineación con el encabezado. Separación de 20 px entre campos y 24 px entre bloques;
  6 px entre label/control/ayuda como los componentes existentes. Panel: 16 px móvil,
  24 px escritorio. Diseño de tarjeta admite dos columnas desde 768 px, con controles
  y preview; por debajo, una columna y preview en el flujo.
- Consulta activa: resumen con modalidad, regla de acumulación y moneda, meta o nombres
  de unidad, lista de premios y estado de canje sin saldo suficiente. Sellos incluye
  `CardPreview` con el diseño persistido; puntos usa resumen textual, sin tarjeta inventada.
  Términos en sección legible con saltos de línea conservados. «Editar programa» primaria;
  «Cerrar programa» secundaria discreta sólo para owner. En cierre: fechas/zona horaria;
  «Cancelar cierre» sólo para owner. Staff ve el estado sin controles de cierre;
  edición indisponible para ambos roles durante cierre, como hoy.
- Footer del editor dentro del flujo: Atrás secundaria, Continuar primaria; último paso
  «Activar programa» / «Guardar cambios». En móvil, acciones con ancho completo y espacio
  sobre la navegación inferior. No añadir otro footer fijo. El checklist flotante debe
  poder colapsarse y no impedir la acción ni la lectura.

### Componentes y campos

Reutilizar `TextField`, `NumberField`, `SelectField`, `Button`, `Alert` y
`ProgressIndicator` desde `src/ui/index.ts`. No reconstruirlos en `globals.css`.

| Campo / acción | Componente y contenido propuestos |
| --- | --- |
| Nombre singular / plural | `TextField`, placeholders «Ej.: Punto» / «Ej.: Puntos»; descripción del nombre que verá el cliente |
| Nombre del sello | `TextField`, «Ej.: Sello» |
| Meta | `NumberField`, «Sellos para completar», min 2 / max 50 / step 1; ayuda «Elegí entre 2 y 50 sellos.» |
| Cantidad otorgada / costo en puntos | `NumberField`, entero positivo, step 1; costo explicado mediante `description` con la equivalencia actual |
| Monto por bloque | `TextField` con `inputMode="decimal"`, «Monto por bloque», «Ej.: 5,00», descripción «Moneda: {currencyCode}.»; se conserva como string durante edición |
| Producto del premio | `SelectField`, «Producto», placeholder «Elegí un producto»; opciones con nombre/precio actuales, selección por id |
| Premio libre | `TextField`, «Nombre del premio», «Ej.: Café gratis» |
| Descuento | `NumberField`, «Porcentaje de descuento», 1–100 / step 1; ayuda que explicita % |
| Texto de términos | Nuevo `TextAreaField`, «Texto de términos», «Escribí los términos o insertá una plantilla»; autoaltura, mínimo 160 px |
| Modalidad / acumulación / tipo de premio | Nuevo `ChoiceGroup` controlado; tarjetas para Puntos/Sellos, opciones compactas para Por monto/Por compra y tipos de premio |
| Degradé / canje sin saldo suficiente | Nuevo `CheckboxField`, label y descripción asociados, área clicable mínima 44 px |
| Plantillas, agregar/quitar premio, elegir/quitar sello y cámara | `Button`: secondary/quiet para auxiliares, danger para quitar; iconos Iconoir con texto |
| Fechas de cierre | Adaptador local `ClosingDateField` con input nativo `datetime-local`, label/description/error asociados y la misma geometría/tokens; conservar string local sin conversión a timezone del dispositivo |

Nuevas piezas neutrales: `TextAreaField` compone `TextField`/`Label`/`TextArea`/`Text`/
`FieldError` de React Aria y acepta `label`, `description`, `errorMessage`, `placeholder`,
`value`, `onChange`, `isRequired`, `isDisabled`, `isInvalid`, `autoGrow` y `className`.
`ChoiceGroup` usa `RadioGroup`/`Radio`, con `options: {value,label,description?}[]`,
`value`, `onChange`, `label`, `description`, `errorMessage`, `isDisabled`, `isRequired`,
`isInvalid`, variante `cards | compact`. `CheckboxField` usa `Checkbox` de React Aria,
con `isSelected`, `onChange`, `label`, `description`, `isDisabled` y `className`.
Se documentan antes de exportarlos. No contienen reglas ni requests de Loyalty.

`ClosingDateField` es excepción especializada: `TextField` actual no ofrece una API de
fecha/hora; no forzar casts ni introducir un datepicker que cambie la semántica de las
fechas. Etiqueta de 16 px bold, ayuda de 14 px, altura ≥48 px, borde/foco del catálogo;
`id`/`htmlFor`, `aria-describedby`, `aria-invalid`. Picker nativo conservado.

Colores: mantener picker nativo y mostrar código hexadecimal junto a su muestra dentro
de un control compuesto local con label/foco del sistema. No sumar edición HEX nueva.
Rango de ángulo: `Slider` de React Aria, label «Dirección del degradé», valor en grados,
0–360 / step 15; presets actuales como `Button` con `aria-pressed` (ninguno activo
cuando el ángulo sea intermedio). Checkbox controla el segundo color conservando su
borrador. Los colores del comercio afectan solamente la tarjeta, no errores ni campos.

Sello: archivo nativo oculto con nombre accesible, botones «Elegir sello» / «Cambiar
sello», «Tomar foto» en touch y «Quitar». Descripción desde constantes de formatos;
5 MB y comportamiento de recorte/fallback actuales. Cropper diferido conservado; no
se rediseña su interior compartido. El picker y la cámara no suben ni guardan por sí solos.

### Pasos y validación

Conservar las secuencias de `stepsFor`:

- Puntos, creación: Modalidad → Unidades → Términos → Premios → Revisión.
- Sellos, creación: Modalidad → Sello y objetivo → Diseño → Términos → Premios → Revisión.
- Edición: misma secuencia sin Modalidad; tipo fijo. Cambiar modalidad en creación
  recalcula progreso usando la misma lista del contenido, sin reiniciar otros campos.

`ProgressIndicator` recibe esa lista y gana `ariaLabel` opcional, default actual
«Progreso del alta», con «Progreso del programa» en Loyalty. No convierte pasos en links.
Al avanzar/volver, foco en título del paso (`tabIndex=-1`). Volver conserva borrador.

`Form` de React Aria por paso: Continuar valida al submit y enfoca el primer campo
inválido. No dejar una acción gris sin explicar qué falta. Errores por campo a través
de `errorMessage`; se actualizan al corregir tras primer intento. Revisión valida el
borrador completo antes de escribir y vuelve al primer paso inválido. Mensajes:
«Completá este nombre», «Elegí un entero entre 2 y 50», «Ingresá un entero mayor que 0»,
«Ingresá un monto mayor que 0», «Elegí un producto», «Escribí el nombre del premio»,
«Elegí un porcentaje entre 1 y 100», «Agregá al menos una cláusula de términos».

No convertir vacío/NaN en 0 o en un default al renderizar `NumberField`; campo vacío
permanece inválido hasta completarse. Dinero acepta coma o punto decimal, normaliza a
punto sólo al construir el payload, finito >0 y ≤9.999.999.999,99. El ejemplo y las
equivalencias usan el mismo parser sin modificar el string que se está escribiendo.
No imponer un nuevo rechazo por cantidad de decimales: el backend actual redondea a dos
(`accrual.ts`).
Puntos: 1–20 premios; Sellos: exactamente uno, sin costo en puntos. Agregar se bloquea
en 20 con ayuda visible; Quitar no elimina el último. Selección de producto conserva
`selectProduct` y su sugerencia de costo. No cambiar fórmulas de `format.ts`/StepReview.
`AdvancedRedeem` mantiene default false y su explicación completa.

Términos conserva inserción aditiva y texto libre; no reinterpreta variables/plantillas
ni sustituye automáticamente lo escrito. Ejemplo de acumulación sigue actualizándose;
revisión conserva premios, valor estimado y términos. Alertas semánticas para advertencias,
sin presentar estimaciones como datos reales nuevos.

### Estados, persistencia y confirmaciones

- Carga inicial: `SkeletonScreen`/`Skeleton`, geometría próxima al contenido y un anuncio
  de carga. Error de programa o plantillas: `Alert` persistente y «Reintentar» de sólo
  lectura; no quedarse con skeleton perpetuo ni montar editor con contexto parcial.
- Catálogo: consultar sólo si la sesión tiene `catalog`; `loyalty` no concede ese permiso.
  Sin `catalog`, explicar «No tenés permiso para consultar el catálogo», ofrecer premio
  libre/descuento y conservar cualquier premio de producto ya guardado por snapshot/id,
  sin intentar cambiar su producto ni exigir acceso adicional para editar otros campos.
  Con permiso, distinguir loading, vacío y error. Error permite reintentar sólo catálogo,
  conserva todos los premios y permite premio libre/descuento. No presentar un fallo
  como «No hay productos». Producto guardado ausente en catálogo permanece visible por
  su snapshot/id; no borrarlo ni seleccionar el primero automáticamente.
- Guardado: bloquear campos, navegación, salida destructiva y acciones de carga mientras
  está en vuelo; `Button isLoading`. Bloquear Continuar desde Diseño y Guardar durante
  preparación/recorte del sello, con explicación visible. Guardas sincrónicas para impedir
  requests duplicados. Elegir/quitar/cancelar/reset invalidan resultados viejos de imagen
  y liberan object URLs; un probe tardío no restaura una selección descartada.
- Error de escritura: `Alert` persistente en la vista correspondiente, conservar borrador
  y selección. Reintento explícito. `401/403` muestra acceso y bloquea writes mientras
  siga el rechazo; `email_not_verified` del owner ofrece verificar y luego reintentar
  mediante acción explícita, sin descartar borrador ni enviar PUT automáticamente.
  `409` muestra conflicto/estado rechazado sin deducir su causa por texto. No añadir
  autosave ni writes en cambios de paso, desmontaje o temporizadores.
- PUT confirma mediante `{programId,created}`; después GET obtiene el DTO. DELETE/PATCH
  confirman `{ok:true}` y refrescan por GET. Error de ese GET no convierte la escritura
  confirmada en fallida: informar «Se guardó el cambio, pero no pudimos actualizar la
  vista» y ofrecer sólo refrescar. Un body inválido o fallo de red de la escritura
  comunica resultado no confirmado; ofrecer consultar por GET antes de repetir.
  No descartar automáticamente el borrador ante esa consulta ni anunciar éxito por
  comparar sólo valores locales. No suponer que PUT devuelve un DTO como en Marca.
- Confirmaciones locales con `ModalOverlay`/`Modal`/`Dialog` de React Aria y `Button`,
  nombre/description, Escape, foco inicial en Cancelar y retorno al activador. Tres casos
  actuales: descartar, programar cierre, cancelar cierre. No modificar estilos globales
  de `ConfirmDialog`, que usa el resto del backoffice. Descartar explica pérdida también
  en creación; confirmar salir regresa al resumen si existe programa y al backoffice
  si era creación. Cancelar diálogo conserva borrador.
- Cierre mantiene inputs locales interpretados por el servidor en `business.timezone`;
  mostrar zona en ambas ayudas y resumen. Requerir fechas válidas y canje posterior a
  fin de acumulación; backend sigue verificando fin de acumulación futuro (`time.ts:84`).
  Confirmación enumera ambas fechas y la imposibilidad de editar durante cierre.

### Contratos y responsabilidades

UI/cliente HTTP local: Codex. API, guards, dominio y persistencia existentes: fuera del
diff. Sin `businessId`, roles ni permisos enviados desde el navegador. Consumir origen
relativo y cookie actual; DTOs sin claves de R2.

**Capacidades y acceso (0086):** usar la sesión del merchant, con membership activa,
role y permissions normalizados; owner recibe los siete permisos. En el adaptador de
`page.tsx`, reutilizar `requireBackofficeSession()` como Marca, exigir
`membership.permissions.includes("loyalty")`, redirigir a `/backoffice` si falta y
pasar `isOwner` y `canReadCatalog` al cliente. Son props de presentación, nunca campos
del request. En navegador, si se necesita renovar capacidades, usar únicamente
`GET /api/merchant/session` (siempre 200; inspeccionar authenticated/membership/status),
sin sondear endpoints para deducir permisos. No agregar un GET duplicado al montar si
el adaptador ya entregó las capacidades.

Publicar Loyalty en navegación delegada sólo con `loyalty`, tanto móvil como escritorio;
owner conserva su destino en Fidelización, sin duplicarlo en Mi negocio. Staff utiliza
la lista delegada actual. La incorporación debe conservar accesibilidad desde 320 px
con todos los permisos existentes, sin desbordar la barra inferior; si necesita menú
para esa lista, acotarlo a su presentación. Sin `loyalty` no hay enlace ni acceso directo.
La UI y los handlers de cierre/cancelación verifican `isOwner`; `loyalty` nunca los
habilita y una revocación posterior sigue siendo rechazada por el servidor.

| Request existente | Uso / respuesta |
| --- | --- |
| `GET /api/loyalty-program` | `{business,program}`; program nullable, moneda/zona/paleta y configuración/premios/diseño/cierre ya disponibles |
| `GET /api/loyalty-terms/templates` | `{templates}` para inserción existente |
| `GET /api/catalog` | Productos para selección y costo sugerido |
| `PUT /api/loyalty-program` | Mismo cuerpo completo actual: kind, configuration, clauses, stampAction, stampUploadId/stampCropped si replace, cardDesign sólo sellos, accrual, rewards, redeemAllowInsufficient; 201/200 `{programId,created}` |
| `POST /api/loyalty-program/stamp-upload` y PUT a URL firmada | Preparar/subir al guardar; conservar metadata y validaciones existentes, sin inventar endpoints |
| `DELETE /api/loyalty-program` | `{earningEndsAt,redemptionEndsAt}` → `{ok:true}` |
| `PATCH /api/loyalty-program` | `{action:"cancel-close"}` → `{ok:true}` |

**PUT corto/completo (0079 §2–3):** el endpoint admite ambos; este editor avanzado
envía el completo para conservar las decisiones explícitas y todos los valores editados.
No reutilizar el cuerpo corto de alta para actualizar un programa existente, porque
omitir campos puede aplicar defaults en lugar de preservar datos. `PUT` no es PATCH.
No usar la ruta eliminada `POST /api/onboarding/program`.

| Campo | Sellos | Puntos |
| --- | --- | --- |
| kind / configuration | `stamps`; target entero 2–50 obligatorio | `points`; unitSingular y unitPlural no vacíos obligatorios |
| Nombre de unidad de Sellos | unitName/unitPlural opcionales en API; si falta unitName, default sello/sellos. El editor manda su nombre y conserva unitPlural existente sin inventar un plural si no había | No aplica |
| accrual | Opcional en API: por compra, grant 1, blockAmount null; el editor envía la mecánica elegida | Obligatorio, per_amount, grant entero positivo y blockAmount positivo; no suponer un default monetario del servidor |
| rewards | Exactamente uno; pointsCost omitido o null | 1–20; cada pointsCost entero >0 |
| clauses | Omitir pide semillas del país; [] es 422. Este editor conserva su requisito de texto y envía una cláusula explícita | Igual que Sellos |
| stampAction / carga | keep por defecto; replace incluye stampUploadId/stampCropped, remove/keep no los incluyen | keep; sin carga de sello |
| cardDesign | Opcional en API; enviar diseño del borrador | Omitir; no enviar objeto de diseño (el servidor actual también tolera null) |
| redeemAllowInsufficient | Boolean estricto, default false; editor envía explícitamente el valor hidratado/editado | Igual que Sellos |

El backend completa únicamente omisiones, sin pisar campos explícitos. Omitir unitPlural
cuando se envía unitName personalizado no pide el plural «sellos»: el TOS cae al singular.
Preservar ese dato de configuración existente al editar sin agregar un nuevo campo visual.
El requisito de texto de esta pantalla no se presenta como obligatoriedad de `clauses`
en el contrato ni impide que el wizard use las semillas. No ofrecer cashback/tiers.
Éxito: 201 creado / 200 editado, `{programId,created}`; no DTO completo.

**Email y permisos:** PUT permite crear sin email verificado. Editar exige email verificado
o permiso de alta vigente para owner; staff autorizado queda exento. La UI no calcula
ni prolonga el permiso de alta: procesa el code de la API. GET programa/plantillas y
stamp-upload mantienen gate de email para owner, de modo que este editor puede mostrar
verificación requerida antes de cargar aunque el PUT de creación admita el alta.
No omitir esos guards, reutilizar permisos de onboarding ni gatear staff por email.

**Errores vigentes:** 0086 prevalece sobre las referencias owner-only del 0079 §1/4/5
en GET/PUT y superficies delegables; comprobado en `app/api/loyalty-program/route.ts`.

| Status / code | Tratamiento de UI |
| --- | --- |
| 401 unauthorized | Sesión terminada, volver a ingresar; conservar borrador mientras la pantalla esté montada |
| 403 not_member | Sin membresía activa; Alert y volver. No mostrar estado/motivo de un negocio ajeno |
| 403 missing_permission | Sin permiso del objeto; Alert y volver en Loyalty. Si llega desde catálogo, limitar sólo selector/carga de catálogo, conservando el editor |
| 403 email_not_verified | Sólo owner; verificación del email con ApiError y acción explícita tras verificarse; nunca solicitarla al staff |
| 403 business_suspended / business_closed | Bloquear operaciones; motivo de suspensión sólo si lo entrega la API al owner, sin inferirlo para staff |
| 403 not_owner | Exclusivamente cierre/cancelación y otras superficies no delegables; nunca traducir missing_permission a este code |
| 400 invalid_body | Error de formato de request, sin avance ni éxito |
| 422 invalid_program | Validación; conservar borrador, error persistente. No inferir campo/causa a partir del texto |
| 409 program_exists | Estado incompatible, incluido programa en cierre/cambio de modalidad; consultar estado con GET y sin repetir PUT automáticamente |
| 503 program_unavailable | Servicio o semillas no disponibles; conservar borrador y ofrecer reintento explícito |

Guard delegado conserva orden sesión → membresía → permiso → email sólo owner → estado.
GET/PUT/stamp-upload/plantillas no usan not_owner como rechazo del guard delegado.
DELETE/PATCH conservan guard owner; errores de dominio de cierre/uploads pueden venir
como `{error}` sin code. JSON/GET/storage pueden fallar fuera del formato previsto:
mantener status y code opcional, fallback de operación sin inventar código ni causa.
`ApiError` actual no incluye not_member/missing_permission: usar Alert, sin casts a su unión.
Mapear códigos conocidos a copy local; el texto `error` no decide permisos ni navegación.

## Archivos previstos

Rutas relativas a raíz. Las extracciones permanecen dentro de Loyalty y respetan el
límite de tamaño del repositorio.

| Archivo | Acción |
| --- | --- |
| `apps/merchant/src/app/backoffice/loyalty/page.tsx` | Adaptar gate a sesión/permiso loyalty y entregar capacidades al cliente, sin tocar guards compartidos |
| `apps/merchant/src/app/backoffice/backoffice-navigation.tsx` | Publicar Loyalty delegada en móvil/escritorio, conservando otras superficies |
| `apps/merchant/src/app/backoffice/loyalty/{loyalty-page,program-editor,program-view,program-closing,ui}.tsx` | Adaptar todas las vistas; reemplazar AutoGrowTextarea por catálogo |
| `apps/merchant/src/app/backoffice/loyalty/steps/*.tsx` | Migrar campos/acciones, presentación de revisión y controles de diseño |
| `apps/merchant/src/app/backoffice/loyalty/{use-loyalty-program,use-rewards,use-stamp-upload,loyalty-types}.ts` | Estado visible de carga/error/refresh, validación y protección de requests/imagen |
| `apps/merchant/src/app/backoffice/loyalty/{loyalty-api,program-form-state}.ts` | Extraer cliente HTTP y validación/navegación local |
| `apps/merchant/src/app/backoffice/loyalty/{loyalty-confirm-dialog,closing-date-field,card-design-fields}.tsx` | Composiciones especializadas locales |
| `apps/merchant/src/ui/{text-area-field,choice-group,checkbox-field}.tsx`, `index.ts` | Añadir/exportar primitivas neutrales |
| `apps/merchant/src/ui/progress-indicator.tsx` | ariaLabel opcional, comportamiento por defecto conservado |
| `apps/merchant/src/app/globals.css` | Layout scoped Loyalty y aislamiento de primitivas nuevas de reglas nativas; sin cambiar tokens ni colores globales de diálogos |
| `docs/design-system.md` | Documentar API/estados/ejemplos de nuevas piezas y excepción datetime |
| Pruebas junto a módulos; `tests/e2e/loyalty-design-system.spec.ts`; `tests/e2e/support/loyalty-{entry,fixture}.*` | Reglas y navegador con componentes reales/HTTP controlado |
| `tests/e2e/support/catalog-harness-server.ts` | Sólo si necesita entrada adicional, conservando default existente y evitando duplicar servidor |

**Disjunta: no.** Comparte globals/barrel/controles con Catálogo 0095–0096 y Marca 0097;
serializar. También comparte navegación con esas entregas. No editar APIs, guards
compartidos, schema, wizard ni CardPreview
compartido. Antes de borrar CSS antiguo, buscar todos sus consumidores: `published-term`,
`chip`, `color-field`, `wizard-nav`, `panel` y skeletons pueden tener usos fuera de Loyalty.

## Definition of Done

UI implementada localmente el 2026-09-26. Revisión independiente de navegador: **50 passed / 1 skipped**; permisos/preview/costos: **11 passed**. Evidencia y límites en [handoff](../archivo/spec-0098-handoff-ui.md) y [revisión](../archivo/spec-0098-revision-ui.md). Smoke autenticado y QA iOS/Android pendientes; commit/push autorizados por owner para QA live, sin despliegue verificado.

- [x] Playwright monta Loyalty real con CSS y HTTP controlado: creación/edición de Puntos
  y Sellos atraviesan todos los pasos, vuelven conservando valores y emiten payload correcto.
- [x] Payload completo según 0079: Puntos exige unidades/dinero/costo y omite diseño/carga;
  Sellos preserva plural existente, meta, diseño y mecánica; clauses explícitas y flag
  booleano conservados. PUT 201/200 refresca por GET sin esperar un DTO en la escritura.
- [x] Adaptador y navegación permiten owner/staff con loyalty y rechazan staff sin él.
  Staff con loyalty sin catalog edita con libre/descuento sin sondear catálogo; premio
  de producto persistido se conserva. Cerrar/cancelar cierre ausentes para staff; ningún
  handler staff envía DELETE/PATCH. Owner mantiene sus controles y destino único.
- [x] 401 y todos los 403/409/422/503 de la tabla se presentan según code y operación;
  missing_permission de catálogo no bloquea Loyalty. Sólo owner verifica email; el staff
  sin verificar sigue editando. ApiError conserva suspensionReason sólo si fue entregado.
- [x] Campo vacío, mínimo/máximo, decimal con coma, error y corrección probados por
  interacción. Validación completa de revisión impide PUT inválido. Teclado en select,
  radios, checkbox, slider y diálogos; foco por avance/error/salida.
- [x] GET de carga fallido → error visible → reintento recupera; catálogo fallido distinto
  de vacío; premio existente sin opción no se borra. PUT fallido conserva datos; doble
  clic envía una escritura; GET posterior fallido permite lectura sin repetir escritura.
- [x] Diseño muestra preview al editar; sello se aplica sólo al guardar. Preparación y
  recorte bloquean avance/guardado; cancelación/remoción y respuesta tardía no restauran
  archivo. Casos reales de componentes, sin reclamar que setInputFiles prueba cámara.
- [x] Consulta activo/en cierre representa DTO guardado, fecha y zona; cierre y cancelación
  requieren confirmación y mantienen sus contratos. Descartar/cancelar diálogo conservan
  la conducta definida para creación y edición.
- [x] Comparación renderizada con campos del wizard a 320/390/768/1280 px en light/dark:
  label/valor de 16 px, ayudas/placeholder y colores correctos, controles ≥48 px, acciones
  ≥44 px, sin scroll horizontal ni superposición que impida operar. Capturas de todas
  las superficies; medir estilos computados, no sólo buscar imports o clases.
- [x] Smoke visual de Marca, Catálogo, Staff y Locales con CSS final: campos y diálogos sin
  regresión. Probar tema explícito y preferencia de SO; reduced motion sin animación necesaria.
- [x] Contraste y tipos UI: `pnpm --filter @mi-pasaporte/merchant check:design-contrast`
  y `pnpm --filter @mi-pasaporte/merchant typecheck:ui`.
- [ ] Seis gates root Node 24, una vez al final (typecheck/lint/test/format PASS; Merchant compila con Webpack, Turbopack bloqueado por EPERM; E2E general diferido por owner para QA live): `pnpm run typecheck`, `pnpm run lint`,
  `pnpm run test`, `pnpm run format:check`, `pnpm run build`, `pnpm run test:e2e`.
- [x] Sin cambios de backend/guards compartidos/otras pantallas en diff; cambios de
  navegación limitados a acceso delegado de Loyalty y su cabida responsive. CSS retirado sólo sin
  consumidores. `rg -n MUTATION apps tools` vacío. Revisión independiente con evidencia.

## Verificación — presupuesto: cuatro mutaciones plausibles

Las cuatro mutaciones se ejecutaron y detectaron el defecto previsto en una ronda.
Baseline antes de medir, copia/SHA y bitácora antes de editar; restauración verificada
por implementador y revisor. Evidencia en la [bitácora](../archivo/spec-0098-bitacora-de-mutaciones.md).

| # | Defecto a introducir | Señal exigida en navegador |
| --- | --- | --- |
| 1 | Omitir validación del monto al continuar/guardar | Monto vacío/0 no avanza y no envía PUT; caso debe fallar por avance/request indebido |
| 2 | Volver a retornar skeleton antes del error de carga | GET 503 debe mostrar alerta y botón de lectura; fallo por ausencia de recuperación |
| 3 | Resetear el borrador al volver de paso | Nombre/monto/premio escritos sobreviven ida/vuelta; fallo por pérdida de valores |
| 4 | Retirar guarda sincrónica de la escritura | Dos activaciones rápidas producen sólo un PUT bajo respuesta demorada; fallo por request extra |

Protocolo: copia limpia y shasum → bitácora → etiqueta MUTATION → medir/leer el fallo →
restaurar con diff contra copia. Máximo dos rondas; si arreglar abre otra rotura en dos
vueltas consecutivas, registrar resto para QA. No multiplicar pruebas ni mutaciones para
demostrar preferencias visuales. Revisor independiente al final, con límites explícitos.

## Fuera de la evidencia automatizada

Fixtures no acreditan guard/session real, storage real, envío de cámara nativa ni despliegue.
Smoke autenticado sólo con sesiones de desarrollo aisladas; no modificar producción
para preparar datos. QA real iOS/Android del picker, recorte, teclado y scroll se registra
con dispositivo/resultado. No reclamar inspección de producción ni estética aprobada
a partir de lectura del código o de los gates.

## Handoff y estado

Spec cerrada con aprobación del owner el 2026-09-26; implementación autorizada para
retomar después de `/clear`. Punto de retorno:
[handoff de Loyalty](../handoff-loyalty-ui-2026-09-26.md).
Un implementador para todo el alcance y un revisor independiente al final según ADR 0071.
La UI está implementada y cuenta con PASS independiente sobre el alcance verificable
localmente. Comparación renderizada contra el wizard y contratos conservados, con
[entrega](../archivo/spec-0098-handoff-ui.md) y
[revisión](../archivo/spec-0098-revision-ui.md). Estado documental: cerrada con UI
implementada y QA autenticado/dispositivos pendiente. La etapa de diseño no implementó
UI; esta entrega corresponde a la reanudación autorizada.

## Abierto

No hay decisiones de diseño pendientes ni se identifica un endpoint nuevo necesario.
Acceso staff implementa la decisión ya
vigente del 0086/ADR 0079; los tours permanecen fuera de esta entrega.

# 0242 — Handoff compacto para corregir la UI después de clear

## Última instrucción y segunda ronda

Tercera ronda DIRECTA: badge local retirado de tarjetas; filtro local inicia primer local disponible (convención actual del POS) y muestra «Todos los locales» solo si hay varios; nuevo filtro por tipo de orden combinado con estado/local. Dos archivos de presentación, sin HTTP/DB. Formato/lint/UIguard/diff-check/typecheckMerchant PASS. Pendiente prueba manual en3201.

Owner confirmó: **a partir de la siguiente ronda, ajustes ligeros directos por el coordinador, SIN agentes**. Sustituye instrucciones anteriores de dos implementadores para próximos arreglos. Segunda ronda integrada en dev `afc164cd`: iconos junto al nombre con colores por tipo; badge local bajo precio y badge productos que abre panel de contenido cargado por demanda desde caché/cliente actuales; móvil UNA columna compacta (icono/nombre/total/Abrir). Autores `4e0fc014` y `9f985d18`, más ajuste directo final de padding/prioridad de color y precio móvil. Formato/lint3archivos/UIguard/diff-check/typecheckMerchant PASS. Pendiente revisión manual del owner en3201. Sin QA independiente/browserautomatizado/DB/push/PROD. Factory delivered/WTs conservados; main sin avance. El primer ajuste y reglas anteriores siguen solo como historia cuando contradicen este bloque.

## Avance vigente: primera tarjeta entregada a prueba manual

El owner ya dio el primer encargo: listado en tarjetas con nombre de mesa/descripción guardada, total, recuento de productos e iconos Iconoir; dos columnas móvil y tres desktop. Implementado por dos autores nuevos e integrado en dev `72b94a6f1b8c93a56bcaae2539f5558a5988be25`: card `9b6b1813`, grid `51310076`. Solo `measured-order-card.tsx` nuevo y `measured-order-list.tsx` modificado. Formato/lint focal, UI guard combinado contra ab42ec8b, diff-check y typecheck Merchant PASS. Sin QA independiente, browser automatizado ni DB. Preview3201 conserva servidor/sesión del owner. **Pendiente prueba visual del owner**, factory ambos delivered; WTs limpios conservados y main local sigue fe1ee796. No aceptar visualmente/retirar por oficio. Detalles en bloque vigente de estado GPT. El contexto de abajo es anterior a este primer encargo; esperar feedback o siguiente ajuste concreto, sin auditoría general. Sin push/PROD.

## Objetivo inmediato y autorización

El owner ordenó corregir PRIMERO la UI y aclaró después cómo trabajar: **él indicará específicamente cada arreglo**. Son ajustes UI L0, rápidos, con dos implementadores nuevos y **prueba manual del owner en el navegador**, sin QA independiente ni batería extensa. No iniciar auditoría de toda la UI, contraste general ni nueva ronda de diseño antes de recibir su lista. El laboratorio aprobado sigue siendo referencia cuando ayude a resolver sus instrucciones concretas. No continuar primero con retirada legacy/peso ni dar por aceptada la UI por pruebas de componentes.

Orden pendiente vigente: **1 UI; 2 impresión/precuenta/reimpresión/anulación sobre esa UI; 3 venta por peso completa; 4 retirada del flujo anterior/accesos; 5 fidelización/cupones pendientes; 6 regresión y rendimiento**. Antes de activar masa, los escritores antiguos deben estar bloqueados o retirados: es una dependencia técnica del punto3, aunque la retirada visual completa vaya en4. Plan detallado: `docs/factory/0242-plan-implementacion.md`, primeras prioridades.

Instrucción explícita vigente para ESTA fase de ajustes UI: dos implementadores nuevos con contexto vacío, tareas concretas y paths separados, coordinador integra y el owner verifica en navegador. **Sin agente QA ni nuevas pruebas por ceremonia.** Checks de diff y estáticos focales cuando correspondan al archivo cambiado; no repetir DB, matrices funcionales ni suites extensas ya probadas. Esta instrucción posterior del owner prevalece sobre el workflow anterior de QA por entrega para esta fase. No subdelegar ni crear reviewers adicionales. No hay implementadores trabajando ahora; esperar los cambios específicos del owner antes de asignar código. UI aún sin reserva/worktree/autor.

## Estado comprobado al preparar este handoff

- Principal en **dev**, último commit antes de este documento `d4352018ce0e940eb9dc65ad880822c3301502b9` (docs). Main local **`fe1ee79603fe3ae1b476128c6188fcf788708a2e`**, producto aceptado. Confirmar refs actuales al retomar; no hacer pull/switch ni tocar trabajo ajeno.
- Solo queda WT QA `/private/tmp/checkpass-pos-0242/pos-qa-0242`, ref pos-qa-0242, limpio y factory **accepted** en `679175066559d64b3ec32c1567a1d64703569bf8`. Puede continuarse por factory con candidato nuevo y agente QA nuevo; no moverlo con checks vivos. Autores anteriores retirados por factory, limpios/0procesos/ancestros de main.
- Servidor del owner **http://localhost:3201**, Next dev del principal. Vista previa: **http://localhost:3201/backoffice/pos?posV2=1**. No detener/reconfigurar ese servidor ni túnel/demos. Producción/default siguen entrada legacy; preview exige development. El owner ya tiene su sesión y probó ahí; no afirmar que tenemos acceso automatizado a su documento autenticado.
- No push ni operaciones PROD autorizados. Expansiones LOCAL aplicadas previamente:107 migraciones; no migración en el corte UI. No tocar M0/control ni sus fixtures/artefactos privados.

## Lo que el owner confirmó y lo que sigue fallando

**Funcionan manualmente:** crear/cobrar/resultado/listado unit, Recetas/base y consumo proporcional, Stock, importes/cambio, precio congelado, recarga sin duplicados e históricos. **Notas también funcionan**: el campo era difícil de descubrir, al final de Editar pedido→Orden, debajo de productos y antes del total. No hay un fallo de persistencia de notas pendiente ni una petición autorizada de notas por producto.

**UI NO aceptada.** Capturas del owner muestran detalle con título Mostrador+referencia, total y tres renglones del mismo producto muy separados; acciones grandes; sección Precuenta repetida. Editor con tarjetas/controles enormes repetidos, nota como textarea muy grande al final y distribución alejada del diseño acordado. También se ven `unit` sin traducir y formatos monetarios mezclados `USD 6.00`/`USD 6,00`. Contrastar la referencia completa antes de decidir cambios; no limitar la corrección a estas observaciones ni inventar una estética nueva. No fusionar snapshots distintos por coincidir productId; las líneas separadas pueden ser una decisión funcional válida aunque su presentación necesite corregirse.

**Impresión sigue sin funcionar para el owner:** no encuentra botón de orden/precuenta. Confirma expresamente que **«Imprimir tickets» SÍ está activado en su negocio**. No volver a atribuirlo a configuración apagada. El código oculta el botón si `printing.enabled` no es true, pero no hemos inspeccionado el GET autenticado real del owner ni reproducido la causa de esa discrepancia. No habilitar automáticamente settings, eliminar guards ni cambiar el negocio para obtener verde. Resolver ubicación/visibilidad dentro de la UI y después verificar el recorrido real en punto2. Notes/printing se aclararon por chat: no mantener preguntas async antiguas como pendientes.

Fidelización y cupones NO probados manualmente por falta de pase. Masa completa, carga fría/rendimiento y seguridad del conjunto aún no certificados. UI nueva y circuito unit funcionando no equivalen a0242 terminado. Owner frustrado por más de6h sin un corte visible: evitar nuevas esperas seriales entre entrega, aceptación y despacho. No repetir ETA6–12h sin medición que la sustente.

## Referencias que debe leer el coordinador nuevo

1. AGENTS y protocolos `docs/TRABAJO-EN-PARALELO.md`, `AGENT-WORKFLOW.md`, `VERIFICACION.md`; bloque vigente de `docs/estado/gpt.md` y ESTE handoff. Los largos checkpoints que siguen en estados/handoff general son historia: no releer toda la cadena por oficio.
2. Spec `docs/specs/0242-pos-unificado-y-venta-por-peso.md`, contrato `0242-contratos-pos-y-medidas.md` y prioridades al inicio del plan. Funcionalidad cerrada, gratis/2×1 no aplica a targetmass; unit en mezcla sí; porcentaje/fijo mass sí. Emisión PWA fuera; canje directo suspendido, saldos/historia preservados.
3. Laboratorio **`docs/design-explorations/2026-10-18-mostrador/index.html`**, **`decisiones.html`** y referencia **`versiones/v004/index.html`** con sus scripts. Ver la referencia real, no reconstruirla desde memoria ni copiar CSS/aritmética del prototipo al producto. Mesa/Retiro/Delivery/Mostrador, móvil con primaria/total en pie y desktop catálogo+orden.
4. `apps/merchant/COPY.md`, kit merchant y componentes actuales pertinentes. Skill Impeccable ya aplicada: principal `.agents/skills/impeccable/SKILL.md`, harden/craft-floor; contexto del proyecto ya cargado anteriormente. No init/rerun de contexto/drift ni modificar artefactos ajenos. Una inspección agrupada390/1280 y máximo una confirmación por corte, capturas ABIERTAS conservadas fuera del output autolimpio.

## Producto y contratos a conservar

UI principal en `apps/merchant/src/modules/pos/ui/`: `pos-entry.tsx`, `measured-console.tsx`, `measured-order-list.tsx`, `measured-pos-editor.tsx`, `measured-cart.tsx`, `measured-product-catalog.tsx`, `measured-quantity-dialog.tsx`, `measured-checkout.tsx`, `measured-coupon.tsx`, `measured-scan.tsx`, `measured-ticket.tsx`, `measured-printing.ts`, `measured-void-action.ts`. Antes de leer paths auxiliares, localizar con rg --files.

Sesiones editor/pago y misma PosCache viven en el padre por identidad real. No perder borradores al cambiar vista, no abandonar create/close/void inciertos ni emitir nueva clave; captura y body antes de await; 403 de misma identidad no prueba rollback,401/scope real retiran. Canonicalclosed permanece cerrado aunque callback/impresión falle. Respuestas canónicas a la misma caché/fachada, sin GETpostwrite automático. Historial usa closedAt y día local explícito; snapshots monetarios/medidas exactos, no Number como autoridad. Elegir impresora solo elige, impresión necesita gesto separado; callback tardío no abre window.print en otra identidad.

Aceptación funcional más reciente: autoracciones `1fcba12c60e719ebc7c94f67a306e1ffde21682f`, QA `679175066559d64b3ec32c1567a1d64703569bf8`, candidato `37a25b10f3068050af40e021e229496e94f74428`; informes `0242-cp2d-console-actions-{handoff,qa}.md`. QA8unit+4browser propios, FAIL anterior preservado. Fix captura void ligada al controlador vivo BackofficeProvider, no al hook leaf desmontable. Ticket/printing aceptados previamente tras fix choose→unsupported que imprimía sin gesto separado. Estos casos son regresiones a conservar al cambiar presentación.

QA nativa anterior: `0242-cp2d-connected-console-qa.md`, un circuito unit Next/auth/HTTP/DB real tras warmupread-only y negativo cookieB/scopeA409; no certifica coldloadglobal/M1 ni hardware. Informes anteriores se consultan solo según la dependencia que cambie. Guardias tienen backlog conocido Expenses→Stock y literales core sin nuevos offenders; no modificar guardias ni afirmar verde global.

## Cómo iniciar el trabajo de UI

**Esperar las instrucciones concretas del owner.** No despachar una comparación general ni elegir por cuenta propia dos grandes superficies a rehacer. Al recibir la lista, repartir arreglos independientes entre los dos implementadores nuevos con paths exclusivos; un writer por archivo, sin cambios de dominio por oficio. Conservar el alcance acotado y el circuito ya probado. El owner revisa cada corte en el navegador y señala el siguiente ajuste.

Mantener aislamiento y reservas de paths con Node24/factory/WT propios, de forma proporcional. Para estos ajustes L0: diff y estáticos focales pertinentes; **sin agente QA, tests nuevos por ceremonia, browser automatizado completo, DB ni matrices funcionales repetidas**. No introducir otra fase documental o de aprobación antes de cada cambio de presentación. La aceptación de esta UI la da el owner probándola en su navegador. No copiar env productivos ni añadir infraestructura.

Sandbox gitdir/psEPERM es operativo recurrente: aviso inmediato y escalación acotada propia autorizada, sin esperar owner; Chromiumrunner propio escalado desde inicio por MachPort1100. Preservar `.impeccable/config.json` modificado y todos los untracked ajenos en .agents/.claude/.codex/.github/public/consumer. No stage general ni reset/discard.

## Prompt para retomar

«Retoma0242 desde AGENTS.md, el bloque vigente de docs/estado/gpt.md y docs/factory/0242-ui-handoff.md. Ahora te pasaré los arreglos específicos de UI. Trátalos como ajustes L0 rápidos: dos implementadores nuevos con paths separados, sin QA independiente ni baterías extensas. Yo probaré los cambios en el navegador y te daré feedback. Espera mi lista antes de empezar; conserva la lógica funcional ya validada. Sin push ni PROD.»

# 0238 — Revisión del autor contra código y contratos

Owner pidió expresamente que el coordinador revise el plan. El plan original fue escrito por este autor; el agente adversarial fue distinto y no participó en su creación. El agente revisó `03949d2e` y después el delta `20e81dfb`. **Esta revisión adicional es del autor, no una segunda certificación independiente.** No borra ni modifica el informe del adversarial.

Fuentes: propuesta `20e81dfb` más la precisión documental posterior sobre observar DOM antes de terminar el stream; código de esa base en `panel-request.ts`, `settings/module-request.ts`, `settings/module-settings.tsx`, `modules/dispatch.ts`, `analytics/http/index.ts`, guards y layout. Revisión estática, sin app/DB/API/mediciones nuevas, código de producto, push ni PROD.

## U1 — Una generación cliente no vincula por sí sola la operación al ámbito que el usuario veía

Prioridad alta; hueco adicional del contrato, no prueba de escalada de privilegios ni reporte de un incidente PROD.

Los transportes `app/backoffice/panel-request.ts:36` y `settings/module-request.ts:25` envían la cookie que el navegador tenga al ejecutar fetch; no indican el usuario/negocio que originó la intención. Los endpoints seleccionan el negocio desde esa cookie. En `modules/dispatch.ts:49`–`:59`, un toggle validado aplica `setModuleEnabled(auth.business.id, ...)`.

Escenario: la pestaña 1 conserva la pantalla del negocio A. En la pestaña 2 se cambia de cuenta a B, compartiendo cookies del origen. Antes de que pestaña 1 reciba foco/revalide, un callback pendiente o nueva lectura sale con la cookie de B y un ticket local todavía marcado A. La API puede autorizar legítimamente B y devolver sus módulos o modificar su toggle. Comparar solamente generaciones locales acepta una respuesta atribuida al ámbito equivocado: la generación de A no cambió porque todavía no se detectó la nueva sesión. Revalidar antes de cada operación tampoco cierra el intervalo entre esa lectura y el siguiente fetch.

Corrección propuesta: el nuevo contexto lleva una marca opaca ligada a sesión, usuario y negocio; los transportes adoptados la capturan al iniciar la operación y la envían como ámbito esperado. El servidor valida primero la sesión y todos sus gates vigentes, compara después la marca con su contexto actual y, si difiere, rechaza **antes** de lectura de dominio, exposición o mutación. No usa la marca para elegir negocio ni conceder acceso. No reescribe la intención ni reintenta automáticamente una escritura en el nuevo ámbito.

Esto exige un contrato HTTP aditivo explícito para los consumidores migrados: cabecera opt-in y 409 de contexto cambiado. No es correcto seguir diciendo «ningún código nuevo» para esas peticiones. Clientes anteriores sin cabecera conservan su contrato y las validaciones actuales. Reporter de sesión y auth quedan fuera de esa comprobación para poder descubrir o cerrar la sesión actual. La spec §4.3 concreta la propuesta y sus pruebas; es un cambio de diseño todavía en borrador, no un protocolo ya implementado o aprobado por el owner en detalle.

Aceptación: cookie A→B entre render y fetch sin foco, respuesta previa a cambio de ámbito, nuevo login de la misma cuenta, intento de toggle con contexto A/cookie B, y usuario con primera membresía staff en A y owner en B. No lectura/efecto de dominio en caso409; denegaciones existentes y sesión inválida siguen precediendo a esa comparación; ausencia de cabecera mantiene compatibilidad.

## U2 — Navegar completamente por cada cambio estructural puede perder trabajo autorizado

Prioridad media/alta; regresión de UX introducida por la propuesta.

La tabla anterior de spec §4.1 agrupaba identidad, rol, permisos y cualquier cambio de billing.access en una navegación completa al backoffice. Una transición trial→subscribed en otra pestaña, detectada al volver al formulario, no implica que el usuario haya perdido su sesión o permiso. Esa navegación descarta estado local y puede sacar al usuario de la pantalla que estaba editando. El código actual de `settings/module-settings.tsx:104` usa `router.refresh()` después de guardar, no una recarga completa. La documentación local de Next para useRouter confirma que refresh conserva estado cliente no afectado, mientras mergea el nuevo payload RSC.

Corrección: separar cambios de identidad/pérdida de membresía de cambios del mismo ámbito. Para el mismo usuario, sesión y negocio: actualizar el provider, invalidar recursos afectados y reconciliar las decisiones servidor necesarias con un router.refresh coordinado, preservando keys/estado cliente que siguen autorizados. No recargar todo el documento por actualizar días de prueba, ganar un permiso o pasar a suscrito. Si se pierde acceso efectivo a la ruta, los gates vigentes determinan la salida; no se preservan capacidades revocadas para conservar un formulario. Cambio real de sesión/identidad/negocio o pérdida de membresía sí retira el ámbito completo y vuelve a la entrada correspondiente.

Aceptación: formulario con cambios locales y transición trial→subscribed, cambio de nombre, habilitación de módulo y ganancia de permiso no relacionado mantienen la edición si la ruta sigue autorizada. Revocar el permiso de la ruta o perder membresía sí retira los datos/capacidades pertinentes y aplica el gate. Un refresh RSC no reinserta un seed anterior ni provoca un bucle de revalidación/refresh.

## Dictamen propio y límites

La mejora de datos por petición, el JOIN conservando fallos y el seed sin efectos de Inbox siguen siendo un enfoque razonable. Mi revisión **no mantiene una afirmación global de que todo el diseño ya estaba cerrado**: el dictamen independiente cierra sus seis hallazgos sobre `20e81dfb`, mientras U1/U2 corresponden a esta revisión posterior.

U2 se corrige en la propuesta. U1 queda formulado como contrato aditivo propuesto en spec/ADR/ficha; requiere aceptación explícita de ese diseño antes de cerrar el borrador e implementar. No basta llamarlo detalle interno ni prometer aislamiento completo solo con tickets locales. No se inicia código para resolverlo en este encargo.

Se conserva el informe independiente sin atribuirle revisión de este nuevo protocolo. Spec sigue borrador y ADR propuesto. No hay PASS de producto, rendimiento, privacidad entre pestañas o preservación de formularios: son criterios de implementación futuros. Continúan los diferidos y el FAIL histórico, sin operaciones PROD ni push.

---
adr: 0090
fecha: 2026-09-26
estado: propuesta
resumen: Loyalty incorpora orientación general y cuatro ayudas sobre su editor existente; el onboarding persiste sólo progreso y las ayudas conservan borrador y confirmaciones.
---

# 0090 — Los tours de Loyalty acompañan el editor existente

Propuesta parqueada por owner el 2026-09-26; se prioriza consistencia del formulario.
Detalle de retorno en [PARQUEADO](../PARQUEADO.md).

## Contexto

El owner pidió planificar un tour general de onboarding y ayudas para crear, editar,
cerrar y editar políticas en `/backoffice/loyalty`. La UI 0098 ya está publicada para QA.
Catálogo y Marca distinguen orientación sin operaciones de ayuda sobre acciones reales.

El id `program` ya existe en el catálogo de onboarding y en el cliente HTTP, pero falta
su destino en `onboarding-view.ts`. Loyalty conserva un editor por pasos y un único PUT
completo para crear/editar, incluidos los términos; cerrar usa DELETE con fechas y
cancelar cierre usa PATCH. No existe un guardado separado de políticas.

## Propuesta

1. Reutilizar Driver.js y el motor de onboarding, con contenido local y anchors estables.
   El recorrido general explica la pantalla sin completar campos, navegar el editor ni
   escribir el programa. La entrada de checklist será `?tour=onboarding` y usará el id
   persistido `program`; repetir desde Ayuda no modificará ese progreso.
2. Ayuda ofrece cuatro tareas: crear, editar, programar cierre y editar políticas.
   El alcance exacto de políticas está pendiente de aclaración del owner. Se propone
   términos y condiciones; la regla de canje se incluirá si así lo indica.
3. Cada ayuda acompaña el flujo normal y sus validaciones. Sólo el usuario guarda,
   elige archivos y confirma cierre/descarte. La guía avanza por estado de la UI y
   confirmación HTTP, nunca por haber hecho clic en un botón.
4. Editar políticas abre el editor existente en Términos, conservando el resto del
   programa y cualquier borrador. Guardar sigue enviando el payload completo y requiere
   revisión; no se agrega una API ni guardado parcial.
5. Owner y staff con loyalty pueden crear/editar según permisos y estado actuales.
   Sólo owner programa cierre. Staff no escribe progreso de onboarding; sí puede usar
   las ayudas y repetir la explicación general sin persistencia.
6. Salir de la guía retira únicamente la guía. La X de la pantalla mantiene el descarte
   normal; errores y guardados no confirmados conservan borrador y recuperación actuales.

Esta es una propuesta para revisar, no una aprobación atribuida al owner. Se mantiene
fuera implementar la guía de cancelar cierre, cambiar mecánica/API y extender políticas
a configuraciones que todavía no existen.

## Referencias

- [Spec 0100](../specs/0100-tours-de-onboarding-y-ayuda-de-loyalty.md).
- ADR 0078, 0079, 0087, 0088 y 0089; specs 0084/0085, 0096/0097 y 0098.
- Contratos de programa 0079/0099 y progreso 0084.

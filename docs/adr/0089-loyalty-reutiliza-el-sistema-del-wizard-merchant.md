---
adr: 0089
fecha: 2026-09-25
actualizada: 2026-09-26
estado: aceptada
resumen: Loyalty migra todas sus superficies al catálogo visual del wizard merchant; conserva pasos y contratos y agrega sólo las primitivas de formulario que faltan.
---

# 0089 — Loyalty reutiliza el sistema del wizard merchant

## Contexto

El owner pidió analizar `/backoffice/loyalty` y crear un spec para aplicar el sistema
de diseño utilizado en las otras pantallas, citando inputs, labels y placeholders del
wizard de creación de merchant. La implementación será una etapa posterior.

Loyalty mantiene campos nativos, chips, textarea y acciones con estilos heredados.
El wizard, los formularios de Staff/Locales y campos de Marca/Catálogo utilizan `src/ui`.
La API actual ya entrega configuración, mecánica, premios y diseño para presentar un
resumen útil. Las diferencias están medidas en el código; producción no fue inspeccionada
con sesión autenticada. Evidencia y alcance en [spec 0098](../specs/0098-loyalty-sistema-de-diseno-del-backoffice.md).

## Decisiones

1. Migrar consulta, creación/edición, revisión, carga/error y cierre como una sola entrega
   visual. Mantener pasos actuales y reglas de Puntos/Sellos; no convertir el rediseño
   en una nueva mecánica ni un tour.
2. Consumir `TextField`, `NumberField`, `SelectField`, `Button`, `Alert` y
   `ProgressIndicator`. Añadir textarea, elección y checkbox neutrales con React Aria,
   tokens y anatomía del catálogo. Controles especializados de color/fecha/carga se
   componen localmente con esos roles y relaciones accesibles.
3. Presentar configuración/premios persistidos en consulta y conservar la vista previa
   actual de sellos. No inventar métricas ni APIs para completar la composición.
4. Tratar loading/error/disabled/guardado y validación visible como estados del diseño,
   incluyendo recuperación de carga y preservación del borrador. No añadir autosave.
5. Acotar CSS y confirmaciones a Loyalty. No recolorear diálogos compartidos ni modificar
   controles de otras pantallas por efecto lateral.
6. Mantener API/backend y guards compartidos fuera del diff. Adaptar página y navegación
   al permiso loyalty ya vigente: staff autorizado consulta/crea/edita; DELETE/PATCH
   y sus controles siguen owner-only. El permiso loyalty no implica catalog: la selección
   de productos respeta esa capacidad independiente sin bloquear libre/descuento.

Revisión del 2026-09-26: el owner pidió contrastar los contratos 0079 y 0086. Se corrige
la exclusión inicial de acceso staff porque contradice una decisión ya aceptada en el
ADR 0079. No se propone ampliar permisos ni cambiar el backend. El 0079 §2–3 rige el
payload completo y resultado del PUT; el 0086 actualiza errores/capacidades, incluido
email sólo para owner y not_member/missing_permission en superficies delegables.

## Consecuencias

Los formularios obtienen el mismo lenguaje visual y comportamiento accesible del wizard.
Las primitivas nuevas quedan disponibles para futuras pantallas; sus defaults no alteran
consumidores existentes. Verificación visual incluye light/dark, móvil/escritorio y
regresión acotada de otras pantallas por el CSS compartido.

El owner aprobó implementar el spec 0098 después de `/clear` el 2026-09-26:
«ok, si estas listo podemos hacer clear y regresas para implementar el spec 0098».
Diseño aceptado; implementación y verificación de UI pendientes.

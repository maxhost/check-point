---
adr: 0087
fecha: 2026-09-25
estado: aceptada
resumen: Catalogo publica una orientacion de cuatro pasos y ocho ayudas operativas; Codex implementa toda la UI, Claude Code mantiene la API existente, y los recorridos avanzan por transiciones confirmadas sin confundir salir de la ayuda con cancelar una operacion.
---

# 0087 — Los tours de catálogo son UI y consumen estado del API

## Contexto

El owner aprobó el 2026-09-25 la propuesta de cuatro pasos de onboarding y las ocho ayudas
del catálogo: «Todos los de ayuda estan perfectos». También fijó los responsables:
«tu escribes toda la parte de UI» y «se encarga del API claude code».

El patrón de Staff (spec 0088) ya separa orientación persistida y ayudas con `persist: false`.
El catálogo necesita conservar esa separación y cubrir una operación asíncrona que escribe
datos reales: seleccionar un PDF inicia el análisis; las fotos requieren «Analizar catálogo».
La importación agrega al catálogo directamente (ADR 0084), sin borrador ni aceptación manual.

## Decisiones

1. **Una orientación de cuatro pasos:** Importar con IA → Productos → Categorías → Ayuda.
   Señala controles y explica posibilidades; no importa archivos ni crea, edita o borra datos.
   Funciona con el catálogo vacío. Es el único recorrido nuevo que escribe progreso de
   onboarding, usando `tourId: catalog` y los estados existentes `completed` / `skipped`.
2. **Ocho ayudas independientes:** importar PDF, importar fotos en móvil, crear categoría,
   crear producto, editar producto, editar categoría, eliminar producto y eliminar categoría.
   Se ofrecen bajo Ayuda y nunca escriben progreso del onboarding. Las acciones son reales,
   manuales y pasan por los mismos controles y clientes HTTP que el uso normal de la pantalla.
3. **Codex es responsable de toda la UI:** componentes, copy en español, anchors, Driver.js,
   controlador de recorridos, estados locales, clientes HTTP del navegador, estilos y pruebas
   de interfaz. También del adaptador de permisos de `backoffice/catalog/page.tsx` y de la
   integración con el checklist. No se envían selectores ni pasos del tour desde el backend.
4. **Claude Code es responsable de la API:** rutas HTTP, autorización, aislamiento por negocio,
   reglas de dominio, persistencia, límites, integración con IA y migraciones. Los contratos
   de onboarding, catálogo e importación existentes alcanzan para esta entrega; no se pide
   desarrollar endpoints nuevos ni mover a la API la lógica de los recorridos.
5. **El avance representa un hecho de interfaz o un resultado confirmado.** Abrir un modal
   avanza cuando está montado; guardar o borrar avanza tras respuesta exitosa de la API.
   Un clic con validación fallida, respuesta fallida o selección de archivos cancelada no
   avanza. Durante el análisis se observa el estado del importador; no se usa la espera de
   un selector de Driver.js como reloj de la IA. Las acciones no se repiten al ir hacia atrás.
6. **Salir de la ayuda y cancelar una operación son acciones diferentes.** Cerrar el recorrido
   retira el spotlight y conserva el estado normal de la pantalla; no llama a `DELETE`, no
   cancela la importación y no guarda ni borra productos. Las acciones destructivas sólo se
   ejecutan al confirmar en el diálogo normal, con la entidad y las consecuencias visibles.
7. **La API sigue siendo autoridad.** La UI refleja `importInProgress` y los permisos; no
   deriva autorización del tour. El owner puede eliminar; el staff con `catalog` puede
   importar, crear y editar. Los límites y errores de importación vienen del contrato 0090.

Las decisiones de alcance y responsables provienen de la aprobación del owner. Las reglas
de avance, selección por identificador, limpieza y recuperación son el diseño técnico de la
propuesta aprobada, no citas adicionales atribuidas al owner.

## Consecuencias

- La spec 0096 es una entrega de UI que puede implementarse sin esperar cambios de backend.
- El catálogo conserva un único flujo operativo: un tour orienta al usuario sobre ese flujo.
- Los ajustes necesarios del motor compartido deben preservar Staff y Locales y tener pruebas
  de regresión; no se cambia el comportamiento de sus recorridos como parte de esta entrega.
- Un cambio futuro del contrato HTTP requiere coordinación previa: Claude Code documenta el
  cambio y Codex adapta el cliente. No se introducen respuestas simuladas como fallback de prod.
- Los tours no demuestran la precisión de la IA: el resultado se revisa y corrige en el catálogo.

## Referencias

- [Spec 0096](../specs/0096-tours-de-onboarding-y-ayuda-del-catalogo.md).
- ADR 0078 y specs 0084/0085: contenido local y progreso por negocio; sin recurso `guide`.
- Spec 0088: orientación de Staff y ayudas sin persistencia.
- ADR 0084/0086 y contrato 0090: escritura aditiva y bloqueo temporal del alta manual.

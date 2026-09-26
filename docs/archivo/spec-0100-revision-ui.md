# Revisión independiente — Spec 0100

Fecha: 2026-09-26. Estado: **PASS de revisión estática acotada**. No es un PASS
de pruebas automatizadas ni de QA visual/live.

El owner cambió expresamente la verificación durante implementación: asegurar que
compila, commit/push y QA live por su cuenta; no ejecutar más suites, navegador ni
mutaciones. Esta instrucción sustituye la ronda completa de pruebas prevista en
la spec para esta entrega. El revisor respetó ese alcance y no ejecutó casos.

## Handoff — Spec 0100

Estado: PASS — lectura independiente de contratos, diff y fuentes finales.

Archivos revisados:

- Spec 0100 completa, ADR 0090, `docs/AGENT-WORKFLOW.md`,
  `apps/merchant/AGENTS.md` y protocolo de verificación.
- `loyalty-tour-{controller,definitions,state,context,step,focus}`.
- `loyalty-page.tsx`, `program-editor.tsx`, `program-view.tsx`,
  `program-closing.tsx`, `loyalty-confirm-dialog.tsx`, pasos Términos/Premios,
  `use-loyalty-program.ts` y CSS añadido.
- Destino y test de `onboarding-view`; tres archivos E2E nuevos de tours, leídos
  como oráculos pendientes de ejecución.

Comandos ejecutados y resultado:

- `git diff --stat`, `git status --short`, `git diff --name-only` y diffs de
  archivos previstos: revisión de alcance y preservación de cambios externos.
- `cat`, `sed` y `rg` sobre los archivos anteriores: comprobación independiente
  de contratos y correcciones descritas abajo.
- Lectura de `/tmp/spec0100/typecheck.log`: root ejecutó `pnpm run typecheck`,
  3/3 tareas exitosas; Merchant ejecutado, Consumer/Platform desde caché.
- Lectura de `/tmp/spec0100/build.log` y `build-escalated.log`: build estándar
  no pasó Merchant por `TurbopackInternalError` / `Operation not permitted`
  al enlazar un puerto de PostCSS; Consumer/Platform desde caché. El retry fuera
  del sandbox reprodujo el error. No se declara verde ese comando.
- Lectura de `/tmp/spec0100/build-webpack-final.log`: alternativa Merchant
  `next build --webpack` sobre fuentes finales pasó compilación, TypeScript,
  generación de páginas y optimización. Root confirmó exit 0 de la sesión 21966.
  Consumer/Platform conservaron build válido desde caché según `build.log`.
  Este PASS de compilación compartido no es un PASS de suites ni producción.

## Contratos observados en fuentes

- [x] Un destino compartido conecta checklist `program` con parser
  `?tour=onboarding`. El controller sólo monta con contexto leído; elimina ese
  parámetro y conserva los demás. Lectura fallida bloquea nuevo inicio.
- [x] Autoinicio owner usa persistencia; repetición general y cuatro ayudas usan
  `persist:false`. Staff no autoinicia y no recibe opción de cierre.
- [x] Orientación distingue consulta activa, cierre y editor. Pasos informativos
  del editor no fabrican anchors avanzando el formulario.
- [x] Las ayudas observan el paso/modalidad actuales, validación y resultados
  estructurados de escritura. No guardan, seleccionan imágenes ni confirman
  cierre por el usuario.
- [x] Entrada a políticas cambia intención/paso sin llamar `populate` ni resetear
  diseño, premios o términos. Consume su intención para futuras ediciones.
- [x] La revisión valida el borrador completo y guardar mantiene un único PUT
  completo. No se agregó endpoint de políticas ni cambio backend/schema.
- [x] Éxito exige DTO de escritura válido y lectura válida. Refresh fallido
  muestra vista pendiente y recuperación GET; rechazo/resultado incierto
  conserva la recuperación normal. `attemptId` y sesión limitan resultados
  ajenos. La pérdida 401/403 dispone la guía sin persistir una elección.
- [x] DELETE permanece en confirmación normal; abrir/cancelar el diálogo no
  escribe. Salir de la guía no usa la X ni confirma descarte del editor.
- [x] Sin permiso de catálogo se conserva el camino existente sin consulta
  adicional; el copy sólo propone premios libres/descuentos.
- [x] Anchors de reglas abarcan métrica y reglas; política abarca checkbox,
  descripción y navegación. Hay un solo footer por paso.

## Hallazgos y correcciones revalidadas

1. Intención de políticas persistía al volver a montar el editor. La versión
   final llama `consumeEditorIntent()` y vuelve a cero después del salto.
2. Retorno de foco ocurría antes de habilitar Ayuda. La versión final usa
   `requestAnimationFrame` con guard de componente vivo.
3. `loyalty-rules` dejaba el detalle de reglas fuera del anchor. Ahora contiene
   hero y `dl` de acumulación/canje.
4. Política no incluía Continuar en el spotlight. Ahora recibe la navegación
   real del editor dentro de su sección, sin duplicarla.
5. El controller final bloquea inicio durante `loadError`. La hipótesis inicial
   de consumir onboarding en GET inicial fallido fue retirada tras leer la
   guarda de montaje de `loyalty-page`; no era un defecto reproducido.

El popover operativo se adopta dentro del diálogo/cropper activo para su scope
de foco/accesibilidad. Se revisó esa intención en código; su comportamiento
efectivo queda para QA live.

## Límites explícitos

- [ ] No se ejecutaron suites nuevas ni existentes por esta revisión.
- [ ] M1–M4 no se ejecutaron; no se afirma que los oráculos muerdan.
- [ ] No se verificaron interacciones, teclado, Escape, scroll, popovers, recorte,
  Alert visible ni geometría en 320/390/768/1280, light/dark/reduced motion.
- [ ] No se probaron en navegador HTTP demorado/rechazado, reintento de progreso,
  remount, staff/closing ni conservación efectiva de borrador e imagen.
- [ ] No se verificó producción, deploy, sesiones ni dispositivos reales.

La matriz temporal del revisor se preparó antes de la nueva instrucción del owner
y quedó sin ejecutar fuera del repositorio. Root informó un intento previo de
lanzamiento Chromium del implementador bloqueado antes de casos; su aprobación
se abortó con el cambio de alcance. Ninguno se cuenta como prueba pasada.

No quedan hallazgos bloqueantes de la lectura estática final. El owner realizará
el QA live; la entrega debe conservar estas limitaciones y la evidencia final
de compilación, sin presentar DoD automatizada completa.

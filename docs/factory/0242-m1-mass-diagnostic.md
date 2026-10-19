# 0242 M1 — diagnóstico de masa en candidato compilado

Ficha del coordinador previa a código. La regresión3a5b98a7/QA cbd8cd75 está
aceptada en main local5c158325. R1 acredita listado; R2 se prepara en grid y tiene
su propio autor. La evidencia nativa de masa a9d32924/QA29b8592c usa Next dev:
se reutiliza como funcional, sin atribuirle una ejecución M1 build/start.

Nuevo autor con contexto vacío, slot card tras factorycontinue de la entrega
aceptada. No reactivar al autor de regresión ni subdelegar. Dos implementadores y
un QA independiente siguen siendo el máximo; QA P6 actual conserva el bloque M1
sin aceptar y revisará este diagnóstico, sin añadir otro reviewer ni WT.

## Objetivo y paths exclusivos

Preparar offline un diagnóstico candidato-only que reutilice el recorrido nativo
existente con un COPY privado del candidato FRESH congelado de R2, sin recompilar
control ni modificar/iniciar el runtime fuente. Primero inventariar y proponer
el ajuste mínimo al coordinador; después implementar dentro de estos paths:

- `tools/pos-measurement/mass-native.mjs`.
- Nuevo `tools/pos-measurement/mass-native.test.mjs`, sólo si aporta negativos
  significativos de opt-in/runtime/identidad/antiPROD.
- `apps/merchant/src/modules/pos/server/mass-native.neon.integration.test.ts`.
- Nuevo `docs/factory/0242-m1-mass-handoff.md`.

La reserva factory conserva paths históricos por limitación de continue; este
encargo autoriza SÓLO los cuatro anteriores. No editar otros tests de regresión,
R2/m1.mjs, producto, kit, guards, schema, migraciones, contratos, índices o estados.
Harness explícitamente asignado bajo spec0225/0242; pedir paths antes de ampliarlos.
Conservar el modo Next dev por defecto y su evidencia histórica.

## Receta antes de datos

Un flujo NUEVO owner, masa0.75kg × tarifa4.123456789, pase real y cupón10%:
bruto3.09, descuento0.31, pago/neto2.78, dos puntos según programa existente.
Create/close/receipt/history/inspect y replay MISMO command/body/scope sin efectos
duplicados. Reutilizar oráculos exactos y fixtures de la prueba aceptada, no sus
identidades/cookies/QR ni ventas consumidas. Sin comparar tiempo con control, sin
sumarlo a R2, sin n inferencial ni gate temporal. Cámara sintética o ingreso de QR
se documenta: no certificar dispositivo físico ni homologarlo a R2 A/B.

Vincular runnerSHA propio, buildSourceSHA/BUILD_ID/freeze del candidato R2,
compiled/deps/config/schema y receta. COPY a namespace privado NUEVO, archivos0600,
fuente inmutable; sólo caches runtime autorizadas y observadas. Demostrar producto
compatible entre fuentes de runner mediante los scopes aceptados: los cambios
de regresión y harness no son código de producto. Si falta prueba, detener.

Autenticación legítima del actor nuevo, sujeta al bucket real y vigencia. No
fabricar sesión para el modo M1 ni resetear/rotar ledger/IP. No copiar env de PROD.
CI seleccionada protegida, antiPROD también con NODE_ENVproduction. DB sólo wrapper
`tools/neon-test.sh`, EXCLUSIVA durante setup/inspección/teardown. Reservar43242
sólo al ejecutar, en serie después de los lotes R2; conservar3201/túnel.

Fuera de closeConfirmed observar cola con criterio común explícito y quiescencia
del trabajo instrumentado antes de cerrar/parar. Conservar errores originales,
bytes desconocidos como null y todos los intentos. Fallo financiero detiene el
flujo; no compensar ni repetir venta. Ownership previo y SELECT0 durable de todo
lo creado antes de liberar DB; no sweep de nombres ni identidades anteriores.

## Recursos y aceptación

AHORA sólo preparación/código/checks offline y doc:p6-mass-m1. Sin DB, puertos,
build, copia de runtime real, fixture/login/servidor/browser ni ventas hasta QA
de fuente/receta y transferencia expresa del coordinador. El build R2 aún no
existe; no editar el WT grid ni esperar que lo haga este autor.

Node24, tipos/lint/formato proporcionales y negativos pertinentes. Commit limpio
sólo propio, SHA/handoff con límites e intentos; no factorydeliver por incremento.
QA independiente leerá fuente y verificará artefactos reales/effects/replay cuando
se ejecute. No screenshots, push, PROD ni nueva certificación hardware.

## Orden operativo actualizado

La ficha [recuperación baseline R2](0242-m1-baseline-compat.md) permite adelantar
el diagnóstico masa candidato-only después del cleanup auditado de D2 y de una
transferencia factory expresa. Sustituye sólo el orden posterior a R2 indicado
arriba; no concede aún ejecución ni cambia receta, paths, identidad o gates.

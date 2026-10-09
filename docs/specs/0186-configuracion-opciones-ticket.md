---
spec: 0186
fecha: 2026-10-09
estado: cerrada
resumen: Toggle visual Imprimir tickets en Configuración revela opciones nombre y mesa persistidas por API existente; impresión siempre activa.
disjunta: si
archivos: apps/merchant/src/app/backoffice/settings/pos-settings.tsx, apps/merchant/src/app/backoffice/settings/ticket-settings.tsx, tests/e2e/ticket-settings.spec.ts
---

# 0186 — Opciones del ticket en Configuración

L2, sesión principal sin subagentes (ADR0129), dev local sin push (ADR0128).

## Problema

Configuración solo renderiza el módulo POS en pos-settings.tsx. No consume
GET/PUT /api/merchant/business/ticket de 0184. Owner aclara: impresión siempre
activa; el nuevo toggle solo muestra/oculta las opciones, no requiere DB nueva.

## Alcance y diseño

Tarjeta Imprimir tickets para owner junto a POS. Switch del kit muestra opciones
con estado local inicialmente cerrado. Texto explica que configura el contenido;
cerrarlo conserva opciones e impresión. Mostrar nombre del comercio y Mostrar
mesa son Switch controlados por datos del GET, ambos falsos válido.

GET al montar la tarjeta owner, validación booleana, carga/error y botón de
reintento. Cambiar opción envía PUT con ambos booleanos, bloquea opciones durante
guardado mediante estado y ref síncrona; usa respuesta persistida y muestra
ConfirmationToast Opciones del ticket guardadas solo en éxito. Fallo muestra el
mensaje HTTP mediante posRequest y conserva configuración confirmada. Respuestas
tras desmontaje no publican datos. Sin owner no se monta ni consulta la tarjeta.

Contrato/permiso/aislamiento existentes de 0184: owner de sesión, errores HTTP
de posRequest (incluyendo403/422/503). No defaults UI ni writes en abrir/cerrar.
Toggle visual no se persiste. No cambios POS/printing/API/DB/kit/papel/QR.
Disjunta de0185: solo settings y nueva prueba.

## Definition of Done

- [ ] Abrir/cerrar no escribe; opciones sobreviven al cierre y GET tras reload.
- [ ] PUT envía ambos booleanos; false/false válido; éxito muestra toast compartido.
- [ ] Fallo conserva valor confirmado; carga fallida reintenta; dobles cambios bloqueados.
- [ ] Typecheck/lint merchant, formato/diff y guard UI sin incrementos.
- [ ] E2e específicos y regresión activación POS; capturas móvil/desktop vistas.
- [ ] Estado GPT actualizado. QA owner local pendiente; sin push ni gate live.

## Abierto

Nada. La aclaración owner reemplaza contrato-pendiente-activar-impresion:
no existe una activación de impresión que haya que persistir.

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

- [x] Abrir/cerrar no escribe; opciones sobreviven al cierre y GET tras reload.
- [x] PUT envía ambos booleanos; false/false válido; éxito muestra toast compartido.
- [x] Fallo conserva valor confirmado; carga fallida reintenta; dobles cambios bloqueados.
- [x] Typecheck/lint merchant, formato/diff y guard UI sin incrementos.
- [x] E2e específicos y regresión activación POS; capturas móvil/desktop vistas.
- [x] Estado GPT actualizado. QA owner local pendiente; sin push ni gate live.

## Abierto

Nada. La aclaración owner reemplaza contrato-pendiente-activar-impresion:
no existe una activación de impresión que haya que persistir.

## Verificación local

Typecheck y lint completos merchant en0; formato/diff verdes; guard de dos
archivos UI sin incrementos. Tres casos de ticket + regresión activación POS
verdes2.5s con harness aislado; final3casos2.8s tras esperar animación para
capturas390/1280 vistas. Comando: pnpm exec playwright test --config
/private/tmp/0183-playwright.config.ts tests/e2e/ticket-settings.spec.ts
tests/e2e/pos.spec.ts --grep "abrir/cerrar|fallo conserva ajustes|lectura fallida|activación y desactivación bloqueada".

Capturas /private/tmp/0186-configuracion-mobile.png y
/private/tmp/0186-configuracion-desktop.png. API simulada en navegador;
persistencia DB real delegada al PUT existente probado en0184, no se ejecutaron
writes reales ni migraciones. Sin cambios API/DB/kit/printing/POS, ni push.
Inicio de e2e global bloqueado por sandbox al abrir3100; harness aislado fuera
del sandbox verde. Dos intentos de clic al input oculto fallaron; corregida
prueba para tocar su label visible. QA real de Configuración queda al owner.

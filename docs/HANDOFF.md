# Handoff — Mi Pasaporte

**Fecha:** 2026-08-10  
**Estado:** diseño de producto y arquitectura pendiente; no existe implementación ni stack elegido.

## Punto de retorno

Leer en este orden:

1. `CLAUDE.md`
2. `docs/INDEX.md`
3. `docs/TASKS.md`
4. Este archivo
5. `docs/ARCHITECTURE.md`

No empezar código hasta definir la arquitectura transversal mediante ADRs y cerrar las
specs pertinentes.

## Próxima fase acordada

Definir la plataforma completa y su stack inicial en `docs/ARCHITECTURE.md`: framework
web/PWA, base de datos/multi-tenancy, autenticación por dominio, SMS OTP, email,
Apple/Google Wallet, hosting, secretos, observabilidad, testing y CI. Cada decisión se
registra como ADR. Recién después se completan rutas/archivos y comandos de test en specs
antes de implementar.

## Protocolo de agentes

`docs/AGENT-WORKFLOW.md` es obligatorio:

1. Orquestador revisa arquitectura, spec cerrada, ADRs, árbol y diff.
2. Implementador modifica código solo dentro de la spec cerrada y entrega evidencia.
3. Revisor independiente ejecuta pruebas y emite PASS/FAIL.
4. Solo PASS permite marcar una spec como `implementada`.

La plantilla `docs/specs/TEMPLATE.md` exige especificación técnica, DoD, pruebas y
handoff. No usar agentes para implementar mientras la arquitectura y la spec no estén
cerradas.

## Decisiones de producto vigentes

### Consumidor y wallet

- Cuenta de consumidor separada de todos los backoffices; teléfono + OTP, sin contraseña.
- Un QR de local crea un pasaporte guest; banner explica riesgo de pérdida.
- La cuenta registrada puede añadir email verificado para recuperación y un QR opaco,
  revocable, directo a Apple/Google Wallet.
- Wallet de dos capas: Mi Pasaporte emite check-ins, sellos y coleccionables; comercios
  emiten puntos, cupones y créditos de juego. No hay saldo global ni transferencias.
- Activos comerciales vencen según reglas del comercio; sellos/coleccionables no vencen.
- Guest: `inactive` tras 6 meses sin actividad iniciada por usuario; reactivable antes de
  12 meses; eliminado con activos a los 12 meses. Métricas quedan agregadas/anonimizadas.
- Spec principal: `docs/specs/0004-consumidor-checkin-y-wallet.md` (producto definido;
  dependencias técnicas provienen de arquitectura).

### Negocio, campañas y locales

- Owner puede tener N negocios; un negocio puede tener N owners y N locales.
- Programa de fidelización permanente: nivel negocio; locales activos lo heredan.
- Campaña: nivel negocio, asignable a N locales. Evento es un tipo de campaña, no entidad
  independiente.
- Categoría normal incluida en suscripción; destacado/ruta/resaltado es distribución de
  campaña potencialmente pagada, fuera de alcance hasta definir monetización.
- Cerrar un local no borra historial: detiene operación. Campañas sin locales activos se
  pausan; un cupón exclusivo del local cerrado queda no canjeable con razones visibles.

### Dominios de acceso

- Consumidor: wallet/descubrimiento, OTP por teléfono.
- Plataforma: `platform_admin` y `platform_staff`, backoffice exclusivo con email y
  contraseña. Alcance actualmente definido: clientes, negocios y locales.
- Comercio: `owner` y `merchant_staff`, backoffice separado del de plataforma.
- Merchant staff puede pertenecer a N negocios y N locales por negocio.
- Solo owner crea, edita, asigna, desactiva/reactiva y modifica permisos de merchant staff.
  Ni platform_admin ni platform_staff pueden hacerlo.
- Campañas se editan con permiso de negocio; un staff local puede operar campañas activas
  en sus locales, pero no cambiar su configuración global.
- Auditoría conserva referencias opcionales y snapshots inmutables de actor, rol, negocio,
  local y objeto/valores, incluso si la fuente fue eliminada.
- Spec principal: `docs/specs/0001-fundacion-identidad-y-roles.md` (aún no cerrada: falta
  definir las capacidades concretas del backoffice owner para terminar su matriz de permisos).

## Estado de documentación

- ADRs 0001–0010: ver `docs/INDEX.md`.
- Specs 0001–0009 existen, todas en `borrador`.
- Roadmap: `docs/ROADMAP-V1.md`.
- Investigación y comparación: archivos `IDEA-*`, `COMPARACION-IDEAS-CUENCA.md`,
  `INVESTIGACION-MI-PASAPORTE.md` en la raíz.
- No hay código de aplicación, `package.json`, tests ni stack configurado.

## Advertencias de consistencia

- No mezclar identidad/sesión de consumidor con backoffice de plataforma o comercio.
- No llamar cupón a un crédito de juego: ambos son beneficios de comercio, pero tienen
  ciclos de vida distintos.
- No tratar el cierre de local como delete.
- Los backoffices de plataforma solo incluyen clientes, negocios y locales hasta que una
  feature futura defina explícitamente algo más.

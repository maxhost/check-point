---
spec: 0033
fecha: 2026-08-14
estado: borrador
resumen: Canal de actualización y push del pase de Wallet — web service REST de PassKit (registro de dispositivos + APNs) para Apple y `PATCH`/`addMessage` para Google, con notificaciones scopeadas por conjunto de destinatarios (miembros de un negocio) y rotación/revocación del pase ante pérdida de dispositivo.
disjunta: no
archivos: por definir (depende de 0029 y del ADR 0033)
---

# 0033 — Canal de actualización y push de Wallet

> **Stub — reserva de alcance.** No cerrada. Se separa de la 0029 por decisión del owner
> (2026-08-14): el web service de actualización es suficiente trabajo production-grade para su
> propia spec. Depende de la spec **0029** (pase emitido con los ganchos `webServiceURL` +
> `authenticationToken` ya provisionados y el registro `wallet_pass`) y del **ADR 0033**.

## Problema

La spec 0029 emite el pase de identidad con los ganchos de actualización provisionados, pero
nadie responde a esos ganchos todavía: el pase no se puede actualizar ni notificar. El loop de
la 0031 (aviso "La Gringa te dio un sello") necesita un canal de push funcionando. Además, ante
**pérdida de dispositivo**, hoy no hay forma de revocar/rotar el pase.

## Alcance (tentativo)

**Entra:**

- **Apple — web service REST de PassKit** que responde a los ganchos del pase: registrar/
  desregistrar un dispositivo para un pase, listar seriales actualizados desde una marca de
  tiempo, servir la última versión del pase, y autenticar cada request con el
  `authenticationToken` del pase (`auth_token_hash` de `wallet_pass`, 0029). Tabla nueva de
  **registros de dispositivo** (device library id + push token APNs por pase).
- **Apple — APNs**: enviar el push "tu pase cambió" (auth key `.p8`, HTTP/2). Nuevo secreto de
  entorno.
- **Google — `PATCH`/`addMessage`** sobre el Loyalty Object para actualizar el pase y empujar
  mensajes/notificaciones.
- **Notificaciones scopeadas por destinatario** (ADR 0033): un aviso "para miembros de Bar B"
  se dirige al **conjunto de consumidores miembros de Bar B** (calculado desde
  `program_membership`), no al pase compartido; un no-miembro no es alcanzable.
- **Rotación/revocación del pase**: ante pérdida de dispositivo, rotar `qr_token`/
  `web_view_token` y empujar la actualización (invalida el pase viejo).

**No entra:** el otorgamiento que dispara el aviso (0030); el contenido/UX de la landing en vivo
para consumidores sin pase (0031); notificaciones de marketing/campañas (futuro, tier Plus).

## Dependencias

- **Spec 0029** — pase emitido con ganchos + `wallet_pass`.
- **ADR 0033** — proveedor de Wallet, notificaciones scopeadas por destinatario, ciclo de vida
  como identidad.
- **ADR 0013** — proveedores intercambiables (APNs como uno más).
- **ADR 0024** — secretos en entorno (APNs `.p8`).

## Abierto (bloquea el cierre)

- Materialización de una notificación en cada proveedor: Apple (campo del pase + `changeMessage`
  + APNs pull) vs Google (`addMessage`) — cómo se ve "La Gringa te dio un sello" en cada uno, y
  qué pasa si varios negocios notifican al mismo consumidor cerca en el tiempo (el pase es único).
- Modelo de registros de dispositivo y manejo de push tokens APNs (expiración, desregistro).
- Estrategia de rotación/revocación ante pérdida de dispositivo y su interacción con el
  `qr_token` ya en circulación (invalidar sin romper a los demás dispositivos legítimos).
- Autenticación y rate-limit del web service público de PassKit.

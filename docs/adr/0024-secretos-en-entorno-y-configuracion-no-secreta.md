---
fecha: 2026-08-11
resumen: Credenciales de proveedores viven en el gestor de secretos del entorno; la base sólo puede guardar configuración no secreta, auditada y separada por entorno.
estado: aceptada
---

# ADR 0024 — Secretos en entorno y configuración no secreta

## Decisión

Las claves privadas de Stripe, secretos de webhook, credenciales de Neon, secreto de
Better Auth, credenciales R2 y tokens Mapbox de servidor viven exclusivamente en el gestor
de secretos del entorno (desarrollo local/Vercel). Nunca se guardan en una tabla `Settings`,
ni siquiera cifrados por la aplicación: la clave para descifrarlos seguiría requiriendo un
secreto externo y aumentaría superficie de exposición, backup y auditoría.

`core` puede conservar configuración **no secreta** y de producto, separada por entorno y
auditada: Price IDs de Stripe, moneda, países de búsqueda Mapbox, feature flags y límites
de plan. Sólo procesos de plataforma autorizados pueden modificarla; el cliente no puede
leer configuraciones internas ni elegir entorno. Stripe Price IDs no son secretos, pero
se validan contra el entorno de la clave servidor antes de crear Checkout.

## Consecuencias

- Cambiar de test a live requiere cambiar el conjunto de secretos del despliegue; no hay
  interruptor de runtime expuesto a owners.
- Cambios frecuentes de producto, como Price IDs o países habilitados, no requieren editar
  variables de Vercel una vez exista la configuración interna auditada.
- Al inicio se puede bootstrappear la configuración no secreta con una migración/CLI
  autorizada; no se crea una pantalla Settings pública como atajo.

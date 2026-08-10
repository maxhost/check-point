---
fecha: 2026-08-10
resumen: Consumidor, plataforma y comercio usan dominios de acceso y backoffices separados; no comparten sesión ni roles.
---

# ADR 0010 — Dominios de acceso separados

## Contexto

Mi Pasaporte tiene usuarios consumidores, operación interna de plataforma y operación de comercios. Estas superficies tienen riesgos, credenciales, navegación y permisos distintos. Representarlas como roles de una cuenta única mezclaría el wallet de un consumidor con backoffices sensibles.

## Decisión

Existen tres dominios independientes:

1. **Consumidor:** cuenta de Mi Pasaporte, teléfono + OTP, wallet y descubrimiento. Se define en spec 0004.
2. **Plataforma:** `platform_admin` y `platform_staff`, con backoffice exclusivo, registro mediante email y contraseña. En el alcance actual solo administran clientes, negocios y locales.
3. **Comercio:** `owner` y `merchant_staff`, con backoffice de comercio separado del backoffice de plataforma. Un owner tiene control de sus negocios; un merchant staff ve el mismo backoffice con los límites de sus permisos y además una página operativa específica para escanear QR, asignar y validar beneficios.

Las sesiones, rutas y autorizaciones de los tres dominios son independientes. No hay acceso automático entre ellos aunque una misma persona física use más de uno.

Un negocio puede tener N owners; un owner puede participar en N negocios. Un merchant staff puede pertenecer a N negocios y N locales por negocio.

## Consecuencias

- No se reutiliza una sesión OTP de consumidor para entrar a backoffices.
- El backoffice de plataforma no adelanta permisos para campañas, wallet u operación de comercios hasta que esas features existan y se definan.
- La autenticación concreta del backoffice de comercio se cerrará dentro de la decisión de arquitectura/autenticación correspondiente, sin mezclarla con la de consumidor.

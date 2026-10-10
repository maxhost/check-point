---
adr: 0135
fecha: 2026-10-10
estado: aceptada
resumen: El panel de plataforma (`apps/platform`, `admin.checkpass.club`) nace minimo — ver los comercios y extender o acortar su prueba — con login por link al correo SOLO para una lista blanca de correos (`PLATFORM_ADMIN_EMAILS`), identidad propia en el esquema `platform_auth` (ADR 0012) y registro de cada cambio. Reusa el kit de UI del comercio importandolo desde `apps/merchant/src/ui` (sin moverlo) y lo construye Claude entero, pantallas incluidas: excepcion de zona del ADR 0114 acotada a esta app.
---

# 0135 — Panel de plataforma minimo

## Contexto

ADR 0134 §3: la fecha de fin de la prueba se guarda para que el owner la extienda mientras crece la red; hasta hoy lo
hace Claude por SQL con la skill `/extender-prueba`. El owner, 2026-10-10: «panel de owner al menos una vista basica
donde pueda ver los merchant que se registraron, cuando lo hicieron y en cuanto tiempo se les bloquea… para añadirles o
estirarles la fecha». `apps/platform` existe desde el ADR 0011 y solo tiene `/api/health`; ADR 0106 le asigna
`admin.checkpass.club`; ADR 0012 previo un esquema `platform_auth` que nunca se creo.

## Decision

Del owner (2026-10-10): login por link al correo; alcance de la primera version = ver los comercios + extender o
acortar la prueba (suspender/cerrar, cobro de Stripe y numeros de la red quedan afuera); Claude hace todo, pantallas
incluidas; nivel L2.

1. **Identidad propia.** Better Auth dentro de `apps/platform` con tablas en `platform_auth` (migracion aditiva), su
   propio secreto y su cookie en `admin.checkpass.club`. Nada se comparte con `merchant_auth`: una sesion de comercio
   no abre el panel ni al reves.
2. **Lista blanca en el entorno.** `PLATFORM_ADMIN_EMAILS` (separados por coma). Se mira al pedir el link (un correo
   fuera de la lista recibe la misma respuesta y ningun mail) **y en cada request** sobre el email de la sesion: sacar
   un correo de la variable corta el acceso en el proximo request sin tocar la base. Sin variable o vacia, nadie entra
   (fail-closed).
3. **Toda escritura deja registro** en `platform_auth.audit_log` (quien, que comercio, antes, despues, cuando).
4. **El kit de UI se importa de donde esta** (`apps/merchant/src/ui`, por ruta relativa), medido el 2026-10-10:
   `next build` y `tsc --noEmit` de `apps/platform` verdes con una pagina que importa `Button` y `Text`. Moverlo a un
   paquete tocaria el `globals.css` del comercio, `tools/zone-audit.ts` y el flujo de GPT por una app interna. **Salida
   declarada:** si un tercer consumidor lo necesita o un cambio del kit rompe el panel, se mueve a `packages/ui`.
5. **El envio de correo pasa a `packages/domain`** (`server/email/*`): hoy vive en el merchant y lo importan 2
   archivos. Un solo adaptador de Resend para las dos apps.
6. **Excepcion de zona (ADR 0114):** `apps/platform` es zona Claude entera, pantallas incluidas. El resto del ADR 0114
   no cambia. GPT puede tocar el kit como siempre; el panel es un consumidor mas.

## Consecuencias

- Un 4.º proyecto de Vercel (`apps/platform`, dominio `admin.checkpass.club`): cada push a `main` son 4 deploys de los
  100 diarios de Hobby. Lo crea Claude con OK del owner o el owner en el dashboard.
- Variables nuevas en ese proyecto: `DATABASE_URL`, `PLATFORM_AUTH_SECRET`, `PLATFORM_AUTH_URL`,
  `PLATFORM_ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`.
- La skill `/extender-prueba` se borra: el panel la reemplaza (tambien en local, para el QA del bloqueo).
- Las campañas de un comercio desbloqueado desde el panel vuelven en el barrido diario (hasta ~24 h); panel,
  mostrador y POS vuelven en el acto (ADR 0134, Consecuencias).

Implementacion: spec 0190.

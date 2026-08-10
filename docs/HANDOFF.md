# Handoff — Mi Pasaporte

**Fecha:** 2026-08-10
**Estado:** documentación y arquitectura preparadas; scaffold aún no implementado.

## Punto de retorno

Leer en este orden:

1. `CLAUDE.md`
2. `docs/INDEX.md`
3. `docs/TASKS.md`
4. este archivo
5. `docs/ARCHITECTURE.md`
6. `docs/specs/0010-scaffold-production-grade.md`

## Próximo trabajo

Revisar y cerrar la Spec 0010; después implementar el scaffold con el protocolo obligatorio:

1. Orquestador revisa spec, ADRs, árbol y diff.
2. Implementador crea sólo lo autorizado por la spec.
3. Revisor independiente ejecuta pruebas y emite PASS/FAIL.
4. Sólo PASS marca la spec como implementada.

No crear código antes de que 0010 esté en `cerrada`.

## Arquitectura propuesta

- Monorepo TypeScript: pnpm + Turborepo.
- Tres Next.js aislados: consumer PWA, merchant backoffice y platform backoffice.
- Neon Postgres + Drizzle; Better Auth autoalojado, no Neon Auth gestionado.
- Esquemas de identidad separados: `consumer_auth`, `merchant_auth`, `platform_auth`; datos de producto en `core`.
- Consumidor: guest/anónimo + teléfono OTP, sin contraseña. Comercio/plataforma: email/contraseña.
- OTP abstraído: piloto Telnyx Verify y fallback Twilio Verify; aún sin credenciales.
- Desarrollo local ahora; Vercel Pro sólo cuando exista piloto comercial.
- Cron futuro: Vercel Cron + ejecuciones idempotentes.
- QR: local, cuenta y cupón separados; token de cuenta opaco/revocable; canje atómico.
- Check-in: QR estático inicia `checkin_challenge` único de vida corta + geo puntual, precisión, distancia y frecuencia. Esto reduce fraude, no prueba presencia infalible.
- Operación merchant: superficie distinta al dashboard; escaneo + máximo dos toques + confirmación objetivo menor a dos segundos, siempre online e idempotente.
- Production grade es obligatorio por ADR 0017.

## AR y juegos

- V1 sólo ruleta y raspadita web; resultado autorizado por servidor antes de la animación.
- AR posterior: cámara **dentro de la PWA/browser**, no app nativa externa.
- Dirección elegida: 8th Wall autoalojado para tracking + three.js para render/objetos virtuales; WebXR no es requisito.
- Vaso/dardos/tesoro: un marcador visual con branding ancla el objetivo físico; bola o dardo es virtual. No se rastrean objetos físicos reales en primera versión AR.
- Antes de AR: spike en Safari iOS y Chrome Android de los teléfonos objetivo; medir permisos, tracking, FPS, calor y batería. Todo juego AR tiene alternativa 2D y no emite premios altos sólo por física del cliente.

## Spec 0010 — estado

Archivo: `docs/specs/0010-scaffold-production-grade.md`
Estado: `borrador`.

Decisiones ya incorporadas:

- Node **24.19.0 LTS**, pnpm **11.4.0**, Next.js **16.3.0**, React/React DOM **19.2.8**.
- Tres apps en puertos 3000/3001/3002.
- Sin páginas, UI, auth, DB, secretos ni paquetes vacíos.
- Únicamente `GET /api/health` por app.
- TypeScript estricto, ESLint, Prettier, Vitest, Playwright, GitHub Actions y Dependabot.
- Los smoke tests validan los tres health checks.
- Todos los scripts: install congelado, format check, lint, typecheck, test, E2E y build.
- Abierto únicamente el cierre formal de la spec antes de código.

## Producto vigente

- Wallet consumidor separa activos de Mi Pasaporte (check-in, sellos, coleccionables) de activos por comercio (puntos, cupones, créditos de juego). No hay puntos globales ni transferencias.
- Guest: inactivo a 6 meses de actividad iniciada por usuario; eliminación a 12 meses; cuentas registradas no siguen esa eliminación.
- Owner: N negocios; negocio: N owners y locales. Programa/campañas viven a nivel negocio; campañas se asignan a N locales; evento es campaña.
- Cierre de local preserva historia y vuelve beneficios no elegibles si aplican sólo allí.
- Dominios separados: consumer, merchant (owner/staff), platform (admin/staff). Sólo owner administra merchant staff.
- Auditoría conserva snapshots aunque fuente se elimine.

## Repositorio

Canónico: https://github.com/maxhost/check-point.git
Política: commits y pushes directos a `main` con autorización explícita del fundador. Ver `docs/REPOSITORY.md`.

Estado local:

- `origin` está configurado correctamente.
- `main` tiene los commits:
  - `6467628 document product architecture and scaffold plan`
  - `80a5d2b record initial repository publication state`
- Push bloqueado: este entorno no resuelve `github.com`; MCP GitHub requiere reautenticación y `gh auth status` reporta tokens inválidos.
- Cuando red/autenticación estén disponibles: `git push -u origin main`.

## Documentos clave

- Arquitectura: `docs/ARCHITECTURE.md`
- Plan de scaffold: `docs/SCAFFOLD-PLAN.md`
- Spec de scaffold: `docs/specs/0010-scaffold-production-grade.md`
- Proceso agentes: `docs/AGENT-WORKFLOW.md`
- Estado actual: `docs/TASKS.md`
- Índice: `docs/INDEX.md`

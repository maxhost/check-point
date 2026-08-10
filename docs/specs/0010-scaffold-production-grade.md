---
spec: 0010
fecha: 2026-08-10
estado: cerrada
resumen: Inicializa el monorepo reproducible, tres aplicaciones aisladas y controles de calidad, sin comportamiento de producto.
disjunta: no
archivos: raiz del repositorio, apps/consumer, apps/merchant, apps/platform, tests/e2e, .github/workflows
---

# 0010 — Scaffold production grade de la plataforma

> **Nada de código empieza sin esta spec en `cerrada`.**

## Problema

El repositorio contiene decisiones de producto, arquitectura y proceso, pero no un entorno de código reproducible. Sin un scaffold común, cada primera feature podría elegir versiones, scripts, estructura y controles distintos; eso rompería la separación entre consumidor, comercio y plataforma antes de que exista código de negocio.

## Alcance

**Entra:**

- Monorepo TypeScript administrado por pnpm 11.4.0 y Turborepo.
- Node.js 24.19.0 LTS fijado para desarrollo y CI.
- Tres aplicaciones Next.js 16.3.0 con React/React DOM 19.2.8: consumer, merchant y platform.
- Cada app expone únicamente un endpoint público de salud que responde nombre de app y estado `ok`; no hay páginas, UI ni rutas de producto. El endpoint no autentica, no consulta base de datos ni revela variables de entorno.
- Configuración compartida de TypeScript estricto, ESLint, Prettier, Vitest, Playwright y scripts raíz reproducibles.
- Pruebas de humo de navegador para las tres páginas y sus endpoints de salud.
- GitHub Actions que instala dependencias de forma congelada y ejecuta format check, lint, typecheck, tests, pruebas E2E y build.
- Archivos de entorno de ejemplo sin secretos, `.gitignore`, README de arranque y reglas de actualización de dependencias.

**No entra:**

- Neon, Drizzle, Better Auth, tablas, migraciones, sesiones, roles, QR, geolocalización, Wallet, cron, Redis, Sentry, proveedores SMS/email ni secretos.
- UI, rutas, endpoints o modelos de cualquier feature de producto.
- Despliegue Vercel, dominios, cuentas de proveedor, credenciales o un piloto público.
- Paquetes vacíos para db, auth, domain, contracts o ui. Se crean cuando una spec cerrada los consume.
- Cambiar la configuración de Claude, los ADR de producto o specs 0001–0009.

## Diseño

La raíz define el workspace y scripts únicos. Las apps viven en apps/consumer, apps/merchant y apps/platform, sin importarse entre sí. Comparten únicamente las herramientas configuradas desde la raíz; no existe aún un paquete de código compartido porque ningún contrato de producto está implementado.

Cada aplicación se identifica sólo por un nombre público fijo para su health check. El endpoint devuelve HTTP 200 y JSON con `service` y `status: "ok"`. No tendrá versión de base, hostname interno, commit, secretos ni detalle de dependencias.

Las aplicaciones usan Next.js App Router, TypeScript estricto y runtime Node. El único artefacto de aplicación es la ruta de health; no se crea página raíz ni layout visual. La PWA de consumidor no registra aún service worker ni manifiesto; esto llega con la Spec 0004, cuando se definan los requisitos de instalación, cache y sesión. Los backoffices no comparten cookies ni configuración de dominio: esta separación se concreta al introducir autenticación en Spec 0001.

Las dependencias de producción y desarrollo se fijan mediante rangos exactos en manifests y el lockfile de pnpm se versiona. Node queda fijado en `.node-version` y el campo `engines`; pnpm queda fijado en el campo `packageManager`. La actualización de dependencias se hace sólo mediante pull request y controles completos, nunca por instalación implícita.

El código debe pasar TypeScript, lint y formato desde la raíz. Vitest cubre el contrato puro del endpoint de salud y Playwright realiza solicitudes HTTP contra los tres health checks arrancados localmente. La ejecución E2E levanta las tres apps con los scripts declarados, espera disponibilidad y las detiene al finalizar.

GitHub Actions reproduce exactamente los scripts de raíz sobre Linux y Node fijado. El workflow no despliega, no usa secretos y falla ante lockfile desactualizado.

### Especificación técnica

**Árbol permitido tras implementar:**

    apps/
      consumer/
      merchant/
      platform/
    tests/e2e/
    .github/workflows/
    package.json
    pnpm-lock.yaml
    pnpm-workspace.yaml
    turbo.json
    tsconfig.base.json
    eslint.config.*
    prettier.config.*
    vitest.workspace.*
    playwright.config.*
    .node-version
    .gitignore
    .env.example
    README.md
    dependabot configuration

**Scripts de raíz obligatorios:**

- `pnpm dev`: inicia las tres apps mediante Turbo.
- `pnpm dev:consumer`, `pnpm dev:merchant`, `pnpm dev:platform`: inicia una sola app.
- `pnpm format:check`: comprueba formato sin escribir.
- `pnpm lint`: ejecuta ESLint en el workspace.
- `pnpm typecheck`: ejecuta chequeo TypeScript sin emitir.
- `pnpm test`: ejecuta Vitest.
- `pnpm test:e2e`: ejecuta Playwright en los tres smoke tests.
- `pnpm build`: compila las tres apps por Turbo.

**Puertos de desarrollo:** consumer 3000, merchant 3001, platform 3002. Si un puerto está ocupado, el proceso debe fallar con error claro; no tomar otro puerto silenciosamente, porque Playwright debe apuntar a URLs deterministas.

**Health contract:**

- `GET /api/health` de cada app: HTTP 200, cabecera `content-type: application/json`, cuerpo exacto con campos `service` (`consumer`, `merchant` o `platform`) y `status` (`ok`).
- Métodos distintos de GET reciben 405 o la respuesta estándar de Next para método no admitido.
- No hay cache compartido ni dependencia externa.

**Entorno y seguridad:**

- `.env.example` declara únicamente variables que el scaffold consume. Como ninguna app necesita secreto aún, puede estar vacío con comentario explicativo; `.env*` queda ignorado salvo `.env.example`.
- CI y pruebas no dependen de una variable de entorno real.
- No se incorporan claves, URLs de Neon ni credenciales de proveedor.

### Arquitectura de referencia

- ADR 0010 — dominios de acceso separados.
- ADR 0011 — monorepo y despliegues separados.
- ADR 0012 — identidades separadas; aún no se implementa auth.
- ADR 0016 — superficie operativa rápida; aún no se implementa UI de operación.
- ADR 0017 — estándar production grade.
- docs/ARCHITECTURE.md y docs/SCAFFOLD-PLAN.md.

## Archivos

| Archivo | Acción |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.node-version`, `tsconfig.base.json` | crear |
| `eslint.config.*`, `prettier.config.*`, `vitest.workspace.*`, `playwright.config.*` | crear |
| `apps/consumer/**`, `apps/merchant/**`, `apps/platform/**` | crear |
| `tests/e2e/**` | crear |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | crear |
| `.gitignore`, `.env.example`, `README.md` | crear |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | editar al cerrar/entregar |

### Disjunta?

No. Toca la raíz, donde se apoyan todas las specs posteriores. Debe terminar antes de implementar 0001–0009.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Estructura de workspace, comandos y apps | Implementación de 0010 | Antes de cualquier spec de producto |

## Definition of Done

- [ ] Node 24.19.0 LTS, pnpm 11.4.0, Next.js 16.3.0 y React/React DOM 19.2.8 están fijados y documentados.
- [ ] Un checkout limpio instala exactamente el lockfile con `pnpm install --frozen-lockfile`.
- [ ] `pnpm dev` inicia consumer, merchant y platform en puertos 3000, 3001 y 3002.
- [ ] Cada aplicación expone únicamente `GET /api/health` y cumple el contrato exacto.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` y `pnpm build` terminan exitosamente.
- [ ] CI ejecuta los mismos controles sin secretos ni despliegue.
- [ ] No hay auth, base de datos, secretos, endpoints de producto ni paquetes vacíos fuera del alcance.
- [ ] El revisor independiente emite PASS conforme a `docs/AGENT-WORKFLOW.md`.
- [ ] Índice, tareas y handoff describen el estado real.

## Plan de pruebas y verificación

- [ ] Prueba unitaria: cada implementación de health devuelve el service correcto y `status: "ok"`.
- [ ] Prueba E2E: Playwright realiza solicitudes contra los tres health endpoints y verifica HTTP 200 y el JSON correspondiente.
- [ ] Regresión: `pnpm install --frozen-lockfile` falla si el manifest y lockfile no corresponden.
- [ ] Seguridad: inspección del diff confirma que no existe `.env` con valores, secretos ni URL de proveedores.
- [ ] CI: inspección del workflow verifica Node/pnpm fijados y los seis controles exigidos.
- [ ] Comandos exactos: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.
- [ ] Verificación manual: abrir las tres rutas `localhost:3000/api/health`, `localhost:3001/api/health` y `localhost:3002/api/health`; comprobar nombre correcto y respuesta 200.

## Handoff requerido

El implementador y el revisor usan el formato de `docs/AGENT-WORKFLOW.md`. El revisor debe producir un PASS independiente antes de marcar la spec como `implementada`.

## Abierto

No hay abiertos que bloqueen esta implementación. El remoto público canónico es
`https://github.com/maxhost/check-point.git`; la publicación queda condicionada sólo por
la conectividad/autenticación externa disponible al terminar.

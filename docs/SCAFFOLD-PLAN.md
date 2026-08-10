# Plan de lanzamiento del scaffold

## Objetivo

Crear un entorno reproducible y verificable para implementar specs, sin introducir aún comportamiento de producto. Al terminar, un agente puede clonar el repositorio, levantar las tres aplicaciones, ejecutar controles y saber dónde colocar una feature.

No se crea autenticación, tablas de producto, QR ni pantallas de negocio durante este scaffold. Esas decisiones pertenecen a sus specs cerradas.

## Gate previo

Antes de código se confirman los ADR de stack todavía en propuesta (0011–0016). Para el scaffold no se necesitan secretos ni cuentas de producción; se usan contratos de entorno y valores locales de ejemplo.

## Fase 1 — Cerrar Spec 0010: scaffold de plataforma

La spec debe definir alcance exacto del monorepo y de consumer, merchant y platform; versiones soportadas de Node/pnpm; paquetes necesarios desde el día uno; TypeScript estricto, lint, formato, pruebas y build; contrato de entorno sin secretos; CI, DoD, comandos de revisión, archivos permitidos y exclusiones.

No se crean carpetas vacías por anticipación. La spec no se cierra hasta justificar cada paquete inicial.

## Fase 2 — Implementar el scaffold

1. Orquestador: verifica Spec 0010, ADRs 0011, 0012, 0016 y 0017, estado del repositorio, comandos y archivos previstos.
2. Implementador: inicializa monorepo, tres apps mínimas compilables y sólo paquetes justificados. Añade scripts y pruebas de humo.
3. Revisor independiente: parte de spec y diff; ejecuta comandos y comprueba que no haya secretos, código de producto ni mezcla de dominios de acceso.

La salida es PASS/FAIL documentado. Sólo PASS permite declarar el scaffold hecho.

## Fase 3 — Base operativa antes de la primera feature

- Repositorio remoto y protección de rama.
- CI ejecutando format, lint, typecheck, test y build en cada pull request.
- Entornos local, preview y production, con secretos separados.
- Conexión Neon de desarrollo y migraciones de prueba.
- Sentry cuando exista un entorno desplegado.
- Credenciales Telnyx/Twilio, Resend y Wallet sólo cuando una spec las consuma.

No se abre piloto comercial ni se paga Vercel Pro hasta tener un flujo desplegable que realmente lo necesite.

## Fase 4 — Primera feature de producto

Con scaffold aprobado, se vuelve a cerrar Spec 0001. Es la primera implementación de dominio: identidades de comercio/plataforma, membresías y auditoría. Better Auth y Neon pasan de decisión arquitectónica a integración real sólo con esa spec cerrada.

## Definition of Done del scaffold

- [ ] Un checkout limpio instala dependencias con un comando documentado.
- [ ] Las tres aplicaciones arrancan localmente, compilan de forma independiente y exponen únicamente su health check.
- [ ] TypeScript estricto, lint, formato y tests están configurados y pasan.
- [ ] CI reproduce los mismos comandos del entorno local.
- [ ] No hay secretos en el repositorio; existe plantilla de entorno validada.
- [ ] La estructura no contiene auth, tablas, endpoints ni UI de producto no especificados.
- [ ] El revisor independiente emite PASS con evidencia de comandos.
- [ ] TASKS, índice y handoff reflejan el estado real.

## Comandos objetivo

Los nombres exactos se fijarán en Spec 0010, pero el contrato será:

    pnpm install --frozen-lockfile
    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

# Handoff — UI mobile-first de CheckPass Club

Actualizado: 18 de septiembre de 2026.

Este archivo permite retomar el encargo después de limpiar el contexto. La fuente completa del pedido es `docs/encargo-ui-chatgpt.md`; este handoff no la reemplaza.

## Estado por fases

### Fase 0 — completa

- Entregable: `docs/ux-research.md`.
- Incluye fuentes y decisiones explícitas sobre uso a una mano, objetivos táctiles, formularios, wizard, WCAG 2.2 AA y adaptación responsive.
- Decisiones principales: mínimo táctil de 44 px, controles principales de 48 px, progreso “Paso N de 3”, validación por paso, preservación del estado, foco reforzado y breakpoints iniciales en 640/1024 px.

### Fase 1 — completa y actualizada

Se leyeron completos, en orden:

1. `docs/specs/0067-contratos-de-api.md`
2. `docs/specs/0069-contratos-de-api.md`
3. `docs/specs/0072-contratos-de-api.md`
4. `docs/adr/0070-el-alta-del-comercio-es-un-wizard-de-tres-pantallas.md`

Después de esa lectura apareció en disco una versión actualizada del encargo que agrega como cuarto contrato obligatorio:

- `docs/specs/0074-contratos-de-api.md`

Se leyó completo el 0074 y se revisó especialmente su §4. El wizard construye contra `GET /api/onboarding/state`; mientras la ruta no esté desplegada, el fallback de desarrollo queda aislado detrás de un solo módulo y usa exactamente la forma contratada.

No usar `GET /api/auth/get-session`: el encargo actualizado ordena usar `GET /api/merchant/session`.

### Fase 2 — completa en código fuente

Entregables:

- `apps/merchant/src/ui/tokens.css`: único origen de color del sistema nuevo; modos claro/oscuro, roles semánticos, reducción de movimiento y `@theme` de Tailwind.
- `apps/merchant/src/ui/`: catálogo base con React Aria Components e Iconoir.
- `docs/design-system.md`: propósito, props, estados y ejemplos.
- `apps/merchant/scripts/check-design-contrast.mjs`: comprobación automatizada.
- `apps/merchant/postcss.config.mjs`: integración Tailwind/PostCSS.

Componentes disponibles:

- `ApiError`
- `Button`
- `TextField`
- `SelectField`
- `NumberField`
- `Alert`
- `ProgressIndicator`
- `BrandTheme`

Extensiones posteriores al contrato 0074:

- `ApiError` centraliza los cinco códigos del gate del owner y ejecuta la solicitud contratada de verificación de email.
- `BrandTheme` elige foreground claro/oscuro por luminancia y deriva hover/pressed accesibles en runtime. Los valores inválidos conservan los fallbacks de tokens.

Dependencias verificadas en `node_modules` y `pnpm-lock.yaml`:

- `react-aria-components` 1.21.1
- `tailwindcss` 4.3.3
- `@tailwindcss/postcss` 4.3.3
- `iconoir-react` 7.11.0

Los rangos declarados en `apps/merchant/package.json` son compatibles y el lockfile fija las versiones instaladas.

Validaciones:

- `pnpm --filter @mi-pasaporte/merchant check:design-contrast`: **38/38 PASS**.
- El typecheck inicial, antes de regenerar `.next/types`, pasó y confirmó que los componentes nuevos son compatibles con React Aria 1.21.1. Después del intento de build, Next regeneró sus tipos y el comando global queda en rojo por el mismo problema ajeno de billing: `apps/merchant/src/app/api/billing/cancel/route.ts` exporta `downgradeToFree`, algo no admitido por un Route Handler.
- Build con webpack: compila los assets correctamente y luego falla en un problema ajeno al sistema nuevo: `apps/merchant/src/app/api/billing/cancel/route.ts` exporta `downgradeToFree`, export no admitido por un Route Handler de Next.
- Build normal/Turbopack en el sandbox: no verificable porque el proceso interno intenta abrir un puerto y recibe `Operation not permitted`.
- El entorno actual usa Node 22.22.2, pero el repo declara Node `>=24.20.0 <25`; pnpm muestra la advertencia en cada comando.

Corrección realizada después de instalar dependencias: los wrappers se ajustaron a los tipos de React Aria 1.21.1 (`Button` restringe children a `ReactNode` y `SelectField` toma el estado inválido por atributo de datos). No quedan diagnósticos en `src/ui`; el único diagnóstico global actual es el export preexistente de billing descrito arriba.

## Qué falta

### Fase 3 — completa

Decisiones completas en `docs/ui-architecture.md`. Fronteras que se deben respetar:

- Wizard y futuro dashboard viven en `apps/merchant`.
- Landing y `/login` pertenecen a una superficie pública autocontenida, sin imports específicos del merchant.
- Introducir estructura de locale `/es/` preparada para más idiomas.
- No tocar `apps/consumer`.
- `apps/platform` solo recibe esqueleto cuando corresponda; no inventar API.
- `/backoffice/*` es legado a retirar, no una base para componentes nuevos.

El alcance inmediato solicitado por el owner sigue limitado a sistema de diseño + wizard. No construir dashboard, login, landing ni panel de plataforma ahora.

### Fase 4 — completa en código fuente

Se construyó el wizard en `apps/merchant`, en este orden:

1. Pantalla 1: email mediante `POST /api/merchant/auth/start`.
2. Resolver rama de email nuevo vs conocido/link mágico.
3. Consultar `GET /api/onboarding/state` para reanudar sin duplicar recursos.
4. Pantalla 2: prefill + negocio/local mediante `GET /api/onboarding/prefill` y `POST /api/onboarding/business`.
5. Pantalla 3: programa de sellos mediante `POST /api/onboarding/program`.
6. Pantalla final de valor: QR mediante `GET /api/loyalty-program/qr`, con vista y descarga.
7. Estados de loading, error, retry, teclado, foco, lectores de pantalla, reduced motion y layout desde 320 px.
8. Pruebas de reanudación, ramas de identidad, payloads contratados y errores transversales.
9. `docs/api-faltante.md` registra los huecos y conflictos reales encontrados durante el QA, sin inventar endpoints.

Ruta nueva: `/es/business/onboarding`.

Validaciones de Fase 4:

- 9 pruebas unitarias nuevas pasan.
- El typecheck de la UI base pasa.
- El typecheck global no presenta errores nuevos; sigue bloqueado únicamente por el export preexistente `downgradeToFree` del Route Handler de billing.
- Contraste del sistema: 38/38 pares pasan AA.
- QA manual completado para cuenta nueva, creación de negocio, dirección Geoapify, programa, verificación de email, generación, descarga y compartido del QR.

Mejoras incorporadas durante QA:

- Jerarquía y contraste de labels aislados del CSS legado.
- Selector de país con moneda legible.
- Dirección con búsqueda Geoapify y lista accesible integrada.
- Stepper de sellos sin estilos duplicados del input nativo.
- Simulador local y opcional de impacto económico del premio.
- Pantalla final estable ante `email_not_verified`.
- Descarga PNG y compartido nativo del QR, con fallback para WhatsApp.
- Mensaje de continuidad y acción futura “Ir a mi cuenta”, deshabilitada hasta que exista destino real.

Bloqueos de API documentados en `docs/api-faltante.md`:

1. `GET /api/onboarding/state` está contratado por 0074 pero no existe todavía en el árbol; el fallback exacto se usa solo en desarrollo.
2. El wizard solo puede crear programas de sellos; faltan contratos para puntos y cashback.
3. El QR final exige email verificado aunque el wizard completo ocurre antes de la verificación. La UI maneja el `403`, pero el API debe resolver la contradicción para entregar el QR al finalizar.

No ampliar el alcance sin una nueva confirmación del owner.

## Contratos que no se deben olvidar

- Base URL de producción: `https://www.checkpass.club`; no usar el apex.
- Cookies de sesión; no inventar bearer tokens.
- El contrato 0072 prevalece sobre 0067/0069 para errores.
- `POST /api/onboarding/program` también puede emitir `business_suspended` y `business_closed`.
- `POST /api/onboarding/business` conserva errores sin `code`; discriminar según el contrato, no inventar códigos.
- Ningún `businessId`, `programId` o slug se manda si la ruta lo resuelve desde sesión.
- El QR tampoco recibe `programId`.
- Email no verificado no bloquea negocio ni programa. Actualmente sí bloquea el QR, contradicción registrada como bloqueo de API porque el QR es el resultado final del propio wizard.
- Los parámetros de rebote son falsificables: traducir únicamente por allow-list.

## Estado del árbol y cuidado al retomar

Hay cambios concurrentes que no pertenecen a esta implementación y no deben sobrescribirse:

- `docs/INDEX.md`
- `docs/TASKS.md`
- `docs/encargo-ui-chatgpt.md`
- `docs/specs/0074-contratos-de-api.md`
- `docs/specs/0074-el-hueco-de-lecturas-del-api.md`

Los cambios de la UI todavía no están committeados. No descartar ni resetear el worktree.

## Próximo trabajo recomendado

Resolver primero los bloqueos de `docs/api-faltante.md`, especialmente el gate del QR y la implementación real de `GET /api/onboarding/state`. Después de cambiar los contratos, retirar el fallback de desarrollo y ajustar el manejo temporal de verificación en la pantalla final.

No continuar con login, landing, dashboard ni plataforma sin una nueva definición de alcance.

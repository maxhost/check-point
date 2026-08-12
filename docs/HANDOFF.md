# Handoff — Mi Pasaporte

**Fecha:** 2026-08-11
**Estado:** fase de mockups merchant cerrada para diseño; el próximo trabajo es iniciar
backend por el registro y autenticación real de Owner. No se ha creado backend, base de
datos, proveedor de auth ni secreto alguno.

## Objetivo de la próxima sesión

Después de `/clear`, definir —antes de escribir código— la nueva **Spec 0022: Registro y
autenticación de Owner**. Será la primera feature de backend.

La Spec 0001 ya existe, pero es la fundación amplia de identidades, membresías y auditoría
para merchant/platform. La Spec 0012 está cerrada y sólo describe el onboarding **mock**:
no debe reutilizarse como contrato de backend. La nueva spec debe acotar el primer corte
real: alta por email/contraseña, sesión merchant, owner inicial y transición segura desde
la UI de onboarding actual.

## Leer en este orden

1. `docs/TASKS.md`
2. este archivo
3. `docs/ARCHITECTURE.md`
4. `docs/adr/0010-dominios-de-acceso-separados.md`
5. `docs/adr/0012-neon-better-auth-y-esquemas-de-identidad-separados.md`
6. `docs/adr/0017-estandar-production-grade.md`
7. `docs/specs/0001-fundacion-identidad-y-roles.md`
8. `docs/specs/0012-onboarding-owner-y-negocio-demo.md`

## Alcance que debe cerrar la Spec 0022

- Registro real de Owner con nombre completo, email, contraseña y confirmación.
- Validación server-side, normalización/unicidad de email y hash de contraseña; nunca
  persistir o registrar contraseña en claro.
- Sesión exclusiva del dominio merchant y protección inicial de rutas merchant.
- Modelo mínimo de cuenta merchant/owner compatible con N owners por negocio, sin crear
  todavía staff, negocio, locales, Stripe ni campañas reales salvo que la spec lo incluya
  explícitamente.
- Estados y errores de registro/login seguros; no revelar si un email existe cuando no
  corresponda.
- Migraciones Neon/Drizzle, aislamiento de esquemas y auditoría mínima sólo si el
  contrato cerrado lo exige.
- Adaptación de la UI actual para sustituir el estado mock únicamente en la parte que la
  spec apruebe; preservar el diseño y componentes reutilizables.
- Pruebas unitarias, integración y E2E, protección anti-abuso proporcional, observabilidad
  y plan de rollback.

## Preguntas que la spec debe resolver antes de implementación

1. ¿El primer registro crea únicamente la cuenta, o también el primer negocio y su
   membresía owner? Mantenerlo explícito y transaccional.
2. ¿Se exige verificación de email antes de iniciar sesión o se difiere? Definir amenaza,
   proveedor y UX; no inventar envío de correos sin proveedor/configuración.
3. ¿Cómo se maneja recuperación de contraseña y rate limiting en el primer corte?
4. ¿Qué parte de Better Auth se usa y cómo se separa `merchant_auth` de consumer/platform
   según ADR 0012?
5. ¿Stripe se mantiene fuera de esta feature? La respuesta por defecto es sí: el checkout
   mock no autoriza integración real de cobro.

## Estado entregado — UI y producto

- Merchant demo incluye onboarding, home, marca, locales, staff, fidelización, campañas y
  analíticas; sigue siendo `sessionStorage`, sin backend.
- Campañas usa un constructor de reglas guiado: objetivo editable dentro de la frase,
  disparador, condición, distribución y límite; luego fechas/horarios y revisión.
- ADR 0022 define objetivos, capacidades y métricas. ADR 0023 aclara que objetivo sólo
  recomienda: los disparadores son independientes y se habilitan según capacidades
  verificables (check-in, compra, canje, juego, referido).
- Spec 0021 define un catálogo único de beneficios. Beneficio es reutilizable; campaña,
  juego o canje define los términos de distribución. Aún no está implementado.
- Nunca incentivar reseñas de Google; feedback es una solicitud neutral sin premio.
- Branding, wallet por comercio y programa de fidelización siguen las decisiones
  documentadas en ADRs 0019–0020.

## No retroceder

- No convertir el onboarding mock de Spec 0012 en auth real sin una spec nueva cerrada.
- No mezclar sesión merchant con consumer ni platform.
- No usar el cliente para autorización, hashes, unicidad ni creación de membresías.
- No añadir Stripe, catálogo, campañas, staff, OTP o recuperación de contraseña por
  conveniencia mientras se implementa el primer corte.
- No introducir estados mock duplicados junto al origen real de identidad.
- Mantener el estándar de ADR 0017: componentes reutilizables, validación en servidor,
  accesibilidad, estados de error y controles automatizados.

## Verificación más reciente

Último gate local PASS tras el ajuste de ancho del wizard y ADR 0023:

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test     # 9 tests
pnpm build
```

`pnpm test:e2e` debe ejecutarse localmente con puertos 3000–3002 libres. El repositorio
declara Node 24.19.0; la última ejecución disponible usó Node 22.22.2 y emitió el warning
de engine, aunque los gates pasaron. Antes del backend, usar la versión declarada.

## Estado del repositorio

- Remoto canónico: `https://github.com/maxhost/check-point.git`.
- Política: push directo a `main` sólo con autorización explícita del fundador.
- No asumir que los cambios locales están publicados; verificar `git status`, rama,
  autenticación y conectividad antes de cualquier push.

---
spec: 0208
fecha: 2026-10-12
estado: cerrada
resumen: Aplicar Club cotidiano y paleta A aprobados en mocks0207 a login, inscripción y confirmación reales.
disjunta: si
archivos: apps/consumer/src/app/(consumer)/consumer-entry*, apps/consumer/src/app/(consumer)/entry-*, apps/consumer/src/app/(consumer)/provider-buttons*, apps/consumer/src/app/(consumer)/wallet/page*, apps/consumer/src/app/(consumer)/enroll/**, apps/consumer/public/fonts/**, tests/e2e/wallet-entry*, tests/e2e/support/wallet-entry*, docs/qa/0208/**, apps/consumer/DESIGN.md, apps/consumer/PRODUCT.md, apps/consumer/.impeccable/**
---

# 0208 — Entrada de wallet: Club cotidiano

## Problema

El owner aprobó los mocks0207 y solicita aplicarlos a las páginas. `wallet/page.tsx` sin sesión y `enroll/[programId]/page.tsx` usan estilos inline y mensajes distintos; `enroll-confirmation.tsx` conserva el diseño previo. Las rutas reales todavía no expresan la dirección elegida.

## Alcance

**Entra:** login sin sesión; invitación a programa sin/con sesión; ya miembro; no disponible; confirmación e instalación iOS/Android/desktop/standalone. Tipografía local NunitoSans, CSS module compartido, marca actualC, identidad real del comercio, oferta real de bienvenida y errores existentes. Copy tuteado. Pruebas visuales/funcionales con componentes reales y dependencias simuladas; revisión de login en Next local.

**No entra:** wallet interna con sesión, API, servidor, paquetes, migraciones, OAuth/contratos nuevos, notificaciones, manifiesto, políticas de instalación, cambios al kit, push/merge/deploy.

## Diseño

Composición del mock0207 con paletaA y tipografía local. Layout blanco con columna390px, margen24px, separación32px, titular38px, CTA52px. IdentidadCommerce con logo público si existe y nombre siempre visible; fallback inicial del comercio en lugar de icono de café ficticio. MarcaC SVG con silueta real. Fuente autohospedada en public/fonts con OFL.

Login: Qué bueno verte de nuevo + «Inicia sesión en tu wallet para acceder a tu pase y beneficios». Google/Apple preservan URLs/start, programId/loc codificados y orden por sistema. Invitación: Hazte parte de [negocio]. Con sesión: [nombre], únete a [negocio], cuenta visible y Unirme al programa; No soy yo muestra proveedores. Ya miembro ofrece Ver mi pase y No soy yo. Sin programa disponible, error existente y acceso a wallet.

Contrato de inscripción intacto: POST ruta actual con loc opcional;201 → ready,409 → wallet,401 → proveedores,otros errores → mensaje servidor/fallback,red → reintento; bloqueo durante envío. No se inscribe al montar.

Confirmación: Ya eres parte + negocio, sello coral, explicación e instrucciones aprobadas. Conserva beforeinstallprompt, appinstalled, plataforma y standalone; errores de prompt muestran recuperación, no quedan promesas falsas. Oferta solo si existe, con disponibilidad y activación de avisos. Ver mi pase conserva /wallet. Metadata, manifest/token, resolución de sesión y consultas actuales intactas.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/consumer/src/app/(consumer)/consumer-entry.module.css` | Crear sistema aislado |
| `apps/consumer/src/app/(consumer)/entry-brand.tsx`, `entry-icons.tsx` | Crear componentes visuales sin servidor |
| `provider-buttons.tsx`, `provider-buttons.test.ts` | Estilo/copy y aserción mecánica alto52 |
| `wallet/page.tsx`, `page-no-session.test.ts` | Entrada y aserción mecánica copy |
| `enroll/[programId]/page.tsx`, `enroll-buttons.tsx`, `welcome-offer.tsx` | Composición y estados |
| `enroll/[programId]/ready/page.tsx`, `enroll-confirmation.tsx`, `enroll-confirmation.module.css` | Confirmación/layout |
| `apps/consumer/public/fonts/**` | Copiar fuente/OFL del mock aprobado |
| `tests/e2e/wallet-entry.spec.ts`, `support/wallet-entry*` | Cobertura con UI real, dependencias simuladas |
| `apps/merchant/src/app/backoffice/marketing/welcome-ui.test.ts` | Ajuste mecánico de dos aserciones de copy del componente consumer compartido; §6 rotura cruzada |
| `docs/qa/0208/**`, `apps/consumer/{DESIGN,PRODUCT}.md`, `.impeccable/**` | Evidencia/autoridad actualizada |

**Disjunta:** sí respecto merchant y trabajo API. Actualiza únicamente pantallasconsumer y documentación.

## Definition of Done

- [x] Typecheck, ESLint y formato de consumer/e2e afectados en verde, Node24.
- [x] Unit existentes14/14, sin base de producción; bienvenida merchant mecánica7/7 posterior.
- [x] E2E11/11 con rutas simuladas;1/1 posterior cubre limpieza del error al instalar.
- [x] Capturas390/1440, overflow320/360/390/430/1440 y loginNext real200, sin erroresJS; review independiente cerrada.
- [x] `pnpm verify` una ejecución; tabla real y motivosROJO registrados en `docs/qa/0208/README.md`. No se afirma verifyverde: gate general pendiente antes de publicación.
- [x] `git diff --check` verde; ninguna API/servidor/paquete/kit cambiado.

## Mutaciones — presupuesto: 0

Rediseño de presentación con contrato intacto; pruebas de recorridos y regresión visual, sin introducir mutaciones para estética.

## Declarado AFUERA

OAuth real, inscripción contra producción, instalaciónPWA en dispositivo físico y envío de push. QA owner local antes de publicar.

## Handoff

Un implementador, revisión independiente Impeccable con capturas y contrato. Owner confirma en local; publicación exige solicitud aparte.

## Abierto

Sin decisiones de producto abiertas: mocks y diseño real aprobados. UI implementada local; e2e general pendiente, sin publicación: colisiona con Nextdev3200. Formato general posterior0; el único test unit/Neon fallido por copy fue corregido y7/7 específico pasó. La implementación permanece sin commit; no hay merge/push/deploy.

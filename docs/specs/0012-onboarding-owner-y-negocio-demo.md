---
spec: 0012
fecha: 2026-08-10
estado: cerrada
resumen: Prototipo responsive sin backend para registrar un owner, simular Stripe Checkout, configurar un negocio con sucursales iniciales y llegar al Backoffice.
disjunta: no
archivos: apps/merchant, README.md, .env.example, pruebas merchant y e2e, docs
---

# 0012 — Onboarding demo de owner, negocio y sucursales

> **Nada de código empieza sin esta spec en `cerrada`.**

## Problema

Antes de implementar identidad, cobros y modelos de negocio reales, necesitamos validar
que un owner entienda el recorrido para crear su cuenta, contratar un plan, configurar su
negocio y llegar a su Backoffice sin formularios innecesarios.

## Alcance

**Entra:**

- Wizard mobile-first para crear la cuenta del **owner**: nombre completo, email,
  contraseña y confirmación de contraseña.
- Selección de un plan de pago demo.
- Redirección simulada a una pantalla que representa Stripe Checkout y retorno exitoso
  al onboarding; no se construye UI de tarjeta.
- Configuración inicial: nombre del negocio, logo opcional y una o más sucursales con
  nombre y dirección.
- Pantalla de llegada de Backoffice con el negocio/sucursales fixture creados.
- Toasts accesibles de confirmación, advertencia y error.
- Validación de cliente de campos requeridos, email, contraseña y confirmación.

**No entra:**

- Better Auth, base de datos, sesiones reales, hash de contraseñas, recuperación,
  invitaciones, autorización, persistencia entre dispositivos ni alta real de owner.
- Stripe SDK, Payment Element, tarjeta, Customer, PaymentIntent, webhook, impuestos,
  factura, cobro o plan real.
- Carga real de archivos; el logo es un placeholder/preview fixture.
- Catálogo, campañas, personal, métricas u operaciones del Backoffice.

## Diseño

El prototipo vive exclusivamente en `apps/merchant`. La cuenta creada es la del owner;
el negocio se configura sólo después del retorno exitoso de Stripe Checkout. Todos los
datos viven en `sessionStorage` bajo un namespace `merchant-demo`; cerrar/borrar datos
del sitio reinicia el demo.

```text
/onboarding/owner
  → datos del owner válidos
  → /onboarding/plan
  → /onboarding/stripe-checkout (simulado)
  → retorno exitoso /onboarding/business
  → nombre/logo y sucursal(es)
  → /backoffice/demo + toast “Tu negocio está listo”
```

El checkout simulado representa una superficie externa: muestra el plan elegido, un CTA
`Pagar de forma segura` y un retorno de éxito. No muestra ni recoge datos de tarjeta.
Existe una acción de cancelación que vuelve a la selección de plan con un toast warning.

### Especificación técnica

- Rutas/páginas client-side de merchant comparten un módulo `demo` tipado para leer y
  escribir el estado temporal. No se crean endpoints de producto.
- El formulario owner no permite avanzar si falta un campo, email es inválido, contraseña
  tiene menos de 8 caracteres o confirmación no coincide. Los errores se asocian al
  campo y se anuncian accesiblemente.
- Planes fixture: `Piloto` (USD 20/mes) y `Prueba` (sin cobro). Elegir uno es obligatorio
  antes de continuar a checkout.
- Negocio exige nombre; cada sucursal exige nombre y dirección. El wizard inicia con una
  sucursal y permite añadir/quitar otras, sin poder eliminar la única inicial.
- El Backoffice demo muestra nombre/logo de negocio, plan y la lista de sucursales
  configuradas; no permite acciones de producto.
- Toast único visible, con roles accesibles: éxito tras retorno checkout y finalización;
  warning al cancelar checkout; error ante validación o estado temporal ausente.
- Cada pantalla se diseña primero para viewport móvil, sin depender de hover, y se
  adapta a escritorio sin limitar los controles a tarjetas estrechas.

### Arquitectura de referencia

- ADR 0010 — dominio merchant separado del consumidor/plataforma.
- ADR 0011 — aplicaciones aisladas en el monorepo.
- ADR 0017 — límites explícitos, validación y pruebas aunque sea demo.
- ADR 0019 — fundación visual accesible y branding por negocio; aquí sólo se simula su
  captura inicial.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/layout.tsx`, estilos globales y componentes demo | crear/editar |
| `apps/merchant/src/app/onboarding/**` | crear |
| `apps/merchant/src/app/backoffice/demo/page.tsx` | crear |
| `apps/merchant/src/app/**/demo*.ts(x)` y pruebas unitarias | crear |
| `tests/e2e/**` | editar con el recorrido demo merchant |
| `README.md`, `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | editar al entregar |

### Disjunta?

No. Modifica la app merchant y pruebas compartidas que serán consumidas por las futuras
Specs 0001 y 0002. Se implementa sola.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Scaffold aislado de merchant | Spec 0010 | ya disponible; PASS independiente pendiente |

## Definition of Done

- [ ] Se muestra el formulario de registro de owner con nombre completo, email,
  contraseña y confirmación.
- [ ] El owner puede completar el registro mock sin backend tras pasar validaciones.
- [ ] Puede elegir un plan antes de continuar.
- [ ] El flujo redirige a Stripe Checkout simulado y vuelve exitosamente.
- [ ] Tras el retorno puede configurar nombre, logo fixture y sucursales iniciales con
  nombre/dirección.
- [ ] Al finalizar llega al Backoffice demo con los datos configurados.
- [ ] Los toasts de confirmación, warning y error son visibles y accesibles.
- [ ] El flujo es responsive y mobile-first.
- [ ] No hay Stripe real, datos de tarjeta, backend, auth, secretos ni persistencia real.
- [ ] Format, lint, typecheck, unit, E2E y build pasan; revisor independiente emite PASS.

## Plan de pruebas y verificación

- [ ] Unidad: validación de owner y sucursal rechaza entradas inválidas y acepta las
  válidas; estado demo serializa y recupera datos fixture.
- [ ] E2E: owner → plan → checkout éxito → negocio/sucursal → Backoffice, comprobando
  toast final y datos visibles.
- [ ] E2E: cancelación checkout muestra warning y vuelve a plan; confirmación errónea de
  contraseña muestra error y no avanza.
- [ ] Regresión: health check merchant permanece sin cambios.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.
- [ ] Manual: recorrer en móvil y escritorio, comprobar orden de foco, mensajes de error
  y adaptación de formularios.

## Handoff requerido

Implementador y revisor usan `docs/AGENT-WORKFLOW.md`; no se incluyen datos de pago ni
datos personales reales en evidencias.

## Abierto

No hay bloqueos. Los proveedores reales, modelos de datos y cobro se definen en specs
posteriores y no se infieren desde este prototipo.

---
spec: 0019
fecha: 2026-08-10
estado: cerrada
resumen: Owner activa, configura o desactiva un único programa demo de Puntos o Sellos, con unidades, meta y diseño de sello fixture.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0019 — Programa de fidelización del owner demo

## Problema

El owner necesita decidir si su negocio tiene programa de fidelización y, si lo tiene,
qué mecánica entiende mejor su cliente. Esta decisión no puede quedar implícita en una
campaña: determina qué acumula la wallet, qué se puede otorgar y cómo se comunica el
progreso. El demo debe validar esta configuración antes de conectar el Incentive Engine.

## Alcance

**Entra:**

- Tarjeta propia **Programa de fidelización** en la home del owner y ruta
  `/backoffice/demo/loyalty`.
- Estado demo `Desactivado`, activación de un único programa y desactivación con
  confirmación.
- Elección inicial entre **Puntos** y **Sellos**; no se pueden activar ambos.
- Configuración de Puntos: nombre singular y plural de la unidad.
- Configuración de Sellos: nombre de la tarjeta/unidad, cantidad de sellos objetivo y
  carga, vista previa, reemplazo y retiro de una imagen de sello.
- Persistencia mock en `sessionStorage`, toasts y estados vacíos/activos claros.

**No entra:**

- Activar en la UI las modalidades Niveles o Cashback, acumulación real, wallet real,
  recompensas/catálogo, campañas conectadas, economía, canje, subida de archivos a un
  servidor, CDN, backend, autenticación o permisos reales.
- Convertir, transferir o eliminar saldos/progresos al desactivar o cambiar una modalidad.

## Diseño

La home presenta Programa de fidelización como acceso de negocio propio, separado de
Configuración y Campañas. La tarjeta declara el estado: `Desactivado`, `Puntos` o
`Sellos`.

En `/backoffice/demo/loyalty`, si está desactivado el owner elige una de dos tarjetas:
Puntos o Sellos. La elección abre su formulario; sólo **Activar programa** persiste el
estado. No se muestra un selector de Niveles o Cashback en el demo: ambas modalidades
pertenecen al modelo de ADR 0020, pero no están listas para operar.

Una vez activo, la pantalla muestra el tipo y permite editar exclusivamente su
configuración. Para cambiar de Puntos a Sellos, o a la inversa, el owner primero debe
desactivar el programa mediante una confirmación; después podrá elegir una modalidad.
Esto evita que la interfaz sugiera una conversión automática de beneficios que el producto
no ha definido.

```text
/backoffice/demo
  → Programa de fidelización
     → Desactivado
        → [Puntos] | [Sellos]
     → Activo: editar configuración
        → [Desactivar programa] → confirmación → Desactivado
```

### Especificación técnica

- La ruta es un Client Component y reutiliza `merchant-demo`; no crea endpoint ni modelo
  paralelo. `DemoState` añade:

  ```ts
  loyaltyProgram: {
    status: "inactive" | "active";
    type: "points" | "stamps" | null;
    pointUnitSingular: string;
    pointUnitPlural: string;
    stampUnitName: string;
    stampTarget: number;
    stampImageName: string;
  };
  ```

  El estado vacío usa `inactive`, `type: null`, `Punto`/`Puntos`, `Sello`, objetivo `10`
  e imagen vacía. `read()` mezcla este objeto con el fixture vacío para mantener sesiones
  creadas antes de la feature compatibles.
- Puntos requiere nombres singular y plural no vacíos, con espacios recortados. Sellos
  requiere nombre no vacío y `stampTarget` entero entre 2 y 50. La imagen es opcional;
  el navegador sólo guarda el nombre en el fixture y usa `URL.createObjectURL` para el
  preview actual. Reemplazar o quitar limpia el input para permitir volver a elegir el
  mismo archivo.
- Sólo `status: active` con un `type` válido se considera programa activo. Un formulario
  incompleto no cambia estado. Al guardar se muestra toast de éxito; errores de validación
  se muestran junto al campo correspondiente o como toast de error coherente.
- Desactivar abre `ConfirmDialog` reutilizable. Confirmar guarda `inactive` y `type: null`
  sin borrar la configuración fixture, para que un mock pueda volver a mostrarla, pero no
  promete retención/migración de beneficios reales.
- La ruta conserva `ModuleHeader`, botón X a la home, anchura/márgenes de los módulos y
  controles táctiles de al menos 44 px. En móvil las opciones y el formulario ocupan una
  columna; en escritorio pueden usar dos columnas sólo para elegir modalidad.
- La tarjeta home se genera desde el mismo fixture: sin programa dice `Activa un programa
  para premiar visitas`; con programa muestra la modalidad activa. No duplica el estado.

### Arquitectura de referencia

- ADR 0006 — programa a nivel negocio y heredado por locales.
- ADR 0017 — interfaz consistente, accesible y verificable.
- ADR 0018 — campañas emiten efectos tipados; no deciden la modalidad.
- ADR 0020 — un programa activo, modalidades excluyentes y distinción entre sellos de
  comercio y activos de plataforma.
- Spec 0003 — el Incentive Engine posterior valida compatibilidad de efectos.
- Spec 0004 — wallet posterior representa puntos y progreso de sellos comerciales por
  separado.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/demo/page.tsx` | editar tarjeta/ruta de Programa de fidelización |
| `apps/merchant/src/app/backoffice/demo/loyalty/page.tsx` | crear pantalla y flujo mock |
| `apps/merchant/src/app/demo.ts` | extender fixture/persistencia demo |
| `apps/merchant/src/app/components/ui.tsx`, `confirm-dialog.tsx`, `globals.css` | reutilizar/editar componentes y estilos mínimos si hace falta |
| `apps/merchant/src/app/**/*.test.*` | crear pruebas de estado y validación del programa |
| `tests/e2e/**` | añadir flujo de owner hacia programa y activación demo |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | editar al implementar/verificar |

### Disjunta?

No. Comparte home, fixture `merchant-demo`, componentes UI y estilos con Specs 0012–0018
y con cualquier ajuste concurrente de merchant. Se implementa de forma serial.

### Archivos compartidos

| Qué | Quién lo deja listo | Cuándo |
|---|---|---|
| Invariante de modalidad, semántica de sellos y comportamiento al desactivar | ADR 0020 | antes de implementar |
| `merchant-demo`, toast, diálogo y header reutilizables | base merchant actual | antes de implementar |

## Definition of Done

- [ ] Owner puede abrir Programa de fidelización desde su tarjeta propia en la home y ve
  inequívocamente si está desactivado o qué modalidad está activa.
- [ ] Owner puede escoger y activar exactamente uno de Puntos o Sellos; no puede dejar
  ambos activos ni activar un formulario inválido.
- [ ] Owner puede desactivar el programa con confirmación reutilizable y el estado demo
  queda desactivado.
- [ ] En Puntos puede editar los nombres singular y plural de la unidad.
- [ ] En Sellos puede editar nombre, objetivo de 2 a 50 y cargar, previsualizar,
  reemplazar o quitar una imagen de sello.
- [ ] La sesión demo conserva la configuración tras recargar; fixtures antiguos siguen
  siendo legibles.
- [ ] La interfaz es responsive/mobile-first, accesible con teclado, muestra toasts y no
  expone Niveles ni Cashback como opciones operables.
- [ ] Format, lint, typecheck, unit, E2E y build pasan; revisor independiente emite PASS.

## Plan de pruebas y verificación

- [ ] Unidad: normalización/validación rechaza programa sin tipo, nombre de unidad vacío y
  objetivo de sellos fuera de 2–50; acepta una configuración válida de cada modalidad.
- [ ] Unidad: `read()` de un fixture de onboarding anterior entrega el objeto de programa
  vacío sin romper sus datos existentes.
- [ ] Integración UI: activar Puntos persiste un único tipo; desactivar tras confirmar lo
  deja inactivo y cancelar la confirmación conserva el activo.
- [ ] Integración UI: Sellos permite cargar, retirar y volver a seleccionar la misma
  imagen en el input; el objetivo y nombre se conservan en la sesión mock.
- [ ] E2E móvil: desde la home abrir la tarjeta, activar Sellos, configurar objetivo e
  imagen demo, volver a la home y comprobar estado; desactivar y comprobar estado vacío.
- [ ] Manual: revisar móvil y escritorio, foco de modal, teclado, selector de archivo y
  ausencia de Niveles/Cashback operables.
- [ ] Comandos: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e` y `pnpm build`.

## Handoff requerido

Implementador y revisor usan `docs/AGENT-WORKFLOW.md`; el revisor emite PASS independiente
antes de marcar la feature como implementada.

## Abierto

No hay bloqueos para el mock. La definición de premios, expiración, canje, métricas
calificadoras de niveles, moneda/riesgo de cashback y conversión de saldos se resuelven
antes de habilitar esas modalidades en producción.

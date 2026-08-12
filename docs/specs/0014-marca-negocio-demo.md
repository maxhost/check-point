---
spec: 0014
fecha: 2026-08-10
estado: cerrada
resumen: Pantalla demo responsive para que el owner edite nombre, logo, paleta y zona horaria de su negocio.
disjunta: no
archivos: apps/merchant, pruebas merchant y e2e, docs
---

# 0014 — Marca de negocio demo

## Alcance

**Entra:** owner edita nombre de negocio, sube/reemplaza/quita logo demo y define colores
primario, complementario y de acento con selector nativo y campo hexadecimal. Muestra
preview de marca y toast de éxito/error. Owner define la zona horaria del negocio y puede
propagarla a todos sus locales; de lo contrario, cada nuevo local la configura de forma
individual.

**No entra:** almacenamiento de archivos, CDN, backend, validación de contraste final,
branding aplicado al consumer ni permisos reales.

## Diseño técnico

Ruta `/backoffice/demo/brand`, Client Component y estado `merchant-demo` de Spec 0012.
Cada color guarda un hex `#RRGGBB`; el picker y texto están sincronizados y se rechazan
hex inválidos al guardar. La pantalla ofrece preview de logo/nombre/paleta y vuelve al
Backoffice. La zona horaria se guarda como identificador IANA y la opción de propagación
asigna ese valor a todos los locales fixture al guardar. Mobile-first, accesible por
teclado y sin CSS arbitrario del owner.

## Definition of Done

- [ ] Owner puede editar nombre de negocio.
- [ ] Owner puede subir, reemplazar y quitar logo demo.
- [ ] Owner puede añadir/editar color primario, complementario y acento.
- [ ] Cada color tiene picker y entrada hexadecimal sincronizados.
- [ ] Owner puede definir la zona horaria IANA del negocio y optar por aplicarla a todos
  los locales; si no, los nuevos locales la definirán individualmente.
- [ ] Preview, toasts, responsive, format, lint, typecheck, unit, E2E, build y PASS independiente.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/demo/brand/page.tsx`, componentes/estilos demo | crear/editar |
| `apps/merchant/src/app/demo.ts`, pruebas y E2E | editar/crear |
| `docs/INDEX.md`, `docs/TASKS.md`, `docs/HANDOFF.md` | editar al entregar |

## Abierto

No hay bloqueos; Mapbox, assets y branding real se implementan después.

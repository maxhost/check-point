---
spec: 0200
fecha: 2026-10-11
estado: cerrada
resumen: Aplicar la propuesta Funcional aprobada a negocios y registrar la filosofía de diseño de la web pública.
disjunta: no
archivos: apps/public/src/app/negocios/**, apps/public/DESIGN.md, apps/public/PRODUCT.md, apps/public/.impeccable/design.json, tests/e2e/landing.spec.ts
---

# 0200 — Filosofía Funcional para la web pública

## Problema

- `apps/public/src/app/negocios/business-landing.css:32` posiciona la escena del hero detrás del contenido; las escenas siguientes también mezclan fotografías y texto superpuesto. El owner eligió una alternativa con imágenes delimitadas y texto separado.
- No existe `apps/public/DESIGN.md`: falta una guía duradera para revisar las otras páginas con el lenguaje aprobado.
- El owner cierra el diseño del prototipo Funcional: ítems de planes en lista vertical; solo Conecta destacado; sin corazones.

## Alcance

Entra: aplicar el prototipo completo a /negocios y documentar sus reglas reutilizables. Un dominio de UI pública, sin migraciones ni decisión de producto abierta. Reserva local en dev según ADR0128. Verificación acotada e inline según ADR0129.

Fuera: publicar, modificar las otras páginas, precios, contenido comercial, orden de secciones, storytelling, API, servidor y kit merchant.

## Diseño

Referencia aprobada: `/private/tmp/checkpass-philosophies/funcional.html` y capturas desktop/mobile, última variante sin corazones y con Conecta destacado. Guardar una referencia durable de ambas capturas en la app.

- Fondo blanco, verde profundo para texto y acciones; verde medio para énfasis de titulares. Arial confirmado en el prototipo.
- Contenedor de1190px con48px de padding;24px en móvil, breakpoint760px. Hero de dos columnas con imagen en panel independiente. Ningún texto principal encima de fotografías.
- Mantener las ocho secciones, titulares, textos, precios referenciales, notas, FAQ completas, enlaces reales, metadata y marca existente.
- Mapa, recompensas y atención en demostraciones contenidas, etiquetas como información separada de la imagen. Paneles POS compactos. Pasos en bloque suave.
- Planes: dos columnas desktop, una móvil; cada plan lista sus ítems en una sola columna. Conecta con precio terracota, fondo cálido y borde suave. Impulso blanco, precio verde; no corazones ni etiquetas inventadas de recomendación.
- FAQ legibles y desplegables con teclado. Cierre verde con CTA real; footer real con enlaces legales.
- Estilos exclusivos de `.business-shell`; home y productos mantienen su aspecto hasta revisión posterior. Oscuro adapta superficies, texto y acento sin cambiar composición.
- Next Image con dimensiones intrínsecas y sizes acordes al nuevo contenedor. Foco visible y reduced-motion preservados.
- DESIGN.md con tokens evidenciados y reglas reutilizables; sidecar Impeccable schema2. PRODUCT.md registra la implementación y alcance de adopción. La guía pública no reemplaza el kit merchant.

## Archivos

| Archivo | Acción |
| --- | --- |
| apps/public/src/app/negocios/business-landing.css | reemplazar composición por Funcional con scope comercial |
| apps/public/src/app/negocios/page.tsx | ajustar importación de estilos |
| apps/public/src/app/negocios/preview.tsx | adaptar exclusivamente BusinessHeroScene |
| apps/public/src/app/negocios/barrio-scenes.tsx | dimensiones y tamaños de las imágenes |
| apps/public/DESIGN.md | documentar sistema aprobado |
| apps/public/.impeccable/design.json | registrar extensiones del sistema |
| apps/public/PRODUCT.md | actualizar descripción visual vigente |
| apps/public/.impeccable/mocks/funcional/*.png | referencia visual aprobada |
| tests/e2e/landing.spec.ts | actualizar expectativas visuales afectadas |

No disjunta de0199: la sustituye visualmente; variantes compartidas y otras páginas preservadas.

## Definition of Done

- [ ] Typecheck y ESLint de app pública; formato y diffcheck salida0.
- [ ] Suite landing específica verde: home preservada, negocios mantiene secciones, copy, precios, CTA, FAQ y no overflow390/1440 claro/oscuro.
- [ ] Build público salida0.
- [ ] Capturas negocios y comparación con prototipo desktop/mobile vistas; comprobar320/768 y teclado.
- [ ] DESIGN.md y sidecar documentan tokens de CSS y la política de énfasis exclusivo de Conecta; PRODUCT actualizado.

## Mutaciones

Presupuesto0: composición de una landing, sin nuevos flujos ni cambios en cobro o aislamiento.

## Declarado afuera

Validación de conversión y comprensión con usuarios; adopción visual en páginas distintas de /negocios.

## Handoff

Implementación y revisión inline conforme ADR0129, sin subagentes. El owner aprobó el diseño; comprobación del ensamblado real disponible en local. Sin push ni deploy.

## Abierto

Ninguna decisión de diseño o producto pendiente para este alcance.

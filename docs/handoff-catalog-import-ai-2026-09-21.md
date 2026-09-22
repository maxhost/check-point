# Handoff — Importación de catálogo con IA

Fecha: 2026-09-21

## Punto de retorno

La decisión de arquitectura está cerrada en:

- `docs/adr/0082-importacion-de-catalogo-con-ia-agnostica-y-borrador-revisable.md`
- `docs/specs/0090-importacion-de-catalogo-desde-imagen-o-pdf.md`

La próxima sesión debe **implementar la spec 0090**, no rediseñarla desde memoria del chat. Leer
completos ambos documentos, `docs/AGENT-WORKFLOW.md`, ADR 0017/0024/0029/0034/0035/0079, el
contrato 0086 y `apps/merchant/AGENTS.md` antes de editar.

## Decisiones del owner ya cerradas

- Entrada: JPEG, PNG, WebP, HEIC/HEIF o PDF; 1–10 páginas.
- Sólo extraer categoría, producto y precio de venta.
- Archivos privados y temporales; borrar al aceptar y también cancelar/vencer.
- La IA entrega borrador; el merchant revisa antes de una creación bulk transaccional.
- Precio ambiguo = cero + rojo; requiere corrección o confirmación explícita.
- Duplicados nunca se descartan/fusionan solos; la UI ofrece resolver o descartar el borrador.
- Productos nuevos disponibles en todos los locales.
- Sin cuota por plan por ahora.
- Arquitectura agnóstica: provider propio, `fake` + primer adaptador OpenAI; Claude/Kimi futuros sin
  cambiar dominio/API.

## Estado del árbol

El worktree contiene cambios previos de UI de Locales, Marca, Brand Kit y Catálogo. Son del owner y
se preservan. El mock visual actual está en
`apps/merchant/src/app/backoffice/catalog/catalog-ai-import.tsx` y **queda como está**: la spec no
toca un solo `.tsx`.

## Secuencia recomendada

1. Orquestador verifica spec/archivos y estado del diff.
2. Implementador único para schema + dominio + API + worker, porque la spec no es disjunta.
   **NO hace UI**: la spec se corrigió el 2026-09-21 y la pantalla la construye el owner por fuera
   con `specs/0090-contratos-de-api.md` (ADR 0070).
3. Migración en rama Neon efímera y pruebas de integración.
4. Handoff con evidencia exacta.
5. Revisor independiente ejecuta sus propias pruebas y emite PASS/FAIL.
6. Sólo tras PASS: marcar `implementada`, actualizar INDEX/TASKS y aplicar migración según protocolo.

## Prompt breve para después de `/clear`

> Implementemos la spec 0090. Lee `docs/handoff-catalog-import-ai-2026-09-21.md`, la spec y su ADR
> completos. Sigue `docs/AGENT-WORKFLOW.md`; no cambies decisiones de producto y preserva el
> worktree existente.


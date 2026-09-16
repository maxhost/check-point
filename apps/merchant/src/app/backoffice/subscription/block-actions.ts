/**
 * Spec 0065, fase D — LOS BLOQUEOS DE LA BAJA QUE TIENEN A DÓNDE MANDAR, en UN solo lugar.
 *
 * Existían dos listas: `BLOCKS_WITH_ACTION` en `page.tsx` (qué `code` cruza a la consola) y
 * `BLOCK_ACTIONS` en `cancel-dialog.tsx` (a dónde linkea cada uno). La revisión independiente
 * de la fase D señaló que pueden divergir en silencio: si una gana un código y la otra no, el
 * owner ve el mensaje sin link o el link sin mensaje, y nada falla.
 *
 * Se arregló por CONSTRUCCIÓN y no con un test que las compare: la página deriva su conjunto
 * de las claves de este mapa, así que agregar un bloqueo es una sola edición y olvidarse la
 * otra mitad dejó de ser posible.
 *
 * Un `code` que NO está acá —hoy `already_on_plan`— no cruza y no linkea: el modal muestra el
 * texto genérico de la consola. Es una decisión, no un olvido: no hay pantalla a donde mandar
 * a alguien que ya está en el plan que pide.
 */
export const BLOCK_ACTIONS: Record<string, { href: string; label: string }> = {
  downgrade_blocked: {
    href: "/backoffice/locations",
    label: "Ir a Locales para archivar",
  },
  downgrade_blocked_campaigns: {
    href: "/backoffice/marketing",
    label: "Ir a Campañas para desactivar",
  },
};

/** Los mismos códigos, en la forma que la página necesita para decidir qué cruza. */
export const BLOCKS_WITH_ACTION: ReadonlySet<string> = new Set(
  Object.keys(BLOCK_ACTIONS),
);

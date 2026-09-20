/**
 * Spec 0083 §D1-D2 / ADR 0077 §2-4 — EL CATALOGO DEL CHECKLIST DEL ONBOARDING, EN CODIGO.
 *
 * Es la unica fuente de verdad de «que hay que hacer y en que estado esta» **despues** del
 * wizard. No es `GET /api/onboarding/state`, que es «que falta para terminar el alta» y corre
 * ANTES de la verificacion de email (ADR 0070 §11).
 *
 * **El almacenamiento arranca en CODIGO, no en tabla** (ADR 0077 §4): con un item no hay nada
 * que configurar, mover a tabla despues no cambia el JSON que ve la UI, y el repo ya tiene el
 * patron para un catalogo chico y tipado —`ENTITLEMENTS` (`entitlements/catalog.ts`)—, donde
 * una entrada mal formada **no compila**.
 *
 * **Lo que la tabla NO va a comprar el dia que se elija:** el «¿esta hecho?» de cada item es
 * una funcion —cada item lo deriva de un hecho distinto—, asi que agregar un item nuevo va a
 * exigir deploy igual.
 */

/**
 * Los hechos con los que se resuelve el `done` de cada item. Hoy hay uno solo y **viaja en la
 * sesion de better-auth**: el checklist no consulta ninguna TABLA DE DOMINIO para resolverlo.
 * Quien lo lee es `checklist-facts.ts`, y ahi esta escrito su costo real —una segunda lectura
 * de la sesion en el mismo request— desde que la ruta usa el guard compartido. **Ese costo lo
 * registra el §D4 de la spec, ya corregido**: su version original decia «cero consultas extra»
 * y la enmienda del 2026-09-20 la volvio falsa.
 */
export type ChecklistFacts = { emailVerified: boolean };

export type ChecklistItemDef = {
  /** Orden. Lo dicta la API, nunca la UI (ADR 0077 §2). */
  position: number;
  /**
   * DOS EJES SEPARADOS (ADR 0077 §2), no uno. `required` = **hay que hacerlo**; `blocking` =
   * mientras no este `done`, los de `position` mayor **no se pueden hacer**.
   *
   * Un item puede ser obligatorio sin frenar al resto, y frenar al resto sin ser obligatorio.
   * Con UN item los dos valen `true` y no se distinguen: por eso el oraculo que prueba que no
   * son alias vive en {@link toChecklistView} con entradas sinteticas, no en el catalogo.
   * **No derivar uno del otro, ni siquiera «porque hoy da igual»** — es la mutacion M5 de
   * la tabla enmendada de la spec (la que emite `blocking: def.required`).
   */
  required: boolean;
  blocking: boolean;
  /**
   * Clave ESTABLE que la UI mapea a un elemento. NUNCA un selector ni una coordenada
   * (ADR 0077 §3): si la API guardara coordenadas, cada rediseño de UI romperia el tour en
   * produccion **sin poner rojo a nadie en CI**.
   */
  anchor: string;
  /** Copia, NO contrato. Cambia sin aviso y ningun test asevera su texto. */
  title: string;
  body: string;
  /**
   * El «¿esta hecho?». Es una FUNCION y no un dato porque cada item lo deriva de un hecho
   * distinto — el del email sale de la sesion, el del catalogo saldria de una consulta.
   */
  done: (facts: ChecklistFacts) => boolean;
};

export type ChecklistItemView = {
  id: string;
  position: number;
  required: boolean;
  blocking: boolean;
  done: boolean;
  anchor: string;
  title: string;
  body: string;
};

/**
 * `locale` fijo y **declarado** (ADR 0077 §3): no hay columna de idioma del merchant en
 * ninguna tabla, asi que el servidor no tiene de donde elegir. El campo viaja igual para que
 * el dia del segundo idioma la UI no cambie de contrato.
 */
export const CHECKLIST_LOCALE = "es";

export type ChecklistView = {
  locale: typeof CHECKLIST_LOCALE;
  items: ChecklistItemView[];
};

/**
 * UN item, y es el unico de los cinco candidatos del ADR 0070 §9 que no necesita pantalla
 * nueva ni feature previa: su accion ya existe (`POST /api/merchant/auth/verify-email`) y su
 * hecho ya viaja en la sesion.
 *
 * `required: true` + `blocking: true` es la regla que el owner dicto para el email —«sin esto
 * no desbloqueas nada de lo que sigue»—. **Que hoy coincidan no los hace el mismo campo.**
 */
export const CHECKLIST_ITEMS = {
  "verify-email": {
    position: 1,
    required: true,
    blocking: true,
    anchor: "verify-email",
    title: "Verificá tu email",
    body: "Te enviamos un enlace al correo con el que te registraste. Confirmalo para desbloquear el resto del onboarding.",
    done: (facts: ChecklistFacts) => facts.emailVerified,
  },
} as const satisfies Record<string, ChecklistItemDef>;

/**
 * Arma la vista que sale por HTTP. **Es pura**: no toca base ni sesion, asi que su test no
 * necesita Neon.
 *
 * **El segundo parametro tiene default y existe por dos oraculos concretos**, no por gusto de
 * inyectar (spec 0083 §D2): es la unica forma de alimentar entradas SINTETICAS —desordenadas,
 * o con `required` y `blocking` divergentes— que el catalogo real de un solo item no puede
 * producir. **La ruta lo llama SIN el segundo argumento.**
 *
 * El `sort` por `position` se hace aca y **no se asume del orden de declaracion** del objeto:
 * el dia que el catalogo mude a tabla el orden de las filas no esta garantizado, y un `sort`
 * que ya esta puesto es lo que evita que ese dia el bug sea silencioso.
 */
export function toChecklistView(
  facts: ChecklistFacts,
  items: Record<string, ChecklistItemDef> = CHECKLIST_ITEMS,
): ChecklistView {
  return {
    locale: CHECKLIST_LOCALE,
    items: Object.entries(items)
      .map(([id, def]) => ({
        id,
        position: def.position,
        required: def.required,
        blocking: def.blocking,
        done: def.done(facts),
        anchor: def.anchor,
        title: def.title,
        body: def.body,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

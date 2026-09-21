import { ONBOARDING_TOURS, type OnboardingTourId } from "./tours";

/**
 * Spec 0085 / ADR 0078 §1 — EL CATALOGO DEL CHECKLIST DEL ONBOARDING, EN CODIGO. Son CINCO
 * items: `verify-email` y los CUATRO TOURS.
 *
 * Es la unica fuente de verdad de «que hay que hacer y en que estado esta» **despues** del
 * wizard. No es `GET /api/onboarding/state`, que es «que falta para terminar el alta» y corre
 * ANTES de la verificacion de email (ADR 0070 §11).
 *
 * **El almacenamiento sigue en CODIGO, no en tabla** (ADR 0077 §4): el «¿esta hecho?» de cada
 * item es una FUNCION —uno lee la sesion, cuatro leen `core.business_onboarding_tour`—, asi que
 * una tabla de items no ahorraria el deploy del dia que entre el sexto. El repo ya tiene el
 * patron para un catalogo chico y tipado (`ENTITLEMENTS`), donde una entrada mal formada **no
 * compila**.
 */

/**
 * Los hechos con los que se resuelve el `done` de cada item.
 *
 * **Su costo esta escrito en `checklist-facts.ts` y son DOS lecturas por request**: la segunda
 * resolucion de sesion (que ya venia) **mas una consulta** a `core.business_onboarding_tour`.
 * Es el precedente de la 0083, cuyo §D4 decia «cero consultas extra» y quedo falso al
 * enmendarse: un docblock que miente sobre el costo es un defecto activo en este repo.
 */
export type ChecklistFacts = {
  emailVerified: boolean;
  /** Los `tour_id` con fila en `core.business_onboarding_tour`, sea `completed` o `skipped`.
   * Los dos cuentan como hecho (ADR 0078 §2, decision textual del owner). */
  toursHechos: ReadonlySet<string>;
};

export type ChecklistItemDef = {
  /** Orden. Lo dicta la API, nunca la UI (ADR 0077 §2). */
  position: number;
  /**
   * UN SOLO EJE, y es el que definio el owner el 2026-09-20 (*«required es importante porque
   * sin eso no se puede hacer nada mas»*, *«colapsa a un campo»*): `required: true` significa
   * **hay que hacerlo, y mientras no este `done` los items de `position` mayor estan
   * bloqueados**.
   *
   * El campo que estaba al lado —el que separaba «hay que hacerlo» de «frena al resto»— **se
   * borro en la spec 0085**: con los cinco items reales los dos valen lo mismo en los cinco
   * casos, y sacarlo del JSON costaba cero mientras ninguna UI lo consumiera.
   *
   * **`verify-email` es el UNICO `required: true`.** Los cuatro tours son `false`: se pueden
   * saltear (ADR 0078 §2) y no traban a nadie.
   */
  required: boolean;
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
   * distinto — el del email sale de la sesion, el de un tour de la tabla de progreso.
   */
  done: (facts: ChecklistFacts) => boolean;
};

export type ChecklistItemView = {
  id: string;
  position: number;
  required: boolean;
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
 * La COPIA de cada tour, y nada mas que la copia. **No es una segunda lista de ids**: esta
 * tipada como `Record<OnboardingTourId, …>`, asi que si `ONBOARDING_TOURS` gana o pierde un id
 * este objeto **no compila** hasta que se lo acompañe. Los ids siguen saliendo de un solo lado.
 */
const TOUR_COPY: Record<OnboardingTourId, { title: string; body: string }> = {
  staff: {
    title: "Conocé la pantalla de Equipo",
    body: "Un recorrido corto por donde se da de alta a quien atiende el mostrador.",
  },
  catalog: {
    title: "Conocé tu catálogo",
    body: "Un recorrido corto por donde cargás y editás lo que vendés.",
  },
  program: {
    title: "Conocé tu programa de fidelidad",
    body: "Un recorrido corto por los sellos, los premios y las condiciones.",
  },
  brand: {
    title: "Conocé tu marca",
    body: "Un recorrido corto por el logo, los colores y cómo se ve tu tarjeta.",
  },
};

/**
 * LOS CINCO ITEMS (ADR 0078 §1). El primero deriva de la sesion; los otros cuatro de
 * `core.business_onboarding_tour`.
 *
 * **Los ids de los tours salen de `ONBOARDING_TOURS`** (`onboarding/tours.ts`, spec 0084), que
 * es lo mismo que usa la ESCRITURA para rechazar un id desconocido con `404`. Dos listas se
 * desincronizan: el `POST` aceptaria un tour que el checklist no muestra, o al reves. Su
 * `position` tambien sale de ahi (el indice), asi que tampoco hay un orden escrito dos veces.
 *
 * **Que la pantalla de un tour no exista todavia NO bloquea** (ADR 0078 §6): su `done` queda en
 * `false`, nadie manda un `POST` por el, y como ningun tour es `required` no traba a los que
 * siguen. Hoy `/backoffice/staff` no existe (`backoffice-navigation.tsx:37`, `href: null`).
 */
export const CHECKLIST_ITEMS: Record<string, ChecklistItemDef> = {
  "verify-email": {
    position: 1,
    // El UNICO obligatorio, por decision textual del owner: «sin eso no se puede hacer nada
    // mas […] de hecho ser la unica».
    required: true,
    anchor: "verify-email",
    title: "Verificá tu email",
    body: "Te enviamos un enlace al correo con el que te registraste. Confirmalo para desbloquear el resto del onboarding.",
    done: (facts: ChecklistFacts) => facts.emailVerified,
  },
  ...Object.fromEntries(
    ONBOARDING_TOURS.map((tourId, indice) => [
      tourId,
      {
        position: indice + 2,
        required: false,
        anchor: tourId,
        ...TOUR_COPY[tourId],
        // `has` sobre el conjunto de tours con fila: `completed` y `skipped` entran los dos
        // (ADR 0078 §2). El JSON no dice cual de los dos fue — su contrato es `done: boolean`.
        done: (facts: ChecklistFacts) => facts.toursHechos.has(tourId),
      } satisfies ChecklistItemDef,
    ]),
  ),
};

/**
 * Arma la vista que sale por HTTP. **Es pura**: no toca base ni sesion, asi que su test no
 * necesita Neon.
 *
 * **El segundo parametro tiene default y SIGUE EXISTIENDO por su oraculo** (spec 0083 §D2, y
 * la 0085 lo conserva a proposito): es la unica forma de alimentar entradas SINTETICAS
 * DESORDENADAS, que el catalogo real —ya ordenado— no puede producir. **La ruta lo llama SIN
 * el segundo argumento.**
 *
 * El `sort` por `position` se hace aca y **no se asume del orden de declaracion** del objeto:
 * los cuatro tours entran por un spread de `Object.fromEntries` y el dia que el catalogo mude a
 * tabla el orden de las filas no esta garantizado. Un `sort` que ya esta puesto es lo que evita
 * que ese dia el bug sea silencioso.
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
        done: def.done(facts),
        anchor: def.anchor,
        title: def.title,
        body: def.body,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

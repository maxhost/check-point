import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **EL `503 onboarding_unavailable` DE LAS DOS RUTAS DE ONBOARDING.**
 *
 * Cierra el limite que las specs 0083, 0084 y 0085 declararon afuera las tres veces
 * («pendiente de decision del owner»): el `catch` de ultima linea de
 * `GET /api/onboarding/checklist` y de `POST /api/onboarding/tours/{tourId}` **no tenia
 * oraculo en ningun archivo**. Decision del owner del 2026-09-20: se cierra.
 *
 * ### Va con DOBLES y no contra Neon, y el motivo es de contrato
 *
 * Igual que `onboarding-program-503.test.ts`, su precedente. Para que la lectura falle de
 * verdad contra una base real habria que tirarle la base abajo a mitad de la suite. Lo que
 * este archivo pinnea es lo que **si** depende de la ruta: el `status`, el `code`, que **no
 * se invente un desenlace positivo**, y **que el mensaje de la excepcion NO se filtre**.
 *
 * ### La asercion que importa es la del NO-FILTRADO, y no es cosmetica
 *
 * Las dos rutas declaran en su docblock que el `catch` **emite solo `error.name`, nunca el
 * mensaje**, porque un mensaje de excepcion puede arrastrar datos de la fila que lo produjo
 * (un `slug`, un `business_id`, el texto de un `constraint`). **Esa propiedad no tenia ni un
 * test**: se regresa sin que nadie lo vea con solo escribir `error.message` en el
 * `console.error`. Por eso el doble tira un error cuyo mensaje es un centinela y se asevera
 * que ese centinela **no aparece ni en el cuerpo HTTP ni en lo que se logueo**.
 *
 * ### Y por que hay CONTROL POSITIVO en las dos
 *
 * Sin el, un doble que siempre falle dejaria los casos de arriba en verde aunque la ruta
 * nunca contestara bien en ningun escenario. Es la misma forma del precedente.
 */
const FUGA =
  "slug=la-farmacia business_id=11111111-1111-4111-8111-111111111111";

const world = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; emailVerified: boolean };
    session: { onboardingGrantUntil: Date | null };
  },
  checklistFacts: vi.fn(),
  recordTourProgress: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

/** El guard entero —sus cinco estados del caller— es `api-owner-surfaces.test.ts`. Aca se
 * dobla en `active` a proposito: este archivo mide el `catch`, no la escalera. */
vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    slug: "la-farmacia",
    currencyCode: "USD",
    status: "active",
    suspensionReason: null,
  }),
}));

vi.mock("./onboarding/checklist-facts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./onboarding/checklist-facts")>()),
  checklistFacts: world.checklistFacts,
}));

/** `importOriginal` esparcido NO es opcional aca: la ruta valida el `tourId` con
 * `isOnboardingTourId` y el cuerpo con `isTourStatus`. Si el mock los tapara, el caso caeria
 * en un `404 unknown_tour` y este archivo pinnearia el doble en vez del `catch`. */
vi.mock("./onboarding/tours", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./onboarding/tours")>()),
  recordTourProgress: world.recordTourProgress,
}));

import { GET as CHECKLIST } from "../app/api/onboarding/checklist/route";
import { POST as TOURS } from "../app/api/onboarding/tours/[tourId]/route";

const pedirChecklist = () =>
  CHECKLIST(new Request("http://localhost:3001/api/onboarding/checklist"));

const pedirTour = (tourId = "staff") =>
  TOURS(
    new Request(`http://localhost:3001/api/onboarding/tours/${tourId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }),
    { params: Promise.resolve({ tourId }) },
  );

let logueado: string[] = [];
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  logueado = [];
  errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      logueado.push(args.map((a) => JSON.stringify(a)).join(" "));
    });
  world.session = {
    user: { id: "user-503", emailVerified: true },
    session: { onboardingGrantUntil: null },
  };
});

afterEach(() => errorSpy.mockRestore());

describe("GET /api/onboarding/checklist — el 503 de ultima linea", () => {
  it("con la lectura de hechos caida: 503 `onboarding_unavailable`, sin items y SIN filtrar el mensaje", async () => {
    world.checklistFacts.mockRejectedValue(new Error(FUGA));
    const response = await pedirChecklist();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("onboarding_unavailable");
    // Fail-closed: un error de lectura NO puede devolver un checklist a medias ni un item
    // dado por hecho. No hay `items` en el cuerpo del 503.
    expect(body.items).toBeUndefined();
    // LA ASERCION DEL NO-FILTRADO, en los dos canales.
    expect(JSON.stringify(body)).not.toContain(FUGA);
    expect(logueado.join(" ")).not.toContain(FUGA);
    // Y lo que SI se loguea es el nombre de la clase, que es lo que el docblock promete.
    expect(logueado.join(" ")).toContain("Error");
  });

  /** CONTROL POSITIVO — sin esto el caso de arriba quedaria verde aunque la ruta nunca
   * contestara 200 en ningun escenario. */
  it("con la lectura sana, la MISMA ruta contesta 200 con los cinco items", async () => {
    world.checklistFacts.mockResolvedValue({
      emailVerified: true,
      toursHechos: new Set<string>(),
    });
    const response = await pedirChecklist();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(5);
  });
});

describe("POST /api/onboarding/tours/{tourId} — el 503 de ultima linea", () => {
  it("con la escritura caida: 503 `onboarding_unavailable` y NUNCA un 200", async () => {
    world.recordTourProgress.mockRejectedValue(new Error(FUGA));
    const response = await pedirTour();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("onboarding_unavailable");
    // El recibo del camino feliz no puede aparecer cuando la escritura fallo: si la ruta
    // devolviera `{tourId, status}` igual, la UI marcaria el tour como hecho sin que exista
    // la fila.
    expect(body.tourId).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(FUGA);
    expect(logueado.join(" ")).not.toContain(FUGA);
    expect(logueado.join(" ")).toContain("Error");
  });

  /** CONTROL POSITIVO, y ademas prueba que el mock no tapo la validacion del `tourId`. */
  it("con la escritura sana, la MISMA ruta contesta 200 y llama al writer una vez", async () => {
    world.recordTourProgress.mockResolvedValue(undefined);
    const response = await pedirTour();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tourId: "staff",
      status: "completed",
    });
    expect(world.recordTourProgress).toHaveBeenCalledTimes(1);
  });
});

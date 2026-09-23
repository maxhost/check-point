import { describe, expect, it, vi, beforeEach } from "vitest";
import { consoleEmailOutbox } from "./email/console";
import { ConsoleEmailChannel } from "./email/console";

/**
 * Spec 0090 §7 / ADR 0082 §12 — EL AVISO, **una sola vez y AL NEGOCIO**.
 *
 * El destinatario cae al **owner activo** cuando el buzon de quien pidio el analisis no sirve
 * (decision del ORQUESTADOR del 2026-09-22, reversible — no del owner). Sin eso, un import
 * pedido por un integrante no le llegaba a **nadie**: su email es el sintetico
 * `staff-<uuid>@staff.invalid`, que nunca se entrega.
 *
 * Sale por el fake de consola (`consoleEmailOutbox`), que es lo que la spec pide para los
 * tests.
 */
const estado = {
  filas: [] as unknown[][],
  sets: [] as Record<string, unknown>[],
};

vi.mock("./db", () => {
  const nuevaCadena = () => {
    const cadena: Record<string, unknown> = {};
    for (const metodo of [
      "select",
      "from",
      "where",
      "limit",
      "update",
      "returning",
      "innerJoin",
    ]) {
      cadena[metodo] = () => cadena;
    }
    cadena.set = (valor: Record<string, unknown>) => {
      estado.sets.push(valor);
      return cadena;
    };
    cadena.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(estado.filas.shift() ?? []).then(resolve, reject);
    return cadena;
  };
  return { getDb: nuevaCadena, withDbTransaction: async () => undefined };
});

const { notifyImportFinished } = await import("./catalog-import/notify");

const IMPORT_ID = "11111111-1111-4111-8111-111111111111";
const NEGOCIO_ID = "22222222-2222-4222-8222-222222222222";

const reclamada = {
  id: IMPORT_ID,
  businessId: NEGOCIO_ID,
  createdByUserId: "u-autor",
};

const canal = new ConsoleEmailChannel();

beforeEach(() => {
  estado.filas = [];
  estado.sets = [];
  consoleEmailOutbox.length = 0;
});

describe("aviso por email de la importación (spec 0090 §7)", () => {
  it("le llega a quien pidió el análisis, con el asunto del resultado", async () => {
    estado.filas = [[reclamada], [{ email: "duena@example.test" }]];
    expect(await notifyImportFinished(IMPORT_ID, "ready", canal)).toBe("sent");
    expect(consoleEmailOutbox).toHaveLength(1);
    expect(consoleEmailOutbox[0]).toMatchObject({
      to: "duena@example.test",
      subject: "Tu menú ya está listo para revisar",
    });
  });

  it("al fallar también avisa, con otro asunto", async () => {
    estado.filas = [[reclamada], [{ email: "duena@example.test" }]];
    expect(await notifyImportFinished(IMPORT_ID, "failed", canal)).toBe("sent");
    expect(consoleEmailOutbox[0].subject).toBe("No pudimos leer tu menú");
  });

  /** El agujero que esta decisión cierra. */
  it("si lo pidió un INTEGRANTE, cae al OWNER del negocio — no se pierde", async () => {
    estado.filas = [
      [reclamada],
      [{ email: "staff-abc@staff.invalid" }],
      [{ email: "duena@example.test" }],
    ];
    expect(await notifyImportFinished(IMPORT_ID, "ready", canal)).toBe("sent");
    expect(consoleEmailOutbox[0].to).toBe("duena@example.test");
  });

  it("sin ningún buzón usable, `no_recipient` en vez de mandar a la nada", async () => {
    estado.filas = [
      [reclamada],
      [{ email: "staff-abc@staff.invalid" }],
      [{ email: "otro-staff@staff.invalid" }],
    ];
    expect(await notifyImportFinished(IMPORT_ID, "ready", canal)).toBe(
      "no_recipient",
    );
    expect(consoleEmailOutbox).toHaveLength(0);
  });

  /** La marca se RECLAMA antes de mandar: el `UPDATE … WHERE notified_at IS NULL` sin fila
   * significa que otro ya ganó, y ahí no se manda un segundo mail. */
  it("si otro ya reclamó la marca, no manda un segundo mail", async () => {
    estado.filas = [[]];
    expect(await notifyImportFinished(IMPORT_ID, "ready", canal)).toBe(
      "already_notified",
    );
    expect(consoleEmailOutbox).toHaveLength(0);
  });

  it("el cuerpo NO lleva nombres de productos ni fragmentos del menú (§9)", async () => {
    estado.filas = [[reclamada], [{ email: "duena@example.test" }]];
    await notifyImportFinished(IMPORT_ID, "ready", canal);
    const enviado = JSON.stringify(consoleEmailOutbox[0]);
    for (const interno of [IMPORT_ID, NEGOCIO_ID, "u-autor"]) {
      expect(enviado).not.toContain(interno);
    }
  });
});

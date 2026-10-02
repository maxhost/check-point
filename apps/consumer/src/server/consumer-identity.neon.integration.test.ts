import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import {
  dropWorld,
  owner,
  roleSuite,
  trackConsumer,
  useRoleConnection,
} from "./consumer-role-support";

useRoleConnection();

import { findOrCreateAccountByIdentity } from "@mi-pasaporte/domain/server/consumer/identity";

/**
 * Spec 0119 / ADR 0111 §3 y §5 — la identidad `(provider, subject)`, COMO `checkpass_consumer`.
 * ORACULO DE M1 («dos `sub` con el mismo email → dos cuentas»: unir por email le daria a uno la
 * cuenta del otro) y de M5 («identidad existente + nombres nuevos → la cuenta byte a byte
 * igual»: entrar no reescribe el perfil).
 */

afterAll(dropWorld, 120_000);

const subject = () => `sub-0119-${randomUUID()}`;

async function accountRow(id: string) {
  const [row] =
    await owner`select * from consumer.consumer_account where id = ${id}`;
  return row;
}

roleSuite("identidad del cliente — (provider, subject)", () => {
  it("la misma identidad dos veces → UNA cuenta, sin telefono ni pais", async () => {
    const sub = subject();
    const input = {
      provider: "google" as const,
      subject: sub,
      email: "ana@example.test",
      firstName: "Ana",
      lastName: "Pérez",
    };
    const first = await findOrCreateAccountByIdentity(input);
    trackConsumer(first.id);
    const second = await findOrCreateAccountByIdentity(input);
    expect(second.id).toBe(first.id);
    const rows =
      await owner`select a.phone_e164, a.country_iso, a.email, i.email as identity_email
      from consumer.consumer_identity i join consumer.consumer_account a on a.id = i.consumer_id
      where i.provider = 'google' and i.subject = ${sub}`;
    expect(rows).toEqual([
      {
        phone_e164: null,
        country_iso: null,
        email: "ana@example.test",
        identity_email: "ana@example.test",
      },
    ]);
  });

  it("dos `sub` con el MISMO email → DOS cuentas (nunca se une por email)", async () => {
    const email = `misma-${randomUUID()}@example.test`;
    const google = await findOrCreateAccountByIdentity({
      provider: "google",
      subject: subject(),
      email,
      firstName: "Ana",
      lastName: "Google",
    });
    trackConsumer(google.id);
    const apple = await findOrCreateAccountByIdentity({
      provider: "apple",
      subject: subject(),
      email,
      firstName: "Ana",
      lastName: "Apple",
    });
    trackConsumer(apple.id);
    expect(apple.id).not.toBe(google.id);
    const rows =
      await owner`select count(*)::int as n from consumer.consumer_account where email = ${email}`;
    expect(rows).toEqual([{ n: 2 }]);
  });

  it("identidad existente + nombres nuevos → la cuenta queda byte a byte igual", async () => {
    const sub = subject();
    const created = await findOrCreateAccountByIdentity({
      provider: "apple",
      subject: sub,
      email: "relay@privaterelay.appleid.com",
      firstName: "Bea",
      lastName: "Ruiz",
    });
    trackConsumer(created.id);
    const before = await accountRow(created.id);
    const again = await findOrCreateAccountByIdentity({
      provider: "apple",
      subject: sub,
      email: "otro@example.test",
      firstName: "OTRO",
      lastName: "NOMBRE",
    });
    expect(again.id).toBe(created.id);
    expect(again.firstName).toBe("Bea");
    expect(await accountRow(created.id)).toEqual(before);
  });

  it("sin nombre del proveedor → nombres vacios (las columnas siguen NOT NULL)", async () => {
    const account = await findOrCreateAccountByIdentity({
      provider: "apple",
      subject: subject(),
      email: null,
      firstName: null,
      lastName: null,
    });
    trackConsumer(account.id);
    expect(await accountRow(account.id)).toMatchObject({
      first_name: "",
      last_name: "",
      email: null,
    });
  });
});

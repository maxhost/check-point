/**
 * `pnpm db:local:seed` — datos FICTICIOS para la base local (spec 0167 §5). Nunca una copia de
 * PROD (owner, ADR 0126: PROD tiene datos personales de clientes reales).
 *
 * - 2 comercios, cada uno con su usuario de merchant (owner, email `@example.test`), un local,
 *   la suscripcion free, 1 programa activo y 3 productos de catalogo.
 * - 3 clientes con tarjeta (telefonos de la serie ficticia +54 9 11 5555-0xxx); uno con sellos y
 *   un cupon de bienvenida disponible.
 * - No toca `core.terms_template`: la siembran las migraciones.
 *
 * Idempotente: cada fila tiene id fijo y entra con `on conflict do nothing`, todo en UNA
 * transaccion. Rechaza (exit 1, sin conectar) un host que no sea local.
 */
import { createHash } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { localDbUrlOrExit, quietPool } from "./local.ts";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Business = {
  n: number;
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
  program: {
    kind: "stamps" | "points";
    configuration: object;
    mode: string;
    block: string | null;
  };
  products: [string, string][];
};

const BUSINESSES: Business[] = [
  {
    n: 1,
    name: "Café Ejemplo",
    slug: "cafe-ejemplo",
    ownerEmail: "owner-cafe@example.test",
    ownerName: "Ana Ejemplo",
    program: {
      kind: "stamps",
      configuration: { unitName: "sello", unitPlural: "sellos", target: 10 },
      mode: "per_purchase",
      block: null,
    },
    products: [
      ["Café con leche", "2500.00"],
      ["Medialuna", "1200.00"],
      ["Tostado", "4800.00"],
    ],
  },
  {
    n: 2,
    name: "Panadería Prueba",
    slug: "panaderia-prueba",
    ownerEmail: "owner-panaderia@example.test",
    ownerName: "Bruno Prueba",
    program: {
      kind: "points",
      configuration: { unitSingular: "punto", unitPlural: "puntos" },
      mode: "per_amount",
      block: "1000.00",
    },
    products: [
      ["Pan de campo", "3000.00"],
      ["Factura", "900.00"],
      ["Budín", "5200.00"],
    ],
  },
];

// Ids fijos por bloque: negocio n → usuario 1n0, local 1n1, programa 1n2, productos 1n3..1n5.
const ids = (b: Business) => ({
  user: id(100 + b.n * 10),
  business: id(100 + b.n * 10),
  location: id(101 + b.n * 10),
  program: id(102 + b.n * 10),
  products: [id(103 + b.n * 10), id(104 + b.n * 10), id(105 + b.n * 10)],
});

const CONSUMERS = [
  {
    n: 1,
    first: "Carla",
    last: "Ficticia",
    business: 1,
    stamps: 4,
    coupon: true,
  },
  {
    n: 2,
    first: "Diego",
    last: "Inventado",
    business: 1,
    stamps: 0,
    coupon: false,
  },
  { n: 3, first: "Elena", last: "Demo", business: 2, stamps: 0, coupon: false },
];

const termsFor = (b: Business) =>
  `# Términos de ${b.name}\n\nPrograma de prueba del ambiente local. Datos ficticios.\n`;

type Query = { text: string; values: unknown[] };
const q = (text: string, ...values: unknown[]): Query => ({ text, values });

function businessRows(b: Business): Query[] {
  const k = ids(b);
  const terms = termsFor(b);
  return [
    q(
      `insert into merchant_auth."user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, $2, $3, true, now(), now()) on conflict do nothing`,
      k.user,
      b.ownerName,
      b.ownerEmail,
    ),
    q(
      `insert into core.owner_profile (user_id, full_name) values ($1, $2) on conflict do nothing`,
      k.user,
      b.ownerName,
    ),
    q(
      `insert into core.business (id, name, slug, country_code, timezone, currency_code)
       values ($1, $2, $3, 'AR', 'America/Argentina/Buenos_Aires', 'ARS') on conflict do nothing`,
      k.business,
      b.name,
      b.slug,
    ),
    q(
      `insert into core.business_membership (business_id, user_id, role) values ($1, $2, 'owner')
       on conflict do nothing`,
      k.business,
      k.user,
    ),
    q(
      `insert into core.location (id, business_id, name, address_label, longitude, latitude, country_code, address_snapshot)
       values ($1, $2, 'Principal', 'Calle Ficticia 123, CABA', '-58.3816', '-34.6037', 'AR', '{}'::jsonb)
       on conflict do nothing`,
      k.location,
      k.business,
    ),
    q(
      `insert into core.subscription (id, business_id, plan, status) values ($1, $2, 'free', 'active')
       on conflict do nothing`,
      k.business,
      k.business,
    ),
    q(
      `insert into core.loyalty_program
         (id, business_id, status, kind, configuration, terms_markdown, terms_hash, created_by,
          accrual_mode, accrual_grant, accrual_block_amount)
       values ($1, $2, 'active', $3, $4::jsonb, $5, $6, $7, $8, 1, $9) on conflict do nothing`,
      k.program,
      k.business,
      b.program.kind,
      JSON.stringify(b.program.configuration),
      terms,
      createHash("sha256").update(terms).digest("hex"),
      k.user,
      b.program.mode,
      b.program.block,
    ),
    ...b.products.map(([name, price], i) =>
      q(
        `insert into core.product (id, business_id, name, unit_price) values ($1, $2, $3, $4)
         on conflict do nothing`,
        k.products[i],
        k.business,
        name,
        price,
      ),
    ),
  ];
}

function consumerRows(c: (typeof CONSUMERS)[number]): Query[] {
  const b = BUSINESSES.find((x) => x.n === c.business)!;
  const k = ids(b);
  const consumer = id(200 + c.n);
  const membership = id(210 + c.n);
  const rows = [
    q(
      `insert into consumer.consumer_account
         (id, phone_e164, phone_verified_at, first_name, last_name, qr_token, web_view_token, country_iso, email)
       values ($1, $2, now(), $3, $4, $5, $6, 'AR', $7) on conflict do nothing`,
      consumer,
      `+54911555500${String(c.n).padStart(2, "0")}`,
      c.first,
      c.last,
      `seed-local-qr-${c.n}`,
      `seed-local-web-${c.n}`,
      `cliente-${c.n}@example.test`,
    ),
    q(
      `insert into consumer.program_membership (id, consumer_id, program_id, business_id, stamps_count, origin_location_id)
       values ($1, $2, $3, $4, $5, $6) on conflict do nothing`,
      membership,
      consumer,
      k.program,
      k.business,
      c.stamps,
      k.location,
    ),
    // La proyeccion del listado de clientes, con la misma formula que `customers/projection.ts`.
    q(
      `insert into core.business_customer (business_id, consumer_id, display_name, search_name, phone_e164, enrolled_at)
       select pm.business_id, pm.consumer_id, a.first_name || ' ' || a.last_name,
              lower(public.unaccent('public.unaccent'::regdictionary, a.first_name || ' ' || a.last_name)),
              a.phone_e164, pm.enrolled_at
         from consumer.program_membership pm join consumer.consumer_account a on a.id = pm.consumer_id
        where pm.id = $1
       on conflict do nothing`,
      membership,
    ),
  ];
  if (c.coupon) rows.push(...welcomeCoupon(b, consumer, membership));
  return rows;
}

/** Un cupon de bienvenida disponible (producto gratis), atado a la tarjeta del cliente. */
function welcomeCoupon(
  b: Business,
  consumer: string,
  membership: string,
): Query[] {
  const k = ids(b);
  const campaign = id(300 + b.n);
  const label = "Café de bienvenida";
  return [
    q(
      `insert into core.campaign
         (id, business_id, kind, name, status, message, coupon_label, coupon_cost, coupon_kind,
          coupon_product_id, starts_at, activated_at, created_by_user_id, template_key,
          channel_proximity, channel_push, welcome_valid_days, welcome_reminder_days,
          welcome_monthly_cap, welcome_redeem_from)
       values ($1, $2, 'proximity', 'Bienvenida', 'active', 'Tu primer café va por nuestra cuenta',
               $3, 0, 'free_product', $4, now(), now(), $5, 'welcome', false, false, 30, 7, 100, 'same_visit')
       on conflict do nothing`,
      campaign,
      k.business,
      label,
      k.products[0],
      k.user,
    ),
    q(
      `insert into core.campaign_coupon
         (id, campaign_id, business_id, consumer_id, membership_id, welcome_membership_id,
          label_snapshot, cost_snapshot, kind_snapshot, product_id, valid_from, valid_until)
       values ($1, $2, $3, $4, $5, $5, $6, 0, 'free_product', $7, now() - interval '1 day',
               now() + interval '365 days')
       on conflict do nothing`,
      id(310 + b.n),
      campaign,
      k.business,
      consumer,
      membership,
      label,
      k.products[0],
    ),
  ];
}

const url = localDbUrlOrExit("db:local:seed");
const pool = quietPool(new Pool({ connectionString: url }));
const client = await pool.connect();
client.on("error", (e: Error & { code?: string }) =>
  console.error(`client error ${e.code ?? ""} ${e.message}`),
);
try {
  await client.query("begin");
  let inserted = 0;
  for (const row of [
    ...BUSINESSES.flatMap(businessRows),
    ...CONSUMERS.flatMap(consumerRows),
  ])
    inserted += (await client.query(row.text, row.values)).rowCount ?? 0;
  await client.query("commit");
  console.log(
    `db:local:seed: ok (${inserted} filas nuevas; 0 = ya estaba sembrada)`,
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  const e = error as { code?: string; message?: string };
  console.error(`db:local:seed: FALLO ${e.code ?? ""} ${e.message ?? ""}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

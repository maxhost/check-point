/**
 * The recording double of `../db` for `enrollment-name.test.ts`, apart by the `file-size` hook
 * (300 lines): dividir, no extender. Moved AS IS from the test — `state` is the same object the
 * test reads and resets; only its location changed.
 */
export type Row = Record<string, unknown>;
export type Statement = { kind: string; table: string; payload?: Row };

export const state = {
  // FIFO of results for `select … from(<table>) … limit(1)`, keyed by table name.
  reads: {} as Record<string, Row[][]>,
  // Rows the fake "stores", by id — an update returns the merge of row + set payload.
  rows: {} as Record<string, Row>,
  // When set, the account insert rejects with this pg error (race simulation).
  insertAccountError: null as { code: string } | null,
  // When set, the membership insert rejects with this pg error (409 already_member).
  insertMembershipError: null as { code: string } | null,
  statements: [] as Statement[],
};

function nextRead(table: string): Row[] {
  const queue = state.reads[table];
  if (!queue || queue.length === 0) return [];
  return queue.shift() as Row[];
}

export async function dbDouble() {
  const { getTableName } = await import("drizzle-orm");
  type Pending = { table: string; payload?: Row };
  type Chain = {
    from(table: unknown): Chain;
    innerJoin(): Chain;
    where(): Chain;
    set(payload: Row): Chain;
    values(payload: Row): Chain;
    limit(): Promise<Row[]>;
    returning(): Promise<Row[]>;
  };

  function builder(kind: string): Chain {
    const pending: Pending = { table: "?" };
    const chain: Chain = {
      from(table: unknown) {
        pending.table = getTableName(table as never);
        return chain;
      },
      // Spec 0072 §D4: `loadEnrollableProgram` hace `innerJoin(businesses)` para leer el
      // eje `status` del negocio. El doble tiene que ofrecer el MISMO encadenamiento que el
      // consumidor real, o el 403 del alta nueva se vería como un `TypeError`.
      innerJoin() {
        return chain;
      },
      where() {
        return chain;
      },
      set(payload: Row) {
        pending.payload = payload;
        return chain;
      },
      values(payload: Row) {
        pending.payload = payload;
        return chain;
      },
      limit() {
        state.statements.push({ kind, table: pending.table });
        return Promise.resolve(nextRead(pending.table));
      },
      returning() {
        state.statements.push({
          kind,
          table: pending.table,
          payload: pending.payload,
        });
        if (kind === "update") {
          const target = Object.values(state.rows).find(
            (row) => row.__table === pending.table,
          );
          if (!target) return Promise.resolve([]);
          const merged = { ...target, ...pending.payload };
          state.rows[target.id as string] = merged;
          return Promise.resolve([merged]);
        }
        if (pending.table === "consumer_account") {
          if (state.insertAccountError)
            return Promise.reject(state.insertAccountError);
          return Promise.resolve([
            { id: "acc-new", __table: "consumer_account", ...pending.payload },
          ]);
        }
        if (state.insertMembershipError)
          return Promise.reject(state.insertMembershipError);
        return Promise.resolve([
          {
            id: "membership-1",
            enrolledAt: new Date("2026-09-05T00:00:00Z"),
            ...pending.payload,
          },
        ]);
      },
    };
    return chain;
  }

  // Spec 0108: the membership insert is now ONE raw statement that also writes its row of
  // `core.business_customer` (`customers/projection.ts`). The double records EVERY table the
  // statement inserts into, read from the rendered SQL, and keeps the membership knob: a set
  // `insertMembershipError` rejects the whole statement, exactly like the real `23505`.
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  async function execute(query: never) {
    const { sql: text, params } = dialect.sqlToQuery(query);
    const tables = [...text.matchAll(/INSERT INTO\s+\w+\.(\w+)/gi)].map(
      (match) => match[1],
    );
    for (const table of tables)
      state.statements.push({ kind: "insert", table });
    if (state.insertMembershipError) throw state.insertMembershipError;
    return {
      rows: [
        {
          id: "membership-1",
          consumer_id: params[0],
          program_id: params[1],
          business_id: params[2],
          origin_location_id: params[3],
          points_balance: 0,
          stamps_count: 0,
          enrolled_at: "2026-09-05T00:00:00Z",
        },
      ],
    };
  }

  return {
    getDb: () => ({
      execute,
      select: () => builder("select"),
      insert: (table: unknown) => builder("insert").from(table),
      update: (table: unknown) => builder("update").from(table),
      delete: (table: unknown) => builder("delete").from(table),
    }),
  };
}

/** Local opt-in diagnostic. No parameters, SQL text, auth or result bodies leave the hook. */
type Trace = {
  queryStart(text: string, transport: string): (ok: boolean) => void;
};
export function instrumentPosPool(pool: {
  on(
    event: "connect",
    callback: (client: { query: (...args: unknown[]) => unknown }) => void,
  ): unknown;
}) {
  const trace = (globalThis as typeof globalThis & { __posMeasurement?: Trace })
    .__posMeasurement;
  if (!trace) return;
  pool.on("connect", (client) => {
    const original = client.query;
    client.query = function (...args: unknown[]) {
      const statement = args[0];
      const finish = trace.queryStart(
        typeof statement === "string"
          ? statement
          : String((statement as { text?: string })?.text ?? ""),
        "ws",
      );
      const callback = args.at(-1);
      if (typeof callback === "function") {
        args[args.length - 1] = function (
          error: unknown,
          ...values: unknown[]
        ) {
          finish(!error);
          return callback(error, ...values);
        };
        try {
          return original.apply(this, args);
        } catch (error) {
          finish(false);
          throw error;
        }
      }
      try {
        return Promise.resolve(original.apply(this, args)).then(
          (value) => {
            finish(true);
            return value;
          },
          (error) => {
            finish(false);
            throw error;
          },
        );
      } catch (error) {
        finish(false);
        throw error;
      }
    };
  });
}

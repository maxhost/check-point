/** Personal shortcuts from already scoped, newest-first detailed orders. */
export function personalPicks(
  recent: { id: string }[],
  lines: { orderId: string; productId: string | null; quantity: number }[],
  catalog: { id: string; name: string }[],
) {
  const valid = new Set(catalog.map((product) => product.id));
  const names = new Map(catalog.map((product) => [product.id, product.name]));
  const counts = new Map<string, { count: number; recentIndex: number }>();
  recent.forEach((order, recentIndex) => {
    const orderProducts = new Set(
      lines
        .filter((line) => line.orderId === order.id)
        .map((line) => line.productId),
    );
    for (const productId of orderProducts) {
      if (!productId || !valid.has(productId)) continue;
      const prior = counts.get(productId);
      counts.set(productId, {
        count: (prior?.count ?? 0) + 1,
        recentIndex: prior?.recentIndex ?? recentIndex,
      });
    }
  });
  const habitualProductIds = [...counts]
    .filter(([, value]) => value.count >= 2)
    .sort(
      ([a, av], [b, bv]) =>
        bv.count - av.count ||
        av.recentIndex - bv.recentIndex ||
        (names.get(a) ?? "").localeCompare(names.get(b) ?? "", "es"),
    )
    .slice(0, 6)
    .map(([id]) => id);
  const newestLines = lines.filter((line) => line.orderId === recent[0]?.id);
  const lastPurchase =
    newestLines.length >= 1 &&
    newestLines.length <= 8 &&
    newestLines.every(
      (line) =>
        line.productId && valid.has(line.productId) && line.quantity > 0,
    )
      ? {
          items: newestLines.map((line) => ({
            productId: line.productId!,
            quantity: line.quantity,
          })),
        }
      : null;
  return { habitualProductIds, lastPurchase };
}

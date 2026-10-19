import type {
  PosCatalogV2,
  PosLocationV2,
  PosOrderV2,
  PosNewLineV2,
  SaleType,
} from "../contracts";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  CONVERSION_VERSION,
  normalizedGross,
} from "@mi-pasaporte/domain/measures";
import { rational } from "@mi-pasaporte/domain/financial/rational";
import {
  existingCartLine,
  resolvedCartLine,
  serializeMeasuredCart,
  type MeasuredCartLine,
} from "./measured-cart-model";
import { MeasuredOrderCommands } from "./measured-order-commands";
import { catalogKey, PosCache } from "./pos-cache";
import type { PosClient } from "./pos-context";
import { PosError } from "./pos-types";

export type MeasuredEditorContext = {
  identity: string;
  locations: PosLocationV2[];
  currencyCode: string;
  saleTypes: Exclude<SaleType, "legacy">[];
  tablesEnabled: boolean;
  lastLocationId?: string;
  initialSaleType?: Exclude<SaleType, "legacy">;
  initialIdentification?: { tableId: string | null; orderLabel: string };
};
export type MeasuredEditorDraft = {
  saleType: SaleType;
  locationId: string;
  tableId: string | null;
  orderLabel: string;
  note: string;
  lines: MeasuredCartLine[];
};
function draftFor(
  order: PosOrderV2 | null,
  context: MeasuredEditorContext,
): MeasuredEditorDraft {
  return {
    saleType:
      order?.saleType ??
      (context.initialSaleType &&
      context.saleTypes.includes(context.initialSaleType)
        ? context.initialSaleType
        : (context.saleTypes[0] ?? "counter")),
    locationId: order
      ? (order.location?.id ?? "")
      : context.locations.length === 1
        ? context.locations[0].id
        : (context.locations.find((l) => l.id === context.lastLocationId)?.id ??
          ""),
    tableId: order
      ? order.tableId
      : (context.initialIdentification?.tableId ?? null),
    orderLabel:
      order?.orderLabel ?? context.initialIdentification?.orderLabel ?? "",
    note: order?.note ?? "",
    lines: order?.items.map(existingCartLine) ?? [],
  };
}
export function measuredEditorAmounts(
  lines: MeasuredCartLine[],
  units: PosCatalogV2["salesMassUnits"],
  currency: string,
) {
  serializeMeasuredCart(lines, units, currency);
  if (!lines.length)
    return {
      total: normalizedGross(rational(0n), currency),
      lineAmounts: {} as Record<string, string>,
    };
  const amounts = buildFinancialAmountsFromSnapshots({
    currencyCode: currency,
    discount: null,
    lines: lines.map((line, position) => {
      const resolved = resolvedCartLine(line, units);
      return {
        sourceLineId: line.key,
        position,
        quantity: resolved.quantity,
        unitPrice: resolved.unitPrice,
        measure: resolved.measure,
      };
    }),
  });
  return {
    total: amounts.gross,
    lineAmounts: Object.fromEntries(
      amounts.lines.map((line) => [line.sourceLineId, line.money.gross]),
    ),
  };
}
export function measuredEditorTotal(
  lines: MeasuredCartLine[],
  units: PosCatalogV2["salesMassUnits"],
  currency: string,
) {
  return measuredEditorAmounts(lines, units, currency).total;
}

/** Parent owns this session across editor remounts. Keep it until requestExit() succeeds.
 * Identity retirement is permanent; changing order/selection is an exit and must first
 * recover any uncertain write. Supply the SAME cache and contractVersion:2 client.
 */
export class MeasuredEditorSession {
  readonly commands: MeasuredOrderCommands;
  private listeners = new Set<() => void>();
  private revision = 0;
  private active = true;
  private baseline: string;
  private reviewedConflict: unknown;
  private purpose: "save" | "prepare" = "save";
  order: PosOrderV2 | null;
  draft: MeasuredEditorDraft;
  catalog: PosCatalogV2 | null = null;
  catalogLoading = false;
  error: string | null = null;
  constructor(
    readonly context: MeasuredEditorContext,
    readonly cache: PosCache,
    readonly client: PosClient,
    order: PosOrderV2 | null = null,
  ) {
    this.order = order;
    this.draft = draftFor(order, context);
    this.baseline = JSON.stringify(this.draft);
    this.commands = new MeasuredOrderCommands(client, cache, {
      historyStatus: "active",
    });
    this.commands.subscribe(this.publish);
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.revision;
  private publish = () => {
    this.revision++;
    this.listeners.forEach((fn) => fn());
  };
  get dirty() {
    return JSON.stringify(this.draft) !== this.baseline;
  }
  get blocked() {
    return (
      ["pending", "uncertain", "retired"].includes(
        this.commands.getSnapshot().status,
      ) || !this.active
    );
  }
  get conflict() {
    const state = this.commands.getSnapshot();
    return state.status === "conflict" && state !== this.reviewedConflict
      ? state
      : null;
  }
  change(patch: Partial<MeasuredEditorDraft>) {
    if (this.blocked) return;
    this.draft = { ...this.draft, ...patch };
    this.error = null;
    this.publish();
  }
  requestExit(discard = false) {
    return !this.blocked && (!this.dirty || discard);
  }
  retireIdentity() {
    this.active = false;
    this.commands.retire();
    this.publish();
  }
  async loadCatalog(force = false) {
    const location = this.draft.locationId;
    if (!location || !this.active) return;
    this.catalogLoading = true;
    this.error = null;
    this.publish();
    try {
      const catalog = await this.cache.read<PosCatalogV2>(
        catalogKey(location),
        () =>
          this.client.request(
            `/api/modules/pos/catalog?locationId=${encodeURIComponent(location)}`,
          ),
        force,
      );
      if (this.active && location === this.draft.locationId)
        this.catalog = catalog;
    } catch (error) {
      if (this.active && location === this.draft.locationId) {
        this.error =
          error instanceof Error
            ? error.message
            : "No pudimos cargar el catálogo. Reintenta.";
        if (
          error instanceof PosError &&
          ([401, 403].includes(error.status ?? 0) ||
            error.code === "backoffice_context_changed")
        )
          this.retireIdentity();
      }
    } finally {
      if (this.active && location === this.draft.locationId) {
        this.catalogLoading = false;
        this.publish();
      }
    }
  }
  changeLocation(locationId: string, discardLines: boolean) {
    if (
      this.blocked ||
      !this.context.locations.some((l) => l.id === locationId)
    )
      return false;
    if (this.draft.lines.length && !discardLines) return false;
    this.catalog = null;
    this.change({
      locationId,
      tableId: null,
      orderLabel: this.draft.saleType === "table" ? "" : this.draft.orderLabel,
      lines: discardLines ? [] : this.draft.lines,
    });
    return true;
  }
  validation(): string | null {
    if (!this.active || this.commands.getSnapshot().status === "retired")
      return "El contexto cambió. Vuelve a abrir el pedido.";
    if (this.order && this.order.status !== "open")
      return "Este pedido ya no está abierto. Puedes salir y revisar su estado.";
    if (!this.context.locations.some((l) => l.id === this.draft.locationId))
      return "Elige un local disponible.";
    if (
      this.draft.saleType !== "legacy" &&
      !this.context.saleTypes.includes(this.draft.saleType)
    )
      return "Este tipo de venta no está disponible.";
    if (this.draft.saleType !== "counter" && !this.draft.orderLabel.trim())
      return "Escribe un nombre o referencia.";

    if (
      this.draft.orderLabel.trim().length > 60 ||
      this.draft.note.trim().length > 1000
    )
      return "Revisa el límite del nombre o la nota.";
    if (this.conflict) return "Revisa el conflicto antes de guardar.";
    if (
      this.order &&
      this.draft.lines.some(
        (line) =>
          line.origin.kind === "existing" &&
          !this.order!.items.some(
            (current) => current.lineId === line.snapshot.lineId,
          ),
      )
    )
      return "Retira las líneas que ya no están en la orden actual antes de guardar.";
    try {
      serializeMeasuredCart(
        this.draft.lines,
        this.catalog?.salesMassUnits ?? [],
        this.context.currencyCode,
      );
    } catch (error) {
      return (error as Error).message;
    }
    return null;
  }
  reviewVersion() {
    const conflict = this.conflict;
    if (
      !conflict ||
      !(conflict.error instanceof PosError) ||
      conflict.error.code !== "version_conflict"
    )
      return;
    const actual = conflict.error.payload.order as PosOrderV2 | undefined;
    if (!actual || actual.contractVersion !== 2) return;
    this.order = actual;
    this.reviewedConflict = conflict;
    this.publish();
  }
  reviewCatalog() {
    const conflict = this.conflict;
    if (
      !conflict ||
      !(conflict.error instanceof PosError) ||
      conflict.error.code !== "catalog_changed"
    )
      return;
    const products = conflict.error.payload.products as
      PosCatalogV2["products"] | undefined;
    if (!Array.isArray(products)) return;
    const unavailable = products.some(
      (p) =>
        p.unitPrice === null &&
        this.draft.lines.some(
          (l) => l.origin.kind === "new" && l.snapshot.productId === p.id,
        ),
    );
    if (unavailable) {
      this.error =
        "Retira las líneas que ya no tienen precio antes de continuar.";
      this.publish();
      return;
    }
    this.draft = {
      ...this.draft,
      lines: this.draft.lines.map((line) => {
        const product = products.find((p) => p.id === line.snapshot.productId);
        if (
          !product ||
          line.origin.kind !== "new" ||
          product.unitPrice === null
        )
          return line;
        const changedMeasure =
          product.soldByWeight !== (line.snapshot.measure.kind === "mass");
        return {
          ...line,
          origin: {
            kind: "new" as const,
            catalogRevision: product.catalogRevision,
          },
          snapshot: {
            ...line.snapshot,
            name: product.name,
            unitPrice: product.unitPrice,
            measure: product.soldByWeight
              ? {
                  kind: "mass" as const,
                  priceUnit: product.pricingUnit as "kg" | "lb" | "g",
                  quantityUnit: changedMeasure
                    ? (product.pricingUnit as "kg" | "lb" | "g")
                    : (line.snapshot.measure.quantityUnit as "kg" | "lb" | "g"),
                  conversionVersion: CONVERSION_VERSION,
                }
              : {
                  kind: "unit" as const,
                  priceUnit: "unit" as const,
                  quantityUnit: "unit" as const,
                  conversionVersion: CONVERSION_VERSION,
                },
          },
          editor: changedMeasure
            ? {
                source: null,
                unit: product.pricingUnit,
                buffer: "",
                edited: false,
              }
            : line.editor,
        };
      }),
    };
    if (this.catalog) {
      this.catalog = {
        ...this.catalog,
        products: this.catalog.products.map(
          (product) =>
            products.find((current) => current.id === product.id) ?? product,
        ),
      };
      this.cache.put(catalogKey(this.draft.locationId), this.catalog);
    }
    this.reviewedConflict = conflict;
    this.publish();
  }
  async save(
    prepare = false,
    retry = false,
  ): Promise<{ order: PosOrderV2; prepare: boolean } | null> {
    if (!this.active) return null;
    if (!retry) {
      if (this.blocked) return null;
      const error = this.validation();
      if (error || (prepare && !this.draft.lines.length)) {
        this.error = error ?? "Añade un producto antes de cobrar.";
        this.publish();
        return null;
      }
      this.purpose = prepare ? "prepare" : "save";
    }
    const draft = this.draft;
    const items = retry
      ? []
      : serializeMeasuredCart(
          draft.lines,
          this.catalog?.salesMassUnits ?? [],
          this.context.currencyCode,
        );
    const common = {
      saleType: draft.saleType,
      orderLabel: draft.orderLabel.trim(),
      locationId: draft.locationId || null,
      tableId:
        draft.saleType === "table" || draft.saleType === "legacy"
          ? draft.tableId
          : null,
      note: draft.note.trim() || null,
      items,
    };
    const result = retry
      ? await this.commands.retry()
      : this.order
        ? await this.commands.update(this.order.id, {
            ...common,
            version: this.order.version,
          })
        : await this.commands.create({
            ...common,
            saleType: draft.saleType as Exclude<SaleType, "legacy">,
            items: items as PosNewLineV2[],
            ...(draft.saleType === "counter" ? { orderLabel: undefined } : {}),
          });
    if (!this.active) return null;
    if (result.status !== "confirmed") {
      if (result.status === "rejected") {
        const error = result.error;
        this.error =
          error instanceof Error
            ? error.message
            : "No pudimos guardar. Revisa el pedido.";
        if (error instanceof PosError && error.status === 403)
          this.retireIdentity();
      }
      this.publish();
      return null;
    }
    this.order = result.order;
    this.draft = draftFor(result.order, this.context);
    this.baseline = JSON.stringify(this.draft);
    this.error = null;
    this.publish();
    return {
      order: result.order,
      prepare:
        this.purpose === "prepare" &&
        result.order.status === "open" &&
        result.order.items.length > 0,
    };
  }
}

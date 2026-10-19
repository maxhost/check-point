import type { PosResolveV2 } from "../contracts";
import { DiscardedPosIntent, type PosClient } from "./pos-context";
import type { PosCache } from "./pos-cache";
import { PosError } from "./pos-types";

export type EditorCustomerSelection = {
  resolved: PosResolveV2 | null;
  excluded: boolean;
};

/** Temporary identification belongs to the editor owner, without creating an order. */
export class MeasuredCustomerModel {
  private token = 0;
  private readonly epoch: number;
  private retired = false;
  state: EditorCustomerSelection & {
    scanning: boolean;
    resolving: boolean;
    error: string | null;
  } = {
    resolved: null,
    excluded: false,
    scanning: false,
    resolving: false,
    error: null,
  };
  constructor(
    private readonly client: PosClient,
    private readonly cache: PosCache,
    private readonly publish: () => void,
    private readonly canAct: () => boolean,
  ) {
    this.epoch = cache.epoch;
  }
  get selection(): EditorCustomerSelection {
    return structuredClone({
      resolved: this.state.resolved,
      excluded: this.state.excluded,
    });
  }
  get isRetired() {
    return this.retired || this.cache.epoch !== this.epoch;
  }
  adopt(selection: EditorCustomerSelection) {
    if (!this.canAct() || this.retired) return;
    this.token++;
    this.state = {
      ...structuredClone(selection),
      scanning: false,
      resolving: false,
      error: null,
    };
    this.publish();
  }
  start() {
    if (!this.canAct() || this.retired) return;
    this.token++;
    this.state = {
      ...this.state,
      scanning: true,
      resolving: false,
      error: null,
    };
    this.publish();
  }
  cancel() {
    this.token++;
    this.state = {
      ...this.state,
      scanning: false,
      resolving: false,
      error: null,
    };
    this.publish();
  }
  remove() {
    if (!this.canAct() || this.retired) return;
    this.token++;
    this.state = {
      resolved: null,
      excluded: false,
      scanning: false,
      resolving: false,
      error: null,
    };
    this.publish();
  }
  exclude(excluded: boolean) {
    if (!this.canAct() || this.retired) return;
    this.state = { ...this.state, excluded };
    this.publish();
  }
  retire() {
    this.retired = true;
    this.token++;
    this.state = {
      resolved: null,
      excluded: false,
      scanning: false,
      resolving: false,
      error: null,
    };
    this.publish();
  }
  async resolve(qrToken: string, locationId: string): Promise<unknown | null> {
    if (
      !this.canAct() ||
      this.retired ||
      !this.state.scanning ||
      this.state.resolving ||
      !locationId
    )
      return null;
    const token = ++this.token;
    const request = this.client.capture();
    const body = Object.freeze({ qrToken, locationId });
    const live = () => {
      if (this.cache.epoch !== this.epoch) {
        this.retire();
        return false;
      }
      return token === this.token && !this.retired;
    };
    this.state = { ...this.state, resolving: true, error: null };
    this.publish();
    try {
      const resolved = await request<PosResolveV2>(
        "/api/modules/pos/resolve",
        "POST",
        body,
      );
      if (!live()) return null;
      this.state = {
        resolved,
        excluded: false,
        scanning: false,
        resolving: false,
        error: null,
      };
      this.publish();
      return null;
    } catch (cause) {
      if (!live()) return null;
      if (
        cause instanceof DiscardedPosIntent ||
        (cause instanceof PosError &&
          ([401, 403].includes(cause.status ?? 0) ||
            cause.code === "backoffice_context_changed"))
      )
        this.retire();
      else {
        this.state = {
          ...this.state,
          resolving: false,
          error:
            cause instanceof Error
              ? cause.message
              : "No pudimos identificar al cliente. Reintenta.",
        };
        this.publish();
      }
      return cause;
    }
  }
}

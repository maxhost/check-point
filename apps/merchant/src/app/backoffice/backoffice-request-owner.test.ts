import { describe, expect, it, vi } from "vitest";
import type { BackofficeResourceTicket } from "./backoffice-context-state";
import {
  createBackofficeRequestOwner,
  BackofficeRequestInvalidatedError,
  type BackofficeRequestStamp,
} from "./backoffice-request-owner";
import { isBackofficeContextChanged } from "./backoffice-scope-request";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function stamp(): BackofficeRequestStamp {
  return {
    scopeKey: "a".repeat(64),
    epoch: 0,
    generations: { session: 0, modules: 0, inbox: 0, checklist: 0, summary: 0 },
  };
}
function ticket(
  state: BackofficeRequestStamp,
  generation = state.generations.inbox,
): BackofficeResourceTicket {
  return {
    scopeKey: state.scopeKey!,
    epoch: state.epoch,
    resource: "inbox",
    generation,
  };
}
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("0238 document request owner, no HTTP or React", () => {
  it("shares pending work, but does not cache the settled response", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const work = deferred<string>();
    const load = vi.fn(() => work.promise);
    const a = owner.acquire(ticket(state), load);
    const b = owner.acquire(ticket(state), load);
    expect(a.promise).toBe(b.promise);
    expect(load).toHaveBeenCalledOnce();
    work.resolve("first");
    await expect(a.promise).resolves.toBe("first");
    const next = owner.acquire(ticket(state), async () => "second");
    expect(next.promise).not.toBe(a.promise);
    await expect(next.promise).resolves.toBe("second");
  });

  it("one subscriber releasing does not abort another consumer", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const work = deferred<string>();
    let signal!: AbortSignal;
    const load = vi.fn((value: AbortSignal) => {
      signal = value;
      return work.promise;
    });
    const a = owner.acquire(ticket(state), load);
    const b = owner.acquire(ticket(state), load);
    a.release();
    a.release();
    await tick();
    expect(signal.aborted).toBe(false);
    expect(load).toHaveBeenCalledOnce();
    work.resolve("shared");
    await expect(b.promise).resolves.toBe("shared");
  });

  it("Strict Mode cleanup/replacement shares the original entry before cancellation microtask", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const work = deferred<string>();
    let signal!: AbortSignal;
    const load = vi.fn((value: AbortSignal) => {
      signal = value;
      return work.promise;
    });
    const first = owner.acquire(ticket(state), load);
    first.release();
    const replacement = owner.acquire(ticket(state), load);
    await tick();
    expect(signal.aborted).toBe(false);
    expect(load).toHaveBeenCalledOnce();
    expect(replacement.promise).toBe(first.promise);
    work.resolve("ready");
    await replacement.promise;
  });

  it("last release really aborts and observes rejection even without a subscriber catch", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const work = deferred<string>();
    let signal!: AbortSignal;
    const lease = owner.acquire(ticket(state), (value) => {
      signal = value;
      return work.promise;
    });
    lease.release();
    await tick();
    expect(signal.aborted).toBe(true);
    work.reject(new Error("fixture late rejection"));
    await tick();
    await expect(lease.promise).rejects.toMatchObject({ reason: "released" });
  });

  it("does not cache a rejection and starts a later intentional retry", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const failure = new Error("fixture");
    const first = owner.acquire(ticket(state), async () => {
      throw failure;
    });
    await expect(first.promise).rejects.toBe(failure);
    const load = vi.fn(async () => "retry");
    await expect(owner.acquire(ticket(state), load).promise).resolves.toBe(
      "retry",
    );
    expect(load).toHaveBeenCalledOnce();
  });

  it("drains pre-decision GET before starting a new generation, without fan-out", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const old = deferred<string>();
    let oldSignal!: AbortSignal;
    const first = owner.acquire(ticket(state), (signal) => {
      oldSignal = signal;
      return old.promise;
    });
    const next = { ...state, generations: { ...state.generations, inbox: 1 } };
    owner.reconcile(next);
    const load = vi.fn(async () => "after-decision");
    const queued = owner.acquire(ticket(next), load);
    const shared = owner.acquire(ticket(next), load);
    expect(load).not.toHaveBeenCalled();
    expect(oldSignal.aborted).toBe(true);
    expect(queued.promise).not.toBe(first.promise);
    expect(shared.promise).toBe(queued.promise);
    await expect(first.promise).rejects.toMatchObject({ reason: "generation" });
    old.resolve("obsolete");
    await expect(queued.promise).resolves.toBe("after-decision");
    expect(load).toHaveBeenCalledOnce();
  });

  it("keeps only the latest pending generation and never executes superseded work", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const old = deferred<string>();
    owner.acquire(ticket(state), () => old.promise);
    const one = { ...state, generations: { ...state.generations, inbox: 1 } };
    owner.reconcile(one);
    const loadOne = vi.fn(async () => "one");
    const pendingOne = owner.acquire(ticket(one), loadOne);
    const two = { ...state, generations: { ...state.generations, inbox: 2 } };
    owner.reconcile(two);
    const loadTwo = vi.fn(async () => "two");
    const pendingTwo = owner.acquire(ticket(two), loadTwo);
    await expect(pendingOne.promise).rejects.toBeInstanceOf(
      BackofficeRequestInvalidatedError,
    );
    expect(loadOne).not.toHaveBeenCalled();
    expect(loadTwo).not.toHaveBeenCalled();
    old.resolve("discarded");
    await expect(pendingTwo.promise).resolves.toBe("two");
    expect(loadOne).not.toHaveBeenCalled();
    expect(loadTwo).toHaveBeenCalledOnce();
  });

  it("withdraws scopeA immediately and its late finally cannot remove active scopeB", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const old = deferred<string>();
    const first = owner.acquire(ticket(state), () => old.promise);
    const next = { ...state, scopeKey: "b".repeat(64), epoch: 1 };
    owner.reconcile(next);
    const current = deferred<string>();
    const load = vi.fn(() => current.promise);
    const active = owner.acquire(ticket(next), load);
    await expect(first.promise).rejects.toMatchObject({ reason: "scope" });
    const rejectedLoad = vi.fn(async () => "wrong scope");
    const rejected = owner.acquire(ticket(state), rejectedLoad);
    await expect(rejected.promise).rejects.toBeInstanceOf(
      BackofficeRequestInvalidatedError,
    );
    expect(rejectedLoad).not.toHaveBeenCalled();
    old.resolve("privateA");
    await tick();
    expect(owner.acquire(ticket(next), load).promise).toBe(active.promise);
    expect(load).toHaveBeenCalledOnce();
    current.resolve("privateB");
    await expect(active.promise).resolves.toBe("privateB");
  });

  it("copies external stamp, generations and ticket before asynchronous work", async () => {
    const state = { ...stamp(), generations: { ...stamp().generations } };
    const owner = createBackofficeRequestOwner(state);
    const supplied = { ...ticket(state) };
    const old = deferred<string>();
    const first = owner.acquire(supplied, () => old.promise);
    const next = { ...state, generations: { ...state.generations, inbox: 1 } };
    owner.reconcile(next);
    let captured!: BackofficeResourceTicket;
    const queuedTicket = { ...ticket(next) };
    const queued = owner.acquire(queuedTicket, async (_signal, copy) => {
      captured = copy;
      return "captured";
    });
    next.scopeKey = "b".repeat(64);
    next.generations.inbox = 99;
    queuedTicket.generation = 99;
    supplied.scopeKey = "c".repeat(64);
    state.generations.inbox = 42;
    old.resolve("old");
    await expect(first.promise).rejects.toMatchObject({ reason: "generation" });
    await expect(queued.promise).resolves.toBe("captured");
    expect(captured).toEqual({
      scopeKey: "a".repeat(64),
      epoch: 0,
      resource: "inbox",
      generation: 1,
    });
    expect(Object.isFrozen(captured)).toBe(true);
  });

  it("dispose is final, does not impersonate HTTP409, and observes late loader failure", async () => {
    const state = stamp();
    const owner = createBackofficeRequestOwner(state);
    const work = deferred<string>();
    const lease = owner.acquire(ticket(state), () => work.promise);
    owner.dispose();
    owner.dispose();
    const error = await lease.promise.catch((failure) => failure);
    expect(error).toBeInstanceOf(BackofficeRequestInvalidatedError);
    expect(isBackofficeContextChanged(error)).toBe(false);
    expect(error.reason).toBe("disposed");
    owner.reconcile(state);
    const load = vi.fn(async () => "invalid");
    await expect(
      owner.acquire(ticket(state), load).promise,
    ).rejects.toMatchObject({ reason: "disposed" });
    expect(load).not.toHaveBeenCalled();
    work.reject(new Error("late fixture failure"));
    await tick();
  });
});

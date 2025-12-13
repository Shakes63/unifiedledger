import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import {
  offlineTransactionQueue,
  type OfflineTransaction,
} from "@/lib/offline/transaction-queue";

function makeTx(overrides: Partial<OfflineTransaction> = {}): OfflineTransaction {
  const base: OfflineTransaction = {
    id: "off-1",
    userId: "u1",
    formData: { description: "Test", amount: "10.00" },
    timestamp: Date.now(),
    syncStatus: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  return { ...base, ...overrides };
}

describe("lib/offline/transaction-queue (IndexedDB)", () => {
  beforeAll(async () => {
    await offlineTransactionQueue.initialize();
    await offlineTransactionQueue.clearAll();
  });

  beforeEach(async () => {
    await offlineTransactionQueue.clearAll();
  });

  it("adds and reads back a transaction by id", async () => {
    const tx = makeTx({ id: "off-a" });
    await offlineTransactionQueue.addTransaction(tx);

    const stored = await offlineTransactionQueue.getTransaction("off-a");
    expect(stored).toBeTruthy();
    expect(stored?.id).toBe("off-a");
    expect(stored?.userId).toBe("u1");
    expect(stored?.syncStatus).toBe("pending");
  });

  it("getPendingTransactions returns only pending transactions for the user", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-p1", userId: "u1", syncStatus: "pending" }));
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-s1", userId: "u1", syncStatus: "synced", syncedId: "tx1" }));
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u2-p1", userId: "u2", syncStatus: "pending" }));

    const pendingU1 = await offlineTransactionQueue.getPendingTransactions("u1");
    expect(pendingU1.map((t) => t.id)).toEqual(["u1-p1"]);
  });

  it("updateTransactionStatus updates status and merges updates", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "off-a", attempts: 1 }));

    await offlineTransactionQueue.updateTransactionStatus("off-a", "error", {
      attempts: 2,
      lastError: "Network error",
    });

    const stored = await offlineTransactionQueue.getTransaction("off-a");
    expect(stored?.syncStatus).toBe("error");
    expect(stored?.attempts).toBe(2);
    expect(stored?.lastError).toBe("Network error");
  });

  it("updateTransactionStatus rejects when transaction does not exist", async () => {
    await expect(
      offlineTransactionQueue.updateTransactionStatus("missing", "pending")
    ).rejects.toThrow("Transaction missing not found");
  });

  it("markAsSyncing sets syncStatus=syncing", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "off-a", syncStatus: "pending" }));

    await offlineTransactionQueue.markAsSyncing("off-a");
    const stored = await offlineTransactionQueue.getTransaction("off-a");
    expect(stored?.syncStatus).toBe("syncing");
  });

  it("markSyncError sets syncStatus=error and persists attempts + error", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "off-a" }));

    await offlineTransactionQueue.markSyncError("off-a", "Server error", 3);
    const stored = await offlineTransactionQueue.getTransaction("off-a");
    expect(stored?.syncStatus).toBe("error");
    expect(stored?.attempts).toBe(3);
    expect(stored?.lastError).toBe("Server error");
  });

  it("markAsSynced sets syncStatus=synced, stores syncedId, and clears lastError/attempts", async () => {
    await offlineTransactionQueue.addTransaction(
      makeTx({ id: "off-a", syncStatus: "error", attempts: 2, lastError: "boom" })
    );

    await offlineTransactionQueue.markAsSynced("off-a", "tx-123");
    const stored = await offlineTransactionQueue.getTransaction("off-a");
    expect(stored?.syncStatus).toBe("synced");
    expect(stored?.syncedId).toBe("tx-123");
    expect(stored?.attempts).toBe(0);
    expect(stored?.lastError).toBeUndefined();
  });

  it("getAllTransactions returns all transactions for user", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-a", userId: "u1" }));
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-b", userId: "u1" }));
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u2-a", userId: "u2" }));

    const allU1 = await offlineTransactionQueue.getAllTransactions("u1");
    expect(allU1.map((t) => t.id).sort()).toEqual(["u1-a", "u1-b"]);
  });

  it("deleteTransaction removes transaction from the store", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "off-a" }));
    expect(await offlineTransactionQueue.getTransaction("off-a")).toBeTruthy();

    await offlineTransactionQueue.deleteTransaction("off-a");
    expect(await offlineTransactionQueue.getTransaction("off-a")).toBeUndefined();
  });

  it("getPendingCount returns number of pending transactions for user", async () => {
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-p1", userId: "u1", syncStatus: "pending" }));
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-p2", userId: "u1", syncStatus: "pending" }));
    await offlineTransactionQueue.addTransaction(makeTx({ id: "u1-s1", userId: "u1", syncStatus: "synced" }));

    const count = await offlineTransactionQueue.getPendingCount("u1");
    expect(count).toBe(2);
  });
});



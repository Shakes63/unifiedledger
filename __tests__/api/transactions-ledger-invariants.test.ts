import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import util from 'node:util';
import Decimal from 'decimal.js';

import { POST as POST_TRANSACTIONS } from '@/app/api/transactions/route';
import { PUT as PUT_TRANSACTION, DELETE as DELETE_TRANSACTION } from '@/app/api/transactions/[id]/route';
import { POST as CONVERT_TO_TRANSFER } from '@/app/api/transactions/[id]/convert-to-transfer/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/transactions/audit-logger', () => ({
  logTransactionAudit: vi.fn().mockResolvedValue(undefined),
  createTransactionSnapshot: vi.fn(() => ({})),
  detectChanges: vi.fn(() => []),
}));

vi.mock('@/lib/bills/bill-matching-helpers', () => ({
  findMatchingBillInstance: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/transactions/payment-linkage', () => ({
  processAndLinkBillPayment: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/sales-tax/transaction-sales-tax', () => ({
  deleteSalesTaxRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rules/rule-matcher', () => ({
  findMatchingRule: vi.fn().mockResolvedValue({ matched: false, rule: null }),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transactions, usageAnalytics } from '@/lib/db/schema';

interface FakeAccount {
  id: string;
  currentBalance: number;
  currentBalanceCents: number;
  usageCount: number;
  type: string;
}

interface FakeTransaction {
  id: string;
  accountId: string;
  amount: number;
  amountCents: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  transferId: string | null;
  transferGroupId?: string | null;
  pairedTransactionId?: string | null;
  transferSourceAccountId: string | null;
  transferDestinationAccountId: string | null;
}

interface LedgerState {
  accounts: Record<string, FakeAccount>;
  transactions: Record<string, FakeTransaction>;
}

function whereStr(whereArg: unknown) {
  return util.inspect(whereArg, { depth: 8, colors: false });
}

function extractAccountId(whereArg: unknown): string | null {
  const str = whereStr(whereArg);
  if (str.includes('acc-source')) return 'acc-source';
  if (str.includes('acc-dest')) return 'acc-dest';
  if (str.includes('acc-target')) return 'acc-target';
  return null;
}

function extractTransactionId(whereArg: unknown): string | null {
  const str = whereStr(whereArg);
  if (str.includes('tx-exp')) return 'tx-exp';
  if (str.includes('tx-out')) return 'tx-out';
  if (str.includes('tx-in')) return 'tx-in';
  if (str.includes('tx-original')) return 'tx-original';
  return null;
}

function signedAmount(type: FakeTransaction['type'], amount: number) {
  if (type === 'expense' || type === 'transfer_out') return -amount;
  return amount;
}

function assertReconciliation(state: LedgerState, openingBalances: Record<string, number>) {
  const signedTotals: Record<string, Decimal> = {};
  for (const tx of Object.values(state.transactions)) {
    const existing = signedTotals[tx.accountId] || new Decimal(0);
    signedTotals[tx.accountId] = existing.plus(signedAmount(tx.type, tx.amount));
  }

  for (const [accountId, account] of Object.entries(state.accounts)) {
    const opening = new Decimal(openingBalances[accountId] || 0);
    const signed = signedTotals[accountId] || new Decimal(0);
    const expected = opening.plus(signed);
    expect(account.currentBalance).toBeCloseTo(expected.toNumber(), 8);
  }
}

function assertNoOrphanTransfers(state: LedgerState) {
  const all = Object.values(state.transactions);
  const outs = all.filter((tx) => tx.type === 'transfer_out');
  const ins = all.filter((tx) => tx.type === 'transfer_in');

  const hasPair = (current: FakeTransaction, candidates: FakeTransaction[]) =>
    candidates.some((candidate) =>
      (current.pairedTransactionId && candidate.id === current.pairedTransactionId)
      || (candidate.pairedTransactionId && candidate.pairedTransactionId === current.id)
      || (current.transferGroupId && candidate.transferGroupId && candidate.transferGroupId === current.transferGroupId)
      || (current.transferId && candidate.id === current.transferId)
      || (candidate.transferId && candidate.transferId === current.id)
    );

  for (const transferIn of ins) {
    expect(hasPair(transferIn, outs)).toBeTruthy();
  }

  for (const transferOut of outs) {
    expect(hasPair(transferOut, ins)).toBeTruthy();
  }
}

describe('Transaction ledger invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ userId: 'user-1', householdId: 'hh-1' });
  });

  it('POST /api/transactions transfer keeps a balanced pair and reconciled balances', async () => {
    const openingBalances = {
      'acc-source': 1000,
      'acc-dest': 500,
    };

    const state: LedgerState = {
      accounts: {
        'acc-source': { id: 'acc-source', currentBalance: 1000, currentBalanceCents: 100000, usageCount: 1, type: 'checking' },
        'acc-dest': { id: 'acc-dest', currentBalance: 500, currentBalanceCents: 50000, usageCount: 2, type: 'savings' },
      },
      transactions: {},
    };

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (table === accounts) {
              const accountId = extractAccountId(whereArg);
              return accountId ? [state.accounts[accountId]] : [];
            }
            if (table === usageAnalytics) {
              return [];
            }
            return [];
          },
        }),
      }),
    });

    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    (db.update as Mock).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: (table: unknown) => ({
          values: async (values: Record<string, unknown>) => {
            if (table === transactions) {
              state.transactions[String(values.id)] = {
                id: String(values.id),
                accountId: String(values.accountId),
                amount: Number(values.amount),
                amountCents: Number(values.amountCents),
                type: values.type as FakeTransaction['type'],
                transferId: values.transferId ? String(values.transferId) : null,
                transferGroupId: values.transferGroupId ? String(values.transferGroupId) : null,
                pairedTransactionId: values.pairedTransactionId ? String(values.pairedTransactionId) : null,
                transferSourceAccountId: values.transferSourceAccountId
                  ? String(values.transferSourceAccountId)
                  : null,
                transferDestinationAccountId: values.transferDestinationAccountId
                  ? String(values.transferDestinationAccountId)
                  : null,
              };
            }
          },
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async (whereArg: unknown) => {
              if (table === accounts) {
                const accountId = extractAccountId(whereArg);
                if (accountId) {
                  state.accounts[accountId].currentBalance = Number(
                    updates.currentBalance ?? state.accounts[accountId].currentBalance
                  );
                  state.accounts[accountId].currentBalanceCents = Number(
                    updates.currentBalanceCents ?? state.accounts[accountId].currentBalanceCents
                  );
                  state.accounts[accountId].usageCount = Number(
                    updates.usageCount ?? state.accounts[accountId].usageCount
                  );
                }
              }
            },
          }),
        }),
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              limit: async () => {
                if (table === usageAnalytics) return [];
                return [];
              },
            }),
          }),
        }),
      };

      await callback(tx);
    });

    const response = await POST_TRANSACTIONS({
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        amount: 200,
        date: '2026-02-19',
        description: 'Transfer invariant test',
        type: 'transfer',
      }),
    } as unknown as Request);

    expect(response.status).toBe(201);
    const allTransactions = Object.values(state.transactions);
    expect(allTransactions).toHaveLength(2);
    assertNoOrphanTransfers(state);
    assertReconciliation(state, openingBalances);
    expect(state.accounts['acc-source'].currentBalance).toBe(800);
    expect(state.accounts['acc-dest'].currentBalance).toBe(700);
  });

  it('PUT /api/transactions/[id] expense update reconciles account balance to signed transaction amount', async () => {
    const openingBalances = {
      'acc-source': 1000,
    };

    const state: LedgerState = {
      accounts: {
        'acc-source': { id: 'acc-source', currentBalance: 900, currentBalanceCents: 90000, usageCount: 1, type: 'checking' },
      },
      transactions: {
        'tx-exp': {
          id: 'tx-exp',
          accountId: 'acc-source',
          amount: 100,
          amountCents: 10000,
          type: 'expense',
          transferId: null,
          transferSourceAccountId: null,
          transferDestinationAccountId: null,
        },
      },
    };

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (table === transactions) {
              const txId = extractTransactionId(whereArg);
              if (txId && state.transactions[txId]) return [state.transactions[txId]];
              return [];
            }
            if (table === accounts) {
              const accountId = extractAccountId(whereArg);
              return accountId ? [state.accounts[accountId]] : [];
            }
            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: (whereArg: unknown) => ({
              limit: async () => {
                if (table === accounts) {
                  const accountId = extractAccountId(whereArg);
                  return accountId ? [state.accounts[accountId]] : [];
                }
                return [];
              },
            }),
          }),
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async (whereArg: unknown) => {
              if (table === accounts) {
                const accountId = extractAccountId(whereArg);
                if (accountId) {
                  state.accounts[accountId].currentBalance = Number(
                    updates.currentBalance ?? state.accounts[accountId].currentBalance
                  );
                  state.accounts[accountId].currentBalanceCents = Number(
                    updates.currentBalanceCents ?? state.accounts[accountId].currentBalanceCents
                  );
                }
              }
              if (table === transactions) {
                const txId = extractTransactionId(whereArg);
                if (txId && state.transactions[txId]) {
                  state.transactions[txId].amount = Number(
                    updates.amount ?? state.transactions[txId].amount
                  );
                  state.transactions[txId].amountCents = Number(
                    updates.amountCents ?? state.transactions[txId].amountCents
                  );
                }
              }
            },
          }),
        }),
      };

      await callback(tx);
    });

    const response = await PUT_TRANSACTION(
      {
        url: 'http://localhost/api/transactions/tx-exp',
        headers: new Headers({ 'x-household-id': 'hh-1' }),
        json: async () => ({
          amount: 60,
        }),
      } as unknown as Request,
      { params: Promise.resolve({ id: 'tx-exp' }) }
    );

    expect(response.status).toBe(200);
    expect(state.transactions['tx-exp'].amount).toBe(60);
    expect(state.accounts['acc-source'].currentBalance).toBe(940);
    assertReconciliation(state, openingBalances);
  });

  it('DELETE /api/transactions/[id] transfer deletion removes the pair and restores balances', async () => {
    const openingBalances = {
      'acc-source': 1000,
      'acc-dest': 500,
    };

    const state: LedgerState = {
      accounts: {
        'acc-source': { id: 'acc-source', currentBalance: 800, currentBalanceCents: 80000, usageCount: 1, type: 'checking' },
        'acc-dest': { id: 'acc-dest', currentBalance: 700, currentBalanceCents: 70000, usageCount: 2, type: 'savings' },
      },
      transactions: {
        'tx-out': {
          id: 'tx-out',
          accountId: 'acc-source',
          amount: 200,
          amountCents: 20000,
          type: 'transfer_out',
          transferId: 'acc-dest',
          transferSourceAccountId: 'acc-source',
          transferDestinationAccountId: 'acc-dest',
        },
        'tx-in': {
          id: 'tx-in',
          accountId: 'acc-dest',
          amount: 200,
          amountCents: 20000,
          type: 'transfer_in',
          transferId: 'tx-out',
          transferSourceAccountId: 'acc-source',
          transferDestinationAccountId: 'acc-dest',
        },
      },
    };

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (table === transactions) {
              const txId = extractTransactionId(whereArg);
              if (txId && state.transactions[txId]) {
                return [state.transactions[txId]];
              }
              return [];
            }
            if (table === accounts) {
              const accountId = extractAccountId(whereArg);
              return accountId ? [state.accounts[accountId]] : [];
            }
            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: (whereArg: unknown) => ({
              limit: async () => {
                if (table === transactions) {
                  const where = whereStr(whereArg);
                  if (where.includes('transfer_in') && where.includes('tx-out') && state.transactions['tx-in']) {
                    return [state.transactions['tx-in']];
                  }
                  const txId = extractTransactionId(whereArg);
                  if (txId && state.transactions[txId]) {
                    return [state.transactions[txId]];
                  }
                  return [];
                }
                if (table === accounts) {
                  const accountId = extractAccountId(whereArg);
                  return accountId ? [state.accounts[accountId]] : [];
                }
                return [];
              },
            }),
          }),
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async (whereArg: unknown) => {
              if (table === accounts) {
                const accountId = extractAccountId(whereArg);
                if (accountId) {
                  state.accounts[accountId].currentBalance = Number(
                    updates.currentBalance ?? state.accounts[accountId].currentBalance
                  );
                  state.accounts[accountId].currentBalanceCents = Number(
                    updates.currentBalanceCents ?? state.accounts[accountId].currentBalanceCents
                  );
                }
              }
            },
          }),
        }),
        delete: (table: unknown) => ({
          where: async (whereArg: unknown) => {
            if (table === transactions) {
              const txId = extractTransactionId(whereArg);
              if (txId) {
                delete state.transactions[txId];
              }
            }
          },
        }),
      };

      await callback(tx);
    });

    const response = await DELETE_TRANSACTION(
      {
        url: 'http://localhost/api/transactions/tx-out',
        headers: new Headers({ 'x-household-id': 'hh-1' }),
      } as unknown as Request,
      { params: Promise.resolve({ id: 'tx-out' }) }
    );

    expect(response.status).toBe(200);
    expect(Object.values(state.transactions)).toHaveLength(0);
    expect(state.accounts['acc-source'].currentBalance).toBe(1000);
    expect(state.accounts['acc-dest'].currentBalance).toBe(500);
    assertReconciliation(state, openingBalances);
  });

  it('POST /api/transactions/[id]/convert-to-transfer creates a linked pair with reconciled balances', async () => {
    const openingBalances = {
      'acc-source': 1000,
      'acc-target': 400,
    };

    const state: LedgerState = {
      accounts: {
        'acc-source': { id: 'acc-source', currentBalance: 880, currentBalanceCents: 88000, usageCount: 1, type: 'checking' },
        'acc-target': { id: 'acc-target', currentBalance: 400, currentBalanceCents: 40000, usageCount: 2, type: 'savings' },
      },
      transactions: {
        'tx-original': {
          id: 'tx-original',
          accountId: 'acc-source',
          amount: 120,
          amountCents: 12000,
          type: 'expense',
          transferId: null,
          transferSourceAccountId: null,
          transferDestinationAccountId: null,
        },
      },
    };

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (table === transactions) {
              const txId = extractTransactionId(whereArg);
              if (txId && state.transactions[txId]) return [state.transactions[txId]];
              return [];
            }
            if (table === accounts) {
              const accountId = extractAccountId(whereArg);
              return accountId ? [state.accounts[accountId]] : [];
            }
            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: (whereArg: unknown) => ({
              limit: async () => {
                if (table === accounts) {
                  const accountId = extractAccountId(whereArg);
                  return accountId ? [state.accounts[accountId]] : [];
                }
                return [];
              },
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: async (values: Record<string, unknown>) => {
            if (table === transactions) {
              state.transactions[String(values.id)] = {
                id: String(values.id),
                accountId: String(values.accountId),
                amount: Number(values.amount),
                amountCents: Number(values.amountCents),
                type: values.type as FakeTransaction['type'],
                transferId: values.transferId ? String(values.transferId) : null,
                transferGroupId: values.transferGroupId ? String(values.transferGroupId) : null,
                pairedTransactionId: values.pairedTransactionId ? String(values.pairedTransactionId) : null,
                transferSourceAccountId: values.transferSourceAccountId
                  ? String(values.transferSourceAccountId)
                  : null,
                transferDestinationAccountId: values.transferDestinationAccountId
                  ? String(values.transferDestinationAccountId)
                  : null,
              };
            }
          },
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async (whereArg: unknown) => {
              if (table === accounts) {
                const accountId = extractAccountId(whereArg);
                if (accountId) {
                  state.accounts[accountId].currentBalance = Number(
                    updates.currentBalance ?? state.accounts[accountId].currentBalance
                  );
                  state.accounts[accountId].currentBalanceCents = Number(
                    updates.currentBalanceCents ?? state.accounts[accountId].currentBalanceCents
                  );
                }
              }
              if (table === transactions) {
                const txId = extractTransactionId(whereArg);
                if (txId && state.transactions[txId]) {
                  state.transactions[txId] = {
                    ...state.transactions[txId],
                    amountCents: updates.amountCents !== undefined
                      ? Number(updates.amountCents)
                      : state.transactions[txId].amountCents,
                    type: (updates.type as FakeTransaction['type']) || state.transactions[txId].type,
                    transferId: updates.transferId !== undefined
                      ? (updates.transferId ? String(updates.transferId) : null)
                      : state.transactions[txId].transferId,
                    transferGroupId: updates.transferGroupId !== undefined
                      ? (updates.transferGroupId ? String(updates.transferGroupId) : null)
                      : state.transactions[txId].transferGroupId,
                    pairedTransactionId: updates.pairedTransactionId !== undefined
                      ? (updates.pairedTransactionId ? String(updates.pairedTransactionId) : null)
                      : state.transactions[txId].pairedTransactionId,
                    transferSourceAccountId: updates.transferSourceAccountId !== undefined
                      ? (updates.transferSourceAccountId ? String(updates.transferSourceAccountId) : null)
                      : state.transactions[txId].transferSourceAccountId,
                    transferDestinationAccountId: updates.transferDestinationAccountId !== undefined
                      ? (updates.transferDestinationAccountId ? String(updates.transferDestinationAccountId) : null)
                      : state.transactions[txId].transferDestinationAccountId,
                  };
                }
              }
            },
          }),
        }),
      };

      await callback(tx);
    });

    const response = await CONVERT_TO_TRANSFER(
      {
        url: 'http://localhost/api/transactions/tx-original/convert-to-transfer',
        headers: new Headers({ 'x-household-id': 'hh-1' }),
        json: async () => ({
          targetAccountId: 'acc-target',
        }),
      } as unknown as Request,
      { params: Promise.resolve({ id: 'tx-original' }) }
    );

    expect(response.status).toBe(200);
    assertNoOrphanTransfers(state);
    expect(state.accounts['acc-source'].currentBalance).toBe(880);
    expect(state.accounts['acc-target'].currentBalance).toBe(520);
    assertReconciliation(state, openingBalances);
  });
});

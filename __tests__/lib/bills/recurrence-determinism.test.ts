/**
 * C-BILL-1: occurrence generation must be deterministic for a template regardless
 * of the caller's query window, and monthly day-of-month must not drift after
 * short months — otherwise later regenerations produce different dates than
 * earlier ones, the (templateId, dueDate) unique index can't dedupe, and autopay
 * pays the same bill twice.
 */
import { describe, expect, it } from 'vitest';
import { generateOccurrenceDates } from '@/lib/bills/service';
import type { billTemplates } from '@/lib/db/schema';

type TemplateRow = typeof billTemplates.$inferSelect;

function template(overrides: Partial<TemplateRow>): TemplateRow {
  return {
    id: 'tpl-1',
    householdId: 'hh-1',
    recurrenceType: 'monthly',
    recurrenceDueDay: null,
    recurrenceDueWeekday: null,
    recurrenceSpecificDueDate: null,
    recurrenceStartMonth: null,
    defaultAmountCents: 10000,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as TemplateRow;
}

describe('generateOccurrenceDates determinism (C-BILL-1)', () => {
  it('monthly day-31 re-clamps each month instead of drifting down', () => {
    const tpl = template({ recurrenceType: 'monthly', recurrenceDueDay: 31 });
    const dates = generateOccurrenceDates(
      tpl,
      new Date(2026, 6, 1), // Jul 1
      new Date(2026, 11, 31) // Dec 31
    );
    // Jul 31, Aug 31, Sep 30 (clamped), Oct 31 (back to 31 — the bug produced
    // Oct 30 after stepping from the clamped Sep 30), Nov 30, Dec 31.
    expect(dates).toEqual([
      '2026-07-31',
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
    ]);
  });

  it('monthly generation is window-independent (same October date from any window)', () => {
    const tpl = template({ recurrenceType: 'monthly', recurrenceDueDay: 31 });
    const fromJuly = generateOccurrenceDates(tpl, new Date(2026, 6, 1), new Date(2026, 10, 15));
    const fromOctober = generateOccurrenceDates(tpl, new Date(2026, 9, 1), new Date(2026, 10, 15));
    const octoberFromJuly = fromJuly.filter((d) => d.startsWith('2026-10'));
    const octoberFromOctober = fromOctober.filter((d) => d.startsWith('2026-10'));
    // The bug generated Oct 30 from a July window but Oct 31 from an October
    // window — two "different" occurrences for the same bill month.
    expect(octoberFromJuly).toEqual(octoberFromOctober);
    expect(octoberFromJuly).toEqual(['2026-10-31']);
  });

  it('biweekly keeps a stable 14-day phase as the query window slides (no weekly degeneration)', () => {
    const tpl = template({
      recurrenceType: 'biweekly',
      recurrenceDueWeekday: 5, // Friday
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    // Generate from many different daily-rolling window starts, as the real
    // callers do, and union the results — the bug phased the series off each
    // window start, so the union contained dates every 7 days.
    const union = new Set<string>();
    for (let offset = 0; offset < 14; offset++) {
      const from = new Date(2026, 2, 1 + offset);
      for (const d of generateOccurrenceDates(tpl, from, new Date(2026, 4, 31))) {
        union.add(d);
      }
    }

    const sorted = [...union].sort();
    // Consecutive union dates must be exactly 14 days apart — one series.
    for (let i = 1; i < sorted.length; i++) {
      const gap =
        (new Date(`${sorted[i]}T00:00:00`).getTime() -
          new Date(`${sorted[i - 1]}T00:00:00`).getTime()) /
        86_400_000;
      expect(gap).toBe(14);
    }
  });
});

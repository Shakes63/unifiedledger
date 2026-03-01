'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, CreditCard, ArrowDown, ArrowUpDown, ExternalLink } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import type { PaymentBillDetectionResult } from '@/lib/bills/payment-bill-detection';

const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'From account is required'),
  toAccountId: z.string().min(1, 'To account is required'),
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Amount must be a positive number'
  ),
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  fees: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    'Fees must be a positive number or zero'
  ),
  notes: z.string().optional(),
});

type TransferFormData = z.infer<typeof transferSchema>;

interface Account {
  id: string;
  name: string;
  currentBalance: number;
  color?: string;
}

interface TransferFormProps {
  accounts: Account[];
  suggestedPairs?: Array<{
    fromAccountId: string;
    toAccountId: string;
    fromAccountName: string;
    toAccountName: string;
    usageCount: number;
  }>;
  onSuccess?: (transferId: string) => void;
  onCancel?: () => void;
}

// ============================================================================
// AccountSelector — styled dropdown for the flow visualizer
// ============================================================================
function AccountSelector({
  accounts,
  value,
  onChange,
  excludeId,
  label,
  error,
}: {
  accounts: Account[];
  value: string;
  onChange: (v: string) => void;
  excludeId?: string;
  label: string;
  error?: string;
}) {
  const available = accounts.filter((a) => a.id !== excludeId);
  const selected = accounts.find((a) => a.id === value);

  return (
    <div className="relative">
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl py-3 pl-4 pr-10 text-sm font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
            color: value ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
            outline: 'none',
          }}
        >
          <option value="" disabled style={{ backgroundColor: 'var(--color-background)' }}>
            Select account
          </option>
          {available.map((acc) => (
            <option key={acc.id} value={acc.id} style={{ backgroundColor: 'var(--color-background)' }}>
              {acc.name}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          ▾
        </span>
      </div>
      {selected && (
        <p className="text-[11px] mt-1 font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
          Balance: ${selected.currentBalance.toFixed(2)}
        </p>
      )}
      {error && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
}

// ============================================================================
// Field — generic labelled input wrapper
// ============================================================================
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
}

const inputCls = `w-full rounded-xl py-2.5 px-4 text-sm transition-colors`;
const inputStyle = {
  backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-foreground)',
  outline: 'none',
};

// ============================================================================
// Main form
// ============================================================================
export function TransferForm({ accounts, suggestedPairs = [], onSuccess, onCancel }: TransferFormProps) {
  const { postWithHousehold, fetchWithHousehold } = useHouseholdFetch();
  const { selectedHouseholdId } = useHousehold();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentBillDetection, setPaymentBillDetection] = useState<PaymentBillDetectionResult | null>(null);
  const [_paymentBillLoading, setPaymentBillLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      amount: '',
      date: getTodayLocalDateString(),
      description: 'Transfer',
      fees: '0',
      notes: '',
    },
  });

  const fromAccountId = watch('fromAccountId');
  const toAccountId = watch('toAccountId');
  const amountVal = watch('amount');

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const fromBalance = fromAccount?.currentBalance ?? 0;

  // Auto-select first account
  useEffect(() => {
    if (accounts.length > 0 && !fromAccountId) {
      setValue('fromAccountId', accounts[0].id);
    }
  }, [accounts, fromAccountId, setValue]);

  // Credit card payment bill detection
  useEffect(() => {
    const detect = async () => {
      if (!toAccountId || !selectedHouseholdId) { setPaymentBillDetection(null); return; }
      try {
        setPaymentBillLoading(true);
        const response = await fetchWithHousehold(`/api/bills/detect-payment?accountId=${toAccountId}`);
        if (!response.ok) { setPaymentBillDetection(null); return; }
        setPaymentBillDetection(await response.json());
      } catch {
        setPaymentBillDetection(null);
      } finally {
        setPaymentBillLoading(false);
      }
    };
    detect();
  }, [toAccountId, selectedHouseholdId, fetchWithHousehold]);

  // Swap accounts
  const handleSwap = () => {
    const a = fromAccountId;
    const b = toAccountId;
    if (a && b) {
      setValue('fromAccountId', b);
      setValue('toAccountId', a);
    }
  };

  const onSubmit = async (data: TransferFormData) => {
    try {
      setIsLoading(true);
      const transferAmount = parseFloat(data.amount);
      const fees = parseFloat(data.fees || '0');
      if (transferAmount + fees > fromBalance) {
        toast.error(`Insufficient balance. Available: $${fromBalance.toFixed(2)}`);
        return;
      }
      const response = await postWithHousehold('/api/transfers', {
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        date: data.date,
        description: data.description,
        fees: data.fees,
        notes: data.notes,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create transfer');
      }
      const result = await response.json();
      toast.success('Transfer created!');
      reset({ amount: '', date: getTodayLocalDateString(), description: 'Transfer', fees: '0', notes: '' });
      onSuccess?.(result.transferId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create transfer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-5">

      {/* ------------------------------------------------------------------ */}
      {/* Quick suggestions                                                    */}
      {/* ------------------------------------------------------------------ */}
      {suggestedPairs.length > 0 && (
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Recent pairs
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedPairs.slice(0, 4).map((pair) => (
              <button
                key={`${pair.fromAccountId}-${pair.toAccountId}`}
                type="button"
                onClick={() => {
                  setValue('fromAccountId', pair.fromAccountId);
                  setValue('toAccountId', pair.toAccountId);
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-muted-foreground)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-foreground)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)'; }}
              >
                {pair.fromAccountName} → {pair.toAccountName}
                <span
                  className="ml-1.5 text-[10px]"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {pair.usageCount}×
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Visual flow selector: From ↕ To                                     */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <Controller
          name="fromAccountId"
          control={control}
          render={({ field }) => (
            <AccountSelector
              accounts={accounts}
              value={field.value ?? ''}
              onChange={field.onChange}
              excludeId={toAccountId}
              label="From"
              error={errors.fromAccountId?.message}
            />
          )}
        />

        {/* Swap button + vertical connector */}
        <div className="flex items-center justify-center my-2 relative">
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            {/* Top line */}
            <div className="w-px h-3" style={{ backgroundColor: 'var(--color-border)' }} />
            {/* Swap button */}
            <button
              type="button"
              onClick={handleSwap}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors z-10"
              style={{
                backgroundColor: 'color-mix(in oklch, var(--color-elevated) 90%, transparent)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-muted-foreground)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-primary) 15%, transparent)';
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 90%, transparent)';
                e.currentTarget.style.color = 'var(--color-muted-foreground)';
              }}
              title="Swap accounts"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
            {/* Bottom line */}
            <div className="w-px h-3" style={{ backgroundColor: 'var(--color-border)' }} />
          </div>
          {/* Spacer */}
          <div className="h-[46px]" />
        </div>

        <Controller
          name="toAccountId"
          control={control}
          render={({ field }) => (
            <AccountSelector
              accounts={accounts}
              value={field.value ?? ''}
              onChange={field.onChange}
              excludeId={fromAccountId}
              label="To"
              error={errors.toAccountId?.message}
            />
          )}
        />

        {/* Bill detection banner */}
        {toAccountId && paymentBillDetection && paymentBillDetection.confidence !== 'none' && (
          <div
            className="mt-3 px-3.5 py-3 rounded-xl flex items-start gap-3"
            style={{
              backgroundColor: paymentBillDetection.detectedBill?.status === 'overdue'
                ? 'color-mix(in oklch, var(--color-error) 8%, transparent)'
                : 'color-mix(in oklch, var(--color-primary) 8%, transparent)',
              border: `1px solid ${paymentBillDetection.detectedBill?.status === 'overdue'
                ? 'color-mix(in oklch, var(--color-error) 25%, transparent)'
                : 'color-mix(in oklch, var(--color-primary) 20%, transparent)'}`,
            }}
          >
            <CreditCard
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{
                color: paymentBillDetection.detectedBill?.status === 'overdue'
                  ? 'var(--color-error)'
                  : 'var(--color-primary)',
              }}
            />
            <div className="flex-1 min-w-0">
              {paymentBillDetection.detectedBill && (
                <>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: paymentBillDetection.detectedBill.status === 'overdue'
                        ? 'var(--color-error)'
                        : 'var(--color-foreground)',
                    }}
                  >
                    {paymentBillDetection.detectedBill.templateName}
                    {paymentBillDetection.detectedBill.status === 'overdue' && (
                      <span
                        className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                        style={{ backgroundColor: 'color-mix(in oklch, var(--color-error) 15%, transparent)', color: 'var(--color-error)' }}
                      >
                        Overdue
                      </span>
                    )}
                    {paymentBillDetection.detectedBill.status === 'partial' && (
                      <span
                        className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                        style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' }}
                      >
                        Partial
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Due {format(parseISO(paymentBillDetection.detectedBill.dueDate), 'MMM d, yyyy')}
                    {' · '}
                    ${(paymentBillDetection.detectedBill.expectedAmountCents / 100).toFixed(2)}
                    {paymentBillDetection.detectedBill.status === 'partial' && (
                      <span style={{ color: 'var(--color-warning)' }}>
                        {' '}(${(paymentBillDetection.detectedBill.remainingAmountCents / 100).toFixed(2)} remaining)
                      </span>
                    )}
                  </p>
                </>
              )}
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                {paymentBillDetection.reason}
              </p>
              {paymentBillDetection.confidence === 'low' && !paymentBillDetection.detectedBill && (
                <a
                  href="/dashboard/bills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] mt-1"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Set up payment bill <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Large amount input                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label
          className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Amount
        </label>
        <div className="relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            $
          </span>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full rounded-xl py-3 pl-8 pr-4 text-xl font-mono font-semibold tabular-nums transition-colors"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)',
                  border: `1px solid ${errors.amount ? 'var(--color-error)' : 'var(--color-border)'}`,
                  color: 'var(--color-foreground)',
                  outline: 'none',
                }}
              />
            )}
          />
        </div>
        {errors.amount && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-error)' }}>{errors.amount.message}</p>
        )}
        {/* Insufficient balance warning */}
        {amountVal && fromAccount && parseFloat(amountVal) > fromBalance && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-warning)' }}>
            Exceeds available balance of ${fromBalance.toFixed(2)}
          </p>
        )}
        {/* Arrow showing direction */}
        {amountVal && parseFloat(amountVal) > 0 && fromAccount && toAccountId && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
              {fromAccount.name}
            </span>
            <ArrowDown className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
              {accounts.find(a => a.id === toAccountId)?.name}
            </span>
            <span className="text-xs font-mono tabular-nums ml-auto" style={{ color: 'var(--color-primary)' }}>
              ${parseFloat(amountVal).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Secondary fields — date, description, fees, notes                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.date?.message}>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="date"
                className={inputCls}
                style={inputStyle}
              />
            )}
          />
        </Field>

        <Field label="Fees (optional)" error={errors.fees?.message}>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              $
            </span>
            <Controller
              name="fees"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl py-2.5 pl-7 pr-3 text-sm font-mono tabular-nums transition-colors"
                  style={inputStyle}
                />
              )}
            />
          </div>
        </Field>
      </div>

      <Field label="Description" error={errors.description?.message}>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              placeholder="Transfer"
              className={inputCls}
              style={inputStyle}
            />
          )}
        />
      </Field>

      <Field label="Notes (optional)">
        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              rows={2}
              placeholder="Optional notes about this transfer"
              className="w-full rounded-xl py-2.5 px-4 text-sm resize-none transition-colors"
              style={inputStyle}
            />
          )}
        />
      </Field>

      {/* ------------------------------------------------------------------ */}
      {/* Actions                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-2.5 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-muted-foreground)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Create Transfer'
          )}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CreditCard, ExternalLink } from 'lucide-react';
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

export function TransferForm({
  accounts,
  suggestedPairs = [],
  onSuccess,
  onCancel,
}: TransferFormProps) {
  const { postWithHousehold, fetchWithHousehold } = useHouseholdFetch();
  const { selectedHouseholdId } = useHousehold();
  const [isLoading, setIsLoading] = useState(false);
  // Phase 5: Credit card payment bill detection
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

  // Get balance of from account
  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const fromBalance = fromAccount?.currentBalance || 0;

  // Auto-select first account if not selected
  useEffect(() => {
    if (accounts.length > 0 && !fromAccountId) {
      setValue('fromAccountId', accounts[0].id);
    }
  }, [accounts, fromAccountId, setValue]);

  // Phase 5: Auto-detect payment bills when destination account changes
  useEffect(() => {
    const detectPaymentBill = async () => {
      if (!toAccountId || !selectedHouseholdId) {
        setPaymentBillDetection(null);
        return;
      }

      try {
        setPaymentBillLoading(true);
        const response = await fetchWithHousehold(
          `/api/bills-v2/detect-payment?accountId=${toAccountId}`
        );
        
        if (!response.ok) {
          setPaymentBillDetection(null);
          return;
        }
        
        const result: PaymentBillDetectionResult = await response.json();
        setPaymentBillDetection(result);
      } catch (error) {
        console.error('Error detecting payment bills:', error);
        setPaymentBillDetection(null);
      } finally {
        setPaymentBillLoading(false);
      }
    };

    detectPaymentBill();
  }, [toAccountId, selectedHouseholdId, fetchWithHousehold]);

  const onSubmit = async (data: TransferFormData) => {
    try {
      setIsLoading(true);

      // Validate balance
      const transferAmount = parseFloat(data.amount);
      const fees = parseFloat(data.fees || '0');
      const totalDebit = transferAmount + fees;

      if (totalDebit > fromBalance) {
        toast.error(`Insufficient balance. Available: $${fromBalance.toFixed(2)}`);
        setIsLoading(false);
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

      toast.success('Transfer created successfully!');
      reset({
        amount: '',
        date: getTodayLocalDateString(),
        description: 'Transfer',
        fees: '0',
        notes: '',
      });
      onSuccess?.(result.transferId);
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create transfer'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-card border-border">
      <h2 className="text-2xl font-bold text-foreground mb-6">New Transfer</h2>

      {/* Suggested Pairs */}
      {suggestedPairs.length > 0 && (
        <div className="mb-6 pb-6 border-b border-border">
          <p className="text-sm text-muted-foreground mb-3">Quick transfers</p>
          <div className="flex flex-wrap gap-2">
            {suggestedPairs.slice(0, 5).map((pair) => (
              <button
                key={`${pair.fromAccountId}-${pair.toAccountId}`}
                onClick={() => {
                  setValue('fromAccountId', pair.fromAccountId);
                  setValue('toAccountId', pair.toAccountId);
                }}
                className="px-3 py-2 rounded-lg bg-elevated hover:bg-elevated/80 text-sm text-muted-foreground hover:text-foreground transition border border-border hover:border-ring"
              >
                {pair.fromAccountName} → {pair.toAccountName}
                <span className="ml-2 text-muted-foreground/60">
                  ({pair.usageCount}x)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* From Account */}
        <div>
          <Label htmlFor="fromAccountId" className="text-foreground mb-2 block">
            From Account
          </Label>
          <Controller
            name="fromAccountId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-elevated border-border">
                  {accounts.map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id}
                      className="text-foreground"
                    >
                      {account.name} ($
                      {account.currentBalance.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.fromAccountId && (
            <p className="text-error text-sm mt-1">
              {errors.fromAccountId.message}
            </p>
          )}
          {fromBalance !== undefined && (
            <p className="text-muted-foreground text-sm mt-2">
              Available balance: ${fromBalance.toFixed(2)}
            </p>
          )}
        </div>

        {/* To Account */}
        <div>
          <Label htmlFor="toAccountId" className="text-foreground mb-2 block">
            To Account
          </Label>
          <Controller
            name="toAccountId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-elevated border-border">
                  {accounts
                    .filter((a) => a.id !== fromAccountId)
                    .map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id}
                        className="text-foreground"
                      >
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.toAccountId && (
            <p className="text-error text-sm mt-1">
              {errors.toAccountId.message}
            </p>
          )}

          {/* Phase 5: Credit Card Payment Bill Auto-Detection Banner */}
          {toAccountId && paymentBillDetection && paymentBillDetection.confidence !== 'none' && (
            <div className={`mt-3 p-3 rounded-lg border flex items-start gap-3 ${
              paymentBillDetection.detectedBill?.status === 'overdue'
                ? 'bg-error/10 border-error/30'
                : paymentBillDetection.confidence === 'high'
                  ? 'bg-primary/10 border-primary/30'
                  : paymentBillDetection.confidence === 'medium'
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-elevated border-border'
            }`}>
              <CreditCard className={`w-5 h-5 shrink-0 mt-0.5 ${
                paymentBillDetection.detectedBill?.status === 'overdue'
                  ? 'text-error'
                  : 'text-primary'
              }`} />
              <div className="flex-1 min-w-0">
                {paymentBillDetection.detectedBill ? (
                  <>
                    <p className={`text-sm font-medium ${
                      paymentBillDetection.detectedBill.status === 'overdue' 
                        ? 'text-error' 
                        : 'text-foreground'
                    }`}>
                      {paymentBillDetection.detectedBill.billName}
                      {paymentBillDetection.detectedBill.status === 'overdue' && (
                        <span className="ml-2 text-xs font-normal bg-error/20 px-1.5 py-0.5 rounded">
                          OVERDUE
                        </span>
                      )}
                      {paymentBillDetection.detectedBill.status === 'partial' && (
                        <span className="ml-2 text-xs font-normal bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                          PARTIAL
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {format(parseISO(paymentBillDetection.detectedBill.dueDate), 'MMM d, yyyy')}
                      {' '}&middot;{' '}
                      ${paymentBillDetection.detectedBill.expectedAmount.toFixed(2)}
                      {paymentBillDetection.detectedBill.status === 'partial' && (
                        <span className="text-warning">
                          {' '}(${paymentBillDetection.detectedBill.remainingAmount.toFixed(2)} remaining)
                        </span>
                      )}
                    </p>
                  </>
                ) : null}
                <p className={`text-xs mt-1 ${
                  paymentBillDetection.detectedBill?.status === 'overdue'
                    ? 'text-error'
                    : paymentBillDetection.confidence === 'high'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                }`}>
                  {paymentBillDetection.reason}
                </p>
                {paymentBillDetection.confidence === 'low' && !paymentBillDetection.detectedBill && (
                  <a
                    href="/dashboard/bills"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    Set up payment bill <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <Label htmlFor="amount" className="text-foreground mb-2 block">
            Amount
          </Label>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                placeholder="0.00"
                step="0.01"
                className="bg-elevated border-border text-foreground placeholder-muted-foreground"
              />
            )}
          />
          {errors.amount && (
            <p className="text-error text-sm mt-1">
              {errors.amount.message}
            </p>
          )}
        </div>

        {/* Fees (Optional) */}
        <div>
          <Label htmlFor="fees" className="text-foreground mb-2 block">
            Fees (Optional)
          </Label>
          <Controller
            name="fees"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                placeholder="0.00"
                step="0.01"
                className="bg-elevated border-border text-foreground placeholder-muted-foreground"
              />
            )}
          />
          {errors.fees && (
            <p className="text-error text-sm mt-1">
              {errors.fees.message}
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <Label htmlFor="date" className="text-foreground mb-2 block">
            Date
          </Label>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="date"
                className="bg-elevated border-border text-foreground"
              />
            )}
          />
          {errors.date && (
            <p className="text-error text-sm mt-1">
              {errors.date.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description" className="text-foreground mb-2 block">
            Description
          </Label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Transfer"
                className="bg-elevated border-border text-foreground placeholder-muted-foreground"
              />
            )}
          />
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="text-foreground mb-2 block">
            Notes
          </Label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                placeholder="Optional notes about this transfer"
                className="bg-elevated border-border text-foreground placeholder-muted-foreground"
              />
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-primary hover:opacity-90 text-primary-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Transfer'
            )}
          </Button>
          {onCancel && (
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1 border-border text-muted-foreground hover:bg-elevated"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(false);
  const [_selectedFromAccountId, _setSelectedFromAccountId] = useState<string>('');

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
      date: new Date().toISOString().split('T')[0],
      description: 'Transfer',
      fees: '0',
      notes: '',
    },
  });

  const fromAccountId = watch('fromAccountId');
  const _toAccountId = watch('toAccountId');
  const _amount = watch('amount');

  // Get balance of from account
  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const fromBalance = fromAccount?.currentBalance || 0;

  // Auto-select first account if not selected
  useEffect(() => {
    if (accounts.length > 0 && !fromAccountId) {
      setValue('fromAccountId', accounts[0].id);
    }
  }, [accounts, fromAccountId, setValue]);

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

      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          amount: data.amount,
          date: data.date,
          description: data.description,
          fees: data.fees,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create transfer');
      }

      const result = await response.json();

      // Refresh page to update balances
      setTimeout(() => {
        window.location.reload();
      }, 1500);

      toast.success('Transfer created successfully!');
      reset();
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
    <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
      <h2 className="text-2xl font-bold text-white mb-6">New Transfer</h2>

      {/* Suggested Pairs */}
      {suggestedPairs.length > 0 && (
        <div className="mb-6 pb-6 border-b border-[#2a2a2a]">
          <p className="text-sm text-[#9ca3af] mb-3">Quick transfers</p>
          <div className="flex flex-wrap gap-2">
            {suggestedPairs.slice(0, 5).map((pair) => (
              <button
                key={`${pair.fromAccountId}-${pair.toAccountId}`}
                onClick={() => {
                  setValue('fromAccountId', pair.fromAccountId);
                  setValue('toAccountId', pair.toAccountId);
                }}
                className="px-3 py-2 rounded-lg bg-[#242424] hover:bg-[#2a2a2a] text-sm text-[#9ca3af] hover:text-white transition border border-[#2a2a2a] hover:border-[#3a3a3a]"
              >
                {pair.fromAccountName} → {pair.toAccountName}
                <span className="ml-2 text-[#6b7280]">
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
          <Label htmlFor="fromAccountId" className="text-white mb-2 block">
            From Account
          </Label>
          <Controller
            name="fromAccountId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-[#242424] border-[#2a2a2a]">
                  {accounts.map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id}
                      className="text-white"
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
            <p className="text-red-400 text-sm mt-1">
              {errors.fromAccountId.message}
            </p>
          )}
          {fromBalance !== undefined && (
            <p className="text-[#6b7280] text-sm mt-2">
              Available balance: ${fromBalance.toFixed(2)}
            </p>
          )}
        </div>

        {/* To Account */}
        <div>
          <Label htmlFor="toAccountId" className="text-white mb-2 block">
            To Account
          </Label>
          <Controller
            name="toAccountId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-[#242424] border-[#2a2a2a]">
                  {accounts
                    .filter((a) => a.id !== fromAccountId)
                    .map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id}
                        className="text-white"
                      >
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.toAccountId && (
            <p className="text-red-400 text-sm mt-1">
              {errors.toAccountId.message}
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <Label htmlFor="amount" className="text-white mb-2 block">
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
                className="bg-[#242424] border-[#2a2a2a] text-white placeholder-[#6b7280]"
              />
            )}
          />
          {errors.amount && (
            <p className="text-red-400 text-sm mt-1">
              {errors.amount.message}
            </p>
          )}
        </div>

        {/* Fees (Optional) */}
        <div>
          <Label htmlFor="fees" className="text-white mb-2 block">
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
                className="bg-[#242424] border-[#2a2a2a] text-white placeholder-[#6b7280]"
              />
            )}
          />
          {errors.fees && (
            <p className="text-red-400 text-sm mt-1">
              {errors.fees.message}
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <Label htmlFor="date" className="text-white mb-2 block">
            Date
          </Label>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="date"
                className="bg-[#242424] border-[#2a2a2a] text-white"
              />
            )}
          />
          {errors.date && (
            <p className="text-red-400 text-sm mt-1">
              {errors.date.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description" className="text-white mb-2 block">
            Description
          </Label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Transfer"
                className="bg-[#242424] border-[#2a2a2a] text-white placeholder-[#6b7280]"
              />
            )}
          />
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="text-white mb-2 block">
            Notes
          </Label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                placeholder="Optional notes about this transfer"
                className="bg-[#242424] border-[#2a2a2a] text-white placeholder-[#6b7280]"
              />
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-white"
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
              className="flex-1 border-[#2a2a2a] text-[#9ca3af] hover:bg-[#242424]"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

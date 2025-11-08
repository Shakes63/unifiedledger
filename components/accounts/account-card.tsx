'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit2, Trash2, Copy, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: string;
    bankName?: string;
    accountNumberLast4?: string;
    currentBalance: number;
    creditLimit?: number;
    color: string;
    icon: string;
  };
  onEdit?: (account: any) => void;
  onDelete?: (accountId: string) => void;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  investment: 'Investment',
  cash: 'Cash',
};

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const handleCopyAccountNumber = () => {
    if (account.accountNumberLast4) {
      navigator.clipboard.writeText(account.accountNumberLast4);
      toast.success('Account number copied');
    }
  };

  const isCreditAccount = account.type === 'credit';
  const availableBalance = isCreditAccount
    ? (account.creditLimit || 0) - account.currentBalance
    : account.currentBalance;
  const utilization = isCreditAccount && account.creditLimit
    ? (account.currentBalance / account.creditLimit) * 100
    : null;

  return (
    <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl hover:border-[#3a3a3a] transition-all relative group">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-semibold"
            style={{ backgroundColor: account.color + '20', borderColor: account.color, borderWidth: '2px' }}
          >
            {account.icon === 'wallet' && '💼'}
            {account.icon === 'bank' && '🏦'}
            {account.icon === 'credit-card' && '💳'}
            {account.icon === 'piggy-bank' && '🐷'}
            {account.icon === 'trending-up' && '📈'}
            {account.icon === 'dollar-sign' && '💵'}
            {account.icon === 'coins' && '🪙'}
            {account.icon === 'briefcase' && '💼'}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">{account.name}</h3>
            <p className="text-gray-500 text-sm">{ACCOUNT_TYPE_LABELS[account.type]}</p>
            {account.bankName && (
              <p className="text-gray-600 text-xs">{account.bankName}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-[#242424] text-gray-400"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#242424] border-[#2a2a2a]">
            {onEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(account)}
                className="text-gray-300 cursor-pointer hover:bg-[#2a2a2a]"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {account.accountNumberLast4 && (
              <DropdownMenuItem
                onClick={handleCopyAccountNumber}
                className="text-gray-300 cursor-pointer hover:bg-[#2a2a2a]"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Last 4
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(account.id)}
                className="text-red-400 cursor-pointer hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Balances */}
      <div className="space-y-4">
        {isCreditAccount ? (
          <>
            <div>
              <p className="text-gray-500 text-xs mb-1">Balance</p>
              <p className="text-2xl font-bold text-red-400">
                ${account.currentBalance.toFixed(2)}
              </p>
            </div>
            {account.creditLimit && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Credit Limit</span>
                  <span className="text-gray-400">${account.creditLimit.toFixed(2)}</span>
                </div>
                <div className="w-full bg-[#242424] rounded-full h-2 overflow-hidden border border-[#2a2a2a]">
                  <div
                    className={`h-full transition-all ${
                      utilization! >= 100
                        ? 'bg-red-500'
                        : utilization! >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(utilization!, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Available</span>
                  <span className={`font-semibold ${availableBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    ${availableBalance.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <p className="text-gray-500 text-xs mb-1">Balance</p>
            <p
              className="text-3xl font-bold"
              style={{ color: account.color }}
            >
              ${account.currentBalance.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Account Number */}
      {account.accountNumberLast4 && (
        <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
          <p className="text-gray-600 text-xs">Account ending in</p>
          <p className="text-gray-400 text-sm font-mono">•••• {account.accountNumberLast4}</p>
        </div>
      )}

      {/* View Transactions Link */}
      <Link href={`/dashboard/transactions?accountId=${account.id}`}>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 text-gray-400 hover:text-white hover:bg-[#242424] border-[#2a2a2a]"
        >
          View Transactions
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </Card>
  );
}

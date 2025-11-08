'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  accountId: string;
  categoryId?: string;
  merchantId?: string;
  transferId?: string;
  notes?: string;
}

interface Merchant {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
}

export function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [repeatingTxId, setRepeatingTxId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch transactions
        const txResponse = await fetch('/api/transactions?limit=5');
        if (txResponse.ok) {
          const data = await txResponse.json();
          setTransactions(data);
        }

        // Fetch merchants
        const merResponse = await fetch('/api/merchants?limit=1000');
        if (merResponse.ok) {
          const merData = await merResponse.json();
          setMerchants(merData);
        }

        // Fetch accounts
        const accResponse = await fetch('/api/accounts');
        if (accResponse.ok) {
          const accData = await accResponse.json();
          setAccounts(accData);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRepeatTransaction = async (transaction: Transaction) => {
    try {
      setRepeatingTxId(transaction.id);

      const today = new Date().toISOString().split('T')[0];

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          merchantId: transaction.merchantId,
          date: today,
          amount: transaction.amount,
          description: transaction.description,
          notes: transaction.notes,
          type: transaction.type,
        }),
      });

      if (response.ok) {
        const newTransaction = await response.json();
        // Add new transaction and keep only the most recent 5
        setTransactions([newTransaction, ...transactions.slice(0, -1)]);
        toast.success(`Transaction repeated: ${transaction.description}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to repeat transaction');
      }
    } catch (error) {
      console.error('Error repeating transaction:', error);
      toast.error('Failed to repeat transaction');
    } finally {
      setRepeatingTxId(null);
    }
  };

  const getMerchantName = (merchantId?: string): string | null => {
    if (!merchantId) return null;
    const merchant = merchants.find((m) => m.id === merchantId);
    return merchant?.name || null;
  };

  const getAccountName = (accountId?: string): string => {
    if (!accountId) return 'Unknown';
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const getTransactionDisplay = (transaction: Transaction): string => {
    if (transaction.type === 'transfer') {
      return `${getAccountName(transaction.accountId)} → ${getAccountName(transaction.transferId)}`;
    }
    const merchant = getMerchantName(transaction.merchantId);
    if (merchant) {
      return merchant;
    }
    return transaction.description;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
      case 'expense':
        return <ArrowUpRight className="w-4 h-4 text-red-400" />;
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'expense':
        return 'bg-red-500/20 text-red-400';
      case 'transfer_in':
      case 'transfer_out':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] text-center py-12 rounded-xl">
        <p className="text-gray-400">Loading transactions...</p>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] text-center py-12 rounded-xl">
        <p className="text-gray-400 mb-4">No transactions yet.</p>
        <Link href="/dashboard/transactions/new">
          <Button className="bg-white text-black hover:bg-gray-100 font-medium">Add Your First Transaction</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card
          key={transaction.id}
          className="p-4 border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#242424] transition-colors rounded-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2.5 bg-[#242424] rounded-lg">
                {getTransactionIcon(transaction.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{getTransactionDisplay(transaction)}</p>
                <p className="text-xs text-gray-500">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className={`font-semibold text-sm ${
                  transaction.type === 'income' ? 'text-emerald-400' : 'text-white'
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                </p>
                <Badge className={`${getTypeColor(transaction.type)} text-xs`} variant="secondary">
                  {transaction.type.replace('_', ' ')}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRepeatTransaction(transaction)}
                disabled={repeatingTxId === transaction.id}
                className="text-gray-400 hover:text-white hover:bg-[#242424]"
                title="Repeat this transaction with today's date"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <Link href="/dashboard/transactions">
        <Button variant="outline" className="w-full rounded-lg border-[#2a2a2a]">
          View All Transactions
        </Button>
      </Link>
    </div>
  );
}

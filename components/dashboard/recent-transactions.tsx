'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  accountId: string;
}

export function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/transactions?limit=5');
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2.5 bg-[#242424] rounded-lg">
                {getTransactionIcon(transaction.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{transaction.description}</p>
                <p className="text-xs text-gray-500">
                  {new Date(transaction.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${
                transaction.type === 'income' ? 'text-emerald-400' : 'text-white'
              }`}>
                {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
              </p>
              <Badge className={getTypeColor(transaction.type)} variant="secondary">
                {transaction.type.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </Card>
      ))}
      <Link href="/dashboard/transactions">
        <Button variant="ghost" className="w-full text-gray-400 hover:text-white">
          View All Transactions
        </Button>
      </Link>
    </div>
  );
}

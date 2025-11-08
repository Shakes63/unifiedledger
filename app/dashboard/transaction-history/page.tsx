import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionHistory } from '@/components/transactions/transaction-history';

export const metadata = {
  title: 'Transaction History',
  description: 'View and repeat your transaction history',
};

export default async function TransactionHistoryPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Transaction History</h1>
          <p className="text-muted-foreground">
            View and repeat your past transactions. Click the repeat icon to create a new transaction based on a previous one.
          </p>
        </div>

        {/* Main Content */}
        <Card className="border-[#2a2a2a] bg-[#1a1a1a] p-6">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#242424] border-[#3a3a3a]">
              <TabsTrigger value="all">All Transactions</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <TransactionHistory />
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="p-6 text-center border border-[#2a2a2a] rounded-lg bg-[#242424]">
                <p className="text-muted-foreground mb-4">
                  Save transactions as templates for quick access to common transactions.
                </p>
                <p className="text-sm text-muted-foreground">
                  Click "Save as Template" when creating a transaction to save it for later use.
                </p>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Tips</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Create templates for recurring or regular transactions</li>
                  <li>• Use the "Use Template" button in the transaction form to quickly fill in transaction details</li>
                  <li>• Templates track usage and show your most-used templates first</li>
                  <li>• Edit amount and date when using a template - most other fields will be auto-filled</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, merchants, bills, billInstances } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * Analyzes transaction history to detect potential recurring bills
 * Looks for transactions that happen on similar dates with similar amounts
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      minAmount = 10,
      maxAmount = 10000,
      minOccurrences = 3, // Must appear at least 3 times to be considered recurring
      amountVariance = 0.2, // 20% variance in amounts
      lookbackMonths = 12,
    } = body;

    // Get transactions from the past X months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);
    const startDateStr = startDate.toISOString().split('T')[0];

    const relevantTransactions = await db
      .select({
        id: transactions.id,
        merchantId: transactions.description,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        type: transactions.type,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense')
        )
      )
      .orderBy(desc(transactions.date));

    // Group transactions by merchant/description and date patterns
    const billCandidates: Record<
      string,
      {
        description: string;
        amounts: number[];
        dates: string[];
        dayOfMonth: number[];
        minAmount: number;
        maxAmount: number;
        avgAmount: number;
        occurrences: number;
      }
    > = {};

    relevantTransactions.forEach((tx) => {
      const key = tx.description.toLowerCase().trim();

      if (!billCandidates[key]) {
        billCandidates[key] = {
          description: tx.description,
          amounts: [],
          dates: [],
          dayOfMonth: [],
          minAmount: tx.amount,
          maxAmount: tx.amount,
          avgAmount: 0,
          occurrences: 0,
        };
      }

      const candidate = billCandidates[key];
      candidate.amounts.push(tx.amount);
      candidate.dates.push(tx.date);
      candidate.occurrences++;
      candidate.minAmount = Math.min(candidate.minAmount, tx.amount);
      candidate.maxAmount = Math.max(candidate.maxAmount, tx.amount);

      // Extract day of month
      const dayOfMonth = new Date(tx.date).getDate();
      candidate.dayOfMonth.push(dayOfMonth);
    });

    // Analyze candidates to find likely recurring bills
    const detectedBills = Object.values(billCandidates)
      .filter((candidate) => {
        // Must have occurred at least minOccurrences times
        if (candidate.occurrences < minOccurrences) return false;

        // Check amount variance
        const avgAmount =
          candidate.amounts.reduce((a, b) => a + b, 0) / candidate.amounts.length;
        const variance = (candidate.maxAmount - candidate.minAmount) / avgAmount;

        if (variance > amountVariance) return false;

        // Check amount is within range
        if (avgAmount < minAmount || avgAmount > maxAmount) return false;

        return true;
      })
      .map((candidate) => {
        const avgAmount =
          candidate.amounts.reduce((a, b) => a + b, 0) / candidate.amounts.length;

        // Find most common day of month
        const dayFrequency: Record<number, number> = {};
        candidate.dayOfMonth.forEach((day) => {
          dayFrequency[day] = (dayFrequency[day] || 0) + 1;
        });
        const mostCommonDay = Object.entries(dayFrequency).sort(
          ([, a], [, b]) => b - a
        )[0][0];

        return {
          name: candidate.description,
          expectedAmount: Math.round(avgAmount * 100) / 100,
          dueDate: parseInt(mostCommonDay),
          occurrences: candidate.occurrences,
          minAmount: candidate.minAmount,
          maxAmount: candidate.maxAmount,
          confidence: Math.min(
            100,
            (candidate.occurrences / lookbackMonths) * 30
          ), // Confidence score
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    // Check which bills already exist
    const existingBillNames = await db
      .select({ name: bills.name })
      .from(bills)
      .where(eq(bills.userId, userId));

    const existingNames = new Set(
      existingBillNames.map((b) => b.name.toLowerCase())
    );

    const newBills = detectedBills.filter(
      (candidate) => !existingNames.has(candidate.name.toLowerCase())
    );

    return Response.json({
      detected: newBills,
      total: newBills.length,
      analyzed: relevantTransactions.length,
    });
  } catch (error) {
    console.error('Error detecting bills:', error);
    return Response.json(
      { error: 'Failed to detect bills' },
      { status: 500 }
    );
  }
}

/**
 * Creates bills from detected candidates
 */
export async function PUT(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bills: billsToCreate } = body;

    if (!Array.isArray(billsToCreate) || billsToCreate.length === 0) {
      return Response.json(
        { error: 'No bills provided' },
        { status: 400 }
      );
    }

    const createdBills = [];

    for (const billData of billsToCreate) {
      const { name, expectedAmount, dueDate, categoryId, notes } = billData;

      if (!name || !expectedAmount || !dueDate) {
        continue;
      }

      const billId = nanoid();

      try {
        await db.insert(bills).values({
          id: billId,
          userId,
          name,
          categoryId: categoryId || null,
          expectedAmount: parseFloat(expectedAmount),
          dueDate,
          isVariableAmount: false,
          autoMarkPaid: true,
          notes: notes || null,
        });

        // Create initial bill instances for next 3 months
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        for (let i = 0; i < 3; i++) {
          let month = (currentMonth + i) % 12;
          let year = currentYear + Math.floor((currentMonth + i) / 12);

          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const instanceDueDate = Math.min(dueDate, daysInMonth);
          const dueDateString = new Date(year, month, instanceDueDate)
            .toISOString()
            .split('T')[0];

          await db.insert(billInstances).values({
            id: nanoid(),
            userId,
            billId,
            dueDate: dueDateString,
            expectedAmount: parseFloat(expectedAmount),
            status: 'pending',
          });
        }

        createdBills.push(billId);
      } catch (error) {
        console.error(`Error creating bill ${name}:`, error);
        continue;
      }
    }

    return Response.json({
      created: createdBills.length,
      billIds: createdBills,
    });
  } catch (error) {
    console.error('Error creating bills:', error);
    return Response.json(
      { error: 'Failed to create bills' },
      { status: 500 }
    );
  }
}

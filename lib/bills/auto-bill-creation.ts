/**
 * Auto Bill Creation Helper
 * 
 * Functions for automatically creating bills linked to credit card accounts.
 * Used when creating/editing credit cards and lines of credit with payment tracking enabled.
 */

import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { format, addMonths } from 'date-fns';
import type { PaymentAmountSource } from '@/lib/types';

interface CreatePaymentBillParams {
  accountId: string;
  accountName: string;
  userId: string;
  householdId: string;
  amountSource: PaymentAmountSource;
  dueDay: number;
  expectedAmount?: number;
  categoryId?: string | null;
}

interface CreateAnnualFeeBillParams {
  accountId: string;
  accountName: string;
  userId: string;
  householdId: string;
  annualFee: number;
  feeMonth: number; // 1-12
  categoryId?: string | null;
}

/**
 * Creates a monthly payment bill linked to a credit account.
 * This bill tracks the monthly payment due for the credit card or line of credit.
 * 
 * @returns The ID of the created bill
 */
export async function createPaymentBill({
  accountId,
  accountName,
  userId,
  householdId,
  amountSource,
  dueDay,
  expectedAmount = 0,
  categoryId = null,
}: CreatePaymentBillParams): Promise<string> {
  const billId = nanoid();
  const now = new Date();
  const nowString = now.toISOString();

  // Create the bill
  const billData = {
    id: billId,
    userId,
    householdId,
    name: `${accountName} Payment`,
    categoryId,
    expectedAmount,
    dueDate: dueDay,
    frequency: 'monthly' as const,
    isVariableAmount: true, // Payment amounts vary based on balance
    amountTolerance: 100, // Wide tolerance for variable payments
    isActive: true,
    autoMarkPaid: true,
    // Link to the credit account
    linkedAccountId: accountId,
    amountSource,
    // Classification
    billType: 'expense' as const,
    billClassification: 'loan_payment' as const,
    createdAt: nowString,
  };

  // Define instance data type
  interface BillInstanceData {
    id: string;
    userId: string;
    householdId: string;
    billId: string;
    dueDate: string;
    expectedAmount: number;
    status: 'pending';
    createdAt: string;
    updatedAt: string;
  }

  // Generate bill instances (3 months ahead for monthly bills)
  const instancesData: BillInstanceData[] = [];
  for (let i = 0; i < 3; i++) {
    const instanceDate = addMonths(now, i);
    // Set to the due day of each month
    const dueDate = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), dueDay);
    // If the due date is in the past this month, start from next month
    if (i === 0 && dueDate < now) {
      continue;
    }
    
    instancesData.push({
      id: nanoid(),
      userId,
      householdId,
      billId,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      expectedAmount,
      status: 'pending',
      createdAt: nowString,
      updatedAt: nowString,
    });
  }

  // Ensure we have at least 3 instances
  while (instancesData.length < 3) {
    const lastInstance = instancesData[instancesData.length - 1];
    const lastDate = lastInstance ? new Date(lastInstance.dueDate) : now;
    const nextDate = addMonths(lastDate, 1);
    const dueDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), dueDay);
    
    instancesData.push({
      id: nanoid(),
      userId,
      householdId,
      billId,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      expectedAmount,
      status: 'pending',
      createdAt: nowString,
      updatedAt: nowString,
    });
  }

  // Execute bill and instances creation in parallel
  await Promise.all([
    db.insert(bills).values(billData),
    instancesData.length > 0 ? db.insert(billInstances).values(instancesData) : Promise.resolve(),
  ]);

  return billId;
}

/**
 * Creates an annual fee bill for a credit card.
 * This bill tracks the annual fee charged by the credit card company.
 * 
 * @returns The ID of the created bill
 */
export async function createAnnualFeeBill({
  accountId,
  accountName,
  userId,
  householdId,
  annualFee,
  feeMonth,
  categoryId = null,
}: CreateAnnualFeeBillParams): Promise<string> {
  const billId = nanoid();
  const now = new Date();
  const nowString = now.toISOString();

  // Determine the due day (typically day 1 of the fee month, or can be customized)
  const dueDay = 1;

  // Create the bill
  const billData = {
    id: billId,
    userId,
    householdId,
    name: `${accountName} Annual Fee`,
    categoryId,
    expectedAmount: annualFee,
    dueDate: dueDay,
    frequency: 'annual' as const,
    startMonth: feeMonth - 1, // Convert 1-12 to 0-11 for startMonth field
    isVariableAmount: false, // Annual fee is typically fixed
    amountTolerance: 5,
    isActive: true,
    autoMarkPaid: false, // Annual fees typically require manual confirmation
    // Link to the credit account for reference
    chargedToAccountId: accountId, // This bill charges TO the card
    // Classification
    billType: 'expense' as const,
    billClassification: 'membership' as const,
    createdAt: nowString,
  };

  // Define instance data type
  interface AnnualBillInstanceData {
    id: string;
    userId: string;
    householdId: string;
    billId: string;
    dueDate: string;
    expectedAmount: number;
    status: 'pending';
    createdAt: string;
    updatedAt: string;
  }

  // Generate bill instances (2 years ahead for annual bills)
  const instancesData: AnnualBillInstanceData[] = [];
  const currentYear = now.getFullYear();
  
  for (let i = 0; i < 2; i++) {
    const year = currentYear + i;
    const dueDate = new Date(year, feeMonth - 1, dueDay); // feeMonth is 1-12, Date month is 0-11
    
    // Skip if the due date is in the past
    if (dueDate < now) {
      continue;
    }
    
    instancesData.push({
      id: nanoid(),
      userId,
      householdId,
      billId,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      expectedAmount: annualFee,
      status: 'pending',
      createdAt: nowString,
      updatedAt: nowString,
    });
  }

  // Ensure we have at least 2 instances
  while (instancesData.length < 2) {
    const lastInstance = instancesData[instancesData.length - 1];
    const lastDate = lastInstance ? new Date(lastInstance.dueDate) : now;
    const nextYear = lastDate.getFullYear() + 1;
    const dueDate = new Date(nextYear, feeMonth - 1, dueDay);
    
    instancesData.push({
      id: nanoid(),
      userId,
      householdId,
      billId,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      expectedAmount: annualFee,
      status: 'pending',
      createdAt: nowString,
      updatedAt: nowString,
    });
  }

  // Execute bill and instances creation in parallel
  await Promise.all([
    db.insert(bills).values(billData),
    instancesData.length > 0 ? db.insert(billInstances).values(instancesData) : Promise.resolve(),
  ]);

  return billId;
}

/**
 * Deactivates a bill by setting isActive to false.
 * Used when disabling payment tracking on an account.
 * 
 * @param billId - The ID of the bill to deactivate
 */
export async function deactivateBill(billId: string): Promise<void> {
  const { eq } = await import('drizzle-orm');
  
  await db
    .update(bills)
    .set({ 
      isActive: false,
    })
    .where(eq(bills.id, billId));
}


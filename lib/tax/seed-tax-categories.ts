/**
 * Tax Category Seeding Utility
 * Seeds standard IRS tax categories into the database
 */

import { db } from '@/lib/db';
import { taxCategories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Standard IRS tax categories for seeding
 */
export const STANDARD_TAX_CATEGORIES = [
  // Schedule C - Business Income/Expenses
  {
    name: 'Gross Receipts',
    formType: 'schedule_c' as const,
    lineNumber: '1c',
    category: 'business_income' as const,
    deductible: false,
    description: 'Total business income from sales or services',
  },
  {
    name: 'Cost of Goods Sold',
    formType: 'schedule_c' as const,
    lineNumber: '4',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Direct costs of goods sold (inventory, materials)',
  },
  {
    name: 'Advertising',
    formType: 'schedule_c' as const,
    lineNumber: '8',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Marketing and advertising expenses',
  },
  {
    name: 'Car and Truck Expenses',
    formType: 'schedule_c' as const,
    lineNumber: '9',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Business use of vehicles (mileage or actual expenses)',
  },
  {
    name: 'Depreciation',
    formType: 'schedule_c' as const,
    lineNumber: '13',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Depreciation of business assets and equipment',
  },
  {
    name: 'Insurance (Business)',
    formType: 'schedule_c' as const,
    lineNumber: '15',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Business insurance (liability, property, etc.)',
  },
  {
    name: 'Legal and Professional Services',
    formType: 'schedule_c' as const,
    lineNumber: '17',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Attorney, accountant, and consultant fees',
  },
  {
    name: 'Office Expense',
    formType: 'schedule_c' as const,
    lineNumber: '18',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Office supplies, postage, printing',
  },
  {
    name: 'Rent or Lease (Business Property)',
    formType: 'schedule_c' as const,
    lineNumber: '20b',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Rent for business space, equipment leases',
  },
  {
    name: 'Repairs and Maintenance',
    formType: 'schedule_c' as const,
    lineNumber: '21',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Repairs to business property and equipment',
  },
  {
    name: 'Supplies',
    formType: 'schedule_c' as const,
    lineNumber: '22',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Materials and supplies used in business',
  },
  {
    name: 'Travel',
    formType: 'schedule_c' as const,
    lineNumber: '24a',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Business travel (transportation, lodging)',
  },
  {
    name: 'Meals (50% Deductible)',
    formType: 'schedule_c' as const,
    lineNumber: '24b',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Business meals (only 50% is deductible)',
  },
  {
    name: 'Utilities',
    formType: 'schedule_c' as const,
    lineNumber: '25',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Business utilities (electric, phone, internet)',
  },
  {
    name: 'Other Business Expenses',
    formType: 'schedule_c' as const,
    lineNumber: '27a',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Miscellaneous business expenses',
  },
  {
    name: 'Home Office Deduction',
    formType: 'schedule_c' as const,
    lineNumber: '30',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Expenses for home office use',
  },

  // Schedule A - Itemized Personal Deductions
  {
    name: 'Medical and Dental Expenses',
    formType: 'schedule_a' as const,
    lineNumber: '1',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Unreimbursed medical and dental costs (subject to AGI limit)',
  },
  {
    name: 'State and Local Taxes (SALT)',
    formType: 'schedule_a' as const,
    lineNumber: '5',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'State income, sales, and property taxes (max $10,000)',
  },
  {
    name: 'Mortgage Interest',
    formType: 'schedule_a' as const,
    lineNumber: '8',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Interest on home mortgage (up to $750k loan limit)',
  },
  {
    name: 'Charitable Contributions (Cash)',
    formType: 'schedule_a' as const,
    lineNumber: '11',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Cash donations to qualified charities',
  },
  {
    name: 'Charitable Contributions (Non-Cash)',
    formType: 'schedule_a' as const,
    lineNumber: '12',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Donated goods and property to qualified charities',
  },
  {
    name: 'Casualty and Theft Losses',
    formType: 'schedule_a' as const,
    lineNumber: '15',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Losses from federally declared disasters',
  },

  // Schedule D - Capital Gains/Losses
  {
    name: 'Short-term Capital Gains',
    formType: 'schedule_d' as const,
    lineNumber: '7',
    category: 'investment_income' as const,
    deductible: false,
    description: 'Gains from assets held less than one year',
  },
  {
    name: 'Long-term Capital Gains',
    formType: 'schedule_d' as const,
    lineNumber: '15',
    category: 'investment_income' as const,
    deductible: false,
    description: 'Gains from assets held more than one year',
  },
  {
    name: 'Capital Losses',
    formType: 'schedule_d' as const,
    lineNumber: '21',
    category: 'investment_expense' as const,
    deductible: true,
    description: 'Net capital losses (up to $3,000 per year)',
  },

  // Schedule E - Rental Income
  {
    name: 'Rental Income',
    formType: 'schedule_e' as const,
    lineNumber: '3',
    category: 'rental_income' as const,
    deductible: false,
    description: 'Income from rental properties',
  },
  {
    name: 'Rental Expenses',
    formType: 'schedule_e' as const,
    lineNumber: '5-19',
    category: 'rental_expense' as const,
    deductible: true,
    description: 'Expenses for rental property (repairs, insurance, etc.)',
  },

  // Form 1040 - General Income
  {
    name: 'Interest Income',
    formType: 'form_1040' as const,
    lineNumber: '2b',
    category: 'investment_income' as const,
    deductible: false,
    description: 'Interest from bank accounts, bonds, etc.',
  },
  {
    name: 'Dividend Income (Qualified)',
    formType: 'form_1040' as const,
    lineNumber: '5b',
    category: 'investment_income' as const,
    deductible: false,
    description: 'Qualified dividends from stocks',
  },
  {
    name: 'Self-Employment Tax Deduction',
    formType: 'form_1040' as const,
    lineNumber: '15',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Deductible portion of self-employment tax (50%)',
  },
  {
    name: 'Health Insurance (Self-Employed)',
    formType: 'form_1040' as const,
    lineNumber: '17',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Health insurance premiums for self-employed individuals',
  },
  {
    name: 'IRA Contributions',
    formType: 'form_1040' as const,
    lineNumber: '20',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Traditional IRA contributions',
  },
  {
    name: 'Student Loan Interest',
    formType: 'form_1040' as const,
    lineNumber: '21',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Interest paid on student loans (up to $2,500)',
  },

  // Interest Deductions - Additional Categories for Unified Debt Architecture
  {
    name: 'HELOC/Home Equity Interest',
    formType: 'schedule_a' as const,
    lineNumber: '8b',
    category: 'personal_deduction' as const,
    deductible: true,
    description: 'Interest on home equity loans used for home improvement',
  },
  {
    name: 'Business Interest Expense',
    formType: 'schedule_c' as const,
    lineNumber: '16b',
    category: 'business_expense' as const,
    deductible: true,
    description: 'Interest on business loans and credit lines',
  },
];

/**
 * Seed tax categories into the database
 * Only creates categories that don't already exist (by name)
 */
export async function seedTaxCategories(): Promise<{
  created: number;
  skipped: number;
  categories: Array<{ id: string; name: string; formType: string }>;
}> {
  let created = 0;
  let skipped = 0;
  const categories: Array<{ id: string; name: string; formType: string }> = [];

  for (const cat of STANDARD_TAX_CATEGORIES) {
    // Check if category already exists
    const existing = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.name, cat.name))
      .limit(1);

    if (existing.length > 0) {
      // Already exists, skip but include in returned list
      skipped++;
      categories.push({
        id: existing[0].id,
        name: existing[0].name,
        formType: existing[0].formType,
      });
    } else {
      // Create new category
      const id = nanoid();
      await db.insert(taxCategories).values({
        id,
        name: cat.name,
        description: cat.description,
        formType: cat.formType,
        lineNumber: cat.lineNumber,
        category: cat.category,
        deductible: cat.deductible,
        sortOrder: categories.length,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      created++;
      categories.push({
        id,
        name: cat.name,
        formType: cat.formType,
      });
    }
  }

  return { created, skipped, categories };
}

/**
 * Get all tax categories from the database
 */
export async function getAllTaxCategories(): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    formType: string;
    lineNumber: string | null;
    category: string;
    deductible: boolean | null;
    isActive: boolean | null;
  }>
> {
  return db
    .select()
    .from(taxCategories)
    .where(eq(taxCategories.isActive, true))
    .orderBy(taxCategories.formType, taxCategories.sortOrder);
}


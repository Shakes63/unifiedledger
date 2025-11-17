# Test Data Generator

This script generates comprehensive, realistic test data for the Unified Ledger application covering all data types for 2 households.

## Usage

```bash
pnpm generate-test-data
```

## What Gets Generated

### Household 1: "Smith Family"
- **5 Accounts**: Primary Checking, Emergency Savings, Chase Credit Card, Investment Account, Cash
- **22 Categories**: Income (3), Variable Expenses (6), Monthly Bills (6), Savings (3), Debt (2)
- **10 Merchants**: Whole Foods, Shell, Starbucks, Amazon, Target, CVS, Netflix, Spotify, Apple Store, Home Depot
- **~180 Transactions**: Income, expenses, transfers, splits (last 6 months)
- **12 Bills**: Monthly (9), Quarterly (1), Annual (2) with instances
- **3 Savings Goals**: Emergency Fund, Vacation, Car Down Payment (with milestones)
- **2 Debts**: Credit Card, Car Loan (with payments and milestones)
- **5 Tags**: Business, Tax Deductible, Reimbursable, Personal, Recurring
- **3 Custom Fields**: Receipt Number, Mileage, Project Code
- **2 Categorization Rules**: Auto-categorization rules
- **2 Transaction Templates**: Weekly Grocery Shopping, Monthly Salary
- **Tax Data**: Tax categories, sales tax settings
- **Notifications**: Bill due, budget warnings, low balance alerts

### Household 2: "Johnson Family"
- **3 Accounts**: Main Checking, Savings Account, Discover Credit Card
- **6 Categories**: Income (1), Variable Expenses (1), Monthly Bills (2), Savings (1), Debt (1)
- **4 Merchants**: Trader Joe's, Exxon, Chipotle, Walmart
- **~66 Transactions**: Income and expenses (last 3 months)
- **2 Bills**: Rent, Utilities (monthly with instances)
- **1 Savings Goal**: Emergency Fund (with milestones)
- **1 Debt**: Discover Credit Card (with payments and milestones)

## Key Features

### Math Accuracy
- All financial calculations use `Decimal.js` for precision
- Account balances are calculated from transactions and updated at the end
- Transfer transactions are properly balanced (out = -in)
- Split transactions sum correctly

### Realistic Data
- Transactions span 6 months (Household 1) and 3 months (Household 2)
- Bills include all frequencies: monthly, quarterly, annual
- Savings goals have milestones at 25%, 50%, 75%, 100%
- Debts have payment history and payoff milestones
- Merchants are linked to appropriate categories

### Complete Coverage
- All account types: checking, savings, credit, investment, cash
- All category types: income, variable_expense, monthly_bill, savings, debt
- All transaction types: income, expense, transfer_in, transfer_out
- Split transactions with multiple categories
- Bills with various frequencies
- Tags and custom fields attached to transactions
- Categorization rules for auto-categorization

## Data Relationships

- Transactions are linked to accounts, categories, and merchants
- Bills have instances linked to transactions (when paid)
- Savings goals track progress with milestones
- Debts track payments and payoff progress
- Tags and custom fields are attached to transactions
- Rules can auto-categorize transactions

## Account Balance Calculation

Account balances are calculated using `Decimal.js`:
1. Start with initial balance
2. Add/subtract each transaction amount
3. Update account balance in database at the end

This ensures mathematical accuracy and consistency.

## Notes

- The script creates users with IDs but they won't have Better Auth sessions
- For testing with authentication, you'll need to create actual user accounts first
- Bill instances for monthly bills in Household 1 may not be linked to transactions (they were created separately)
- All dates are relative to the current date (6 months ago for H1, 3 months ago for H2)



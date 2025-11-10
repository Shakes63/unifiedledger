For debt system
1. ✅ What-If Scenario Calculator (COMPLETED)

  Allow users to test different payment scenarios:
  - "What if I paid an extra $100/month?"
  - "What if I made a $5,000 lump sum payment?"
  - Side-by-side comparison of 3-4 different scenarios
  - Interactive slider to see real-time impact

  Implementation complete with:
  - Lump sum payment support at specific months
  - Quick scenario templates (Tax Refund, Bonus, etc.)
  - Real-time comparison with recommendations
  - Professional interest calculations
  - Fully integrated into debts page

2. ✅ Minimum Payment Warning System (COMPLETED)

  Show the true cost of only paying minimums:
  - Visual comparison: minimum only vs current plan
  - "If you only pay minimums, you'll pay $X,XXX in interest over Y years"
  - Highlight the dramatic difference between strategies

  Implementation complete with:
  - Side-by-side comparison of minimum-only vs current plan
  - Dramatic visual design with red/green color coding
  - Shows time saved, interest saved, and debt-free dates
  - Encouragement message when no extra payment is set
  - Fully integrated into debts page as collapsible section
  - Real multiplier calculations (e.g., "pay 3x more in interest")
  - Mobile-responsive layout

3. ✅ Bi-Weekly Payment Strategy (COMPLETED)

  Add payment frequency support alongside Snowball/Avalanche:
  - Bi-weekly payments (26 half-payments = 13 full payments/year)
  - Can shave 2-4 years off mortgages
  - Show savings vs monthly payments

  Implementation complete with:
  - Payment frequency toggle (Monthly/Bi-Weekly) with visual distinction
  - Accurate interest calculations for both frequencies:
    - Bi-weekly: 14-day interest periods for revolving credit
    - Bi-weekly: Annual rate ÷ 26 for installment loans
  - Automatic 13th payment effect (26 payments = 1 extra/year)
  - Per-scenario frequency selection in what-if calculator
  - "Switch to Bi-Weekly" quick template with green accent
  - Dynamic labels showing per-payment vs monthly amounts
  - Annual total display for bi-weekly scenarios
  - Settings persistence across sessions
  - Full integration with all debt APIs and calculators
  - Mobile-responsive design

4. ✅ Debt-Free Countdown (COMPLETED)

  Add motivational visualizations:
  - Large countdown timer on dashboard: "X months until debt-free"
  - Progress ring showing percentage complete
  - Milestone celebrations (25%, 50%, 75%, 100%)

  Implementation complete with:
  - Prominent widget on main dashboard (first thing users see)
  - Animated SVG progress ring with gradient colors
  - Dynamic motivational messages based on progress
  - Milestone tracking with emoji indicators (🏅🥈🥇🎉)
  - Shows months remaining, debt-free date, and total remaining balance
  - Next milestone indicator with estimated months away
  - Link to full debt management page
  - Debt-free celebration state when no active debts
  - Fully responsive design (desktop, tablet, mobile)
  - Uses actual payment history for accurate progress tracking

5. ✅ Budget Integration (COMPLETED)

  Connect debt payoff to overall budget:
  - Auto-suggest extra payment based on budget surplus
  - "You have $250 left this month - apply to debt?"
  - Show debt payments as % of income

  Implementation complete with:
  - **Budget Summary API**: Calculates income, expenses, debt payments, and surplus
  - **Surplus Suggestion API**: Shows impact of applying surplus to debt
  - **Apply Surplus API**: One-click application of surplus to extra payments
  - **Debt-to-Income Indicator**: Visual progress bar with color-coded warning levels (healthy/manageable/high)
  - **Budget Surplus Card**: Dashboard widget showing available surplus and DTI ratio
  - **Apply Surplus Modal**: Interactive modal with slider, impact preview, and before/after comparison
  - Dashboard integration with 2x2 grid layout (Monthly Spending | Accounts | Budget Surplus | Debt Countdown)
  - Real-time impact calculations using existing payoff calculator
  - Smart suggestions (80% of surplus, keeping 20% buffer)
  - Handles edge cases: no income, no debts, negative surplus
  - Color-coded indicators: Green (0-20% DTI), Amber (20-35% DTI), Red (35%+ DTI)
  - Mobile-responsive design
  - Toast notifications for success/error states

6. ✅ Payment Adherence Tracking (COMPLETED)

  Compare plan vs reality:
  - Track actual payments vs recommended strategy
  - Show if user is ahead/behind schedule
  - Recalculate projections based on actual payment history
  - Payment streak tracking for motivation

  Implementation complete with:
  - **Payment Adherence API**: Compares actual vs expected payments for last 12 months with weighted scoring
  - **Payment Streak API**: Tracks consecutive months of qualifying payments with milestone achievements
  - **Adherence Status Levels**: On Track (95-105%), Ahead (>105%), Behind (80-95%), Significantly Behind (<80%)
  - **Payment Adherence Card**: Shows overall adherence percentage, monthly breakdown, and projection impact
  - **Payment Streak Widget**: Motivational display with flame icons, progress bars, and achievement badges
  - **Streak Milestones**: 3mo (🔥), 6mo (💪), 12mo (🏆), 24mo (🥇), 36mo (💎)
  - **Projection Recalculation**: Updates debt-free date based on actual 3-month payment average
  - **Weighted Scoring**: Recent 3 months = 50%, Months 4-6 = 30%, Older = 20%
  - **Integrated on Debts Page**: Two-card layout showing adherence and streak side-by-side
  - **Color-coded indicators**: Green/Blue (good), Amber (warning), Red (alert)
  - **Handles edge cases**: No history, irregular payments, broken streaks
  - **Mobile-responsive design**: Gradient backgrounds, smooth animations, celebration states

  **Critical Bug Fixes (2025-11-09)**:
  - Fixed NULL minimum payment handling that caused NaN propagation and crashes
  - Fixed infinite loop in debt schedule calculation (loop counter was never incremented)
  - Added protection against payment ≤ interest infinite loops
  - Removed overly-conservative safeguards that blocked calculations for reasonable debt amounts
  - Now reliably handles debts up to 30 years / $1M+ without memory issues

7. ✅ Interactive Amortization Schedule (COMPLETED)

  Expand the timeline view:
  - Full amortization table (all payments, not just first 3 and last)
  - Chart showing principal vs interest over time
  - Click any month to see projected balance
  - Highlight when each debt gets paid off

  Implementation complete with:
  - **AmortizationTable Component**: Virtual scrolling for 360+ month schedules using @tanstack/react-virtual
  - **Full Payment Table**: All months displayed with Month, Payment, Principal, Interest, Balance columns
  - **Virtual Scrolling**: Smooth 60fps scrolling performance with 500px viewport
  - **Color-coded Amounts**: Principal (green), Interest (red), Balance (white), monospaced fonts
  - **Cumulative Progress**: Shows percent paid and interest % on each row
  - **Celebration Indicators**: Final payoff row with green gradient, 🎉 emoji, "PAID OFF" badge
  - **PrincipalInterestChart Component**: Stacked bar chart with balance line overlay
  - **Visual Breakdown**: Principal (green) and Interest (red) stacked bars showing payment composition
  - **Balance Line**: Blue line showing declining debt balance over time
  - **Milestone Markers**: Vertical reference lines at 25%, 50%, 75%, and 100% paid
  - **Smart Tick Formatting**: Adapts labels based on schedule length (monthly/quarterly/yearly)
  - **Summary Section**: Total principal, total interest, and total paid displayed prominently
  - **Insight Box**: Explains early payment benefits with percentage comparisons
  - **MonthDetailModal Component**: Interactive modal showing detailed breakdown for any month
  - **Payment Breakdown Pie Chart**: Visual representation of principal vs interest split
  - **Progress Ring**: Shows percent paid off with color-coded gradient
  - **Cumulative Totals**: Total paid, principal paid, interest paid through selected month
  - **Projection Info**: Months remaining, payoff date, or celebration for final payment
  - **Navigation**: Previous/Next buttons and arrow key support for seamless exploration
  - **AmortizationScheduleView Container**: Three-tab layout orchestrating all components
  - **Multi-Debt Support**: Debt selector dropdown with visual cards showing order and stats
  - **Three View Modes**: Overview (existing timeline), Full Schedule (table), Charts (visualizations)
  - **Click Interactivity**: Click any row in table or point on chart to open detail modal
  - **State Management**: Coordinated state for active debt, selected month, and view mode
  - **Integrated on Debts Page**: Collapsible section positioned after Payoff Strategy
  - **Performance Optimized**: Memoized calculations, virtual scrolling, lazy rendering
  - **Accessibility**: Keyboard navigation, ARIA labels, focus indicators
  - **Mobile Responsive**: All components work smoothly on small screens
  - **Design System Compliance**: Dark mode colors, consistent spacing, JetBrains Mono for numbers

8. ✅ Debt Reduction Chart (COMPLETED)

  Track progress over time with visual analytics:
  - Line chart showing total debt declining
  - Compare to original projection
  - Show individual debt balances stacked
  - Celebrate when lines hit zero

  Implementation complete with:
  - **API Endpoint**: `/api/debts/reduction-chart` calculates historical balances from payment records
  - **Utility Functions**: Helpers for balance calculation, projection generation, and data aggregation
  - **TotalDebtChart Component**: Recharts composed chart with projected vs actual lines and area fill
  - **IndividualDebtsChart Component**: Stacked area chart showing each debt's balance with toggleable visibility
  - **DebtReductionSummary Component**: Key metrics display (total paid, percentage complete, remaining debt, debt-free date)
  - **DebtReductionChart Container**: Main component with view mode toggle (combined/individual/both) and collapsible UI
  - **Theme Integration**: All colors use CSS variables (backgrounds, borders, text, semantic colors)
  - **Responsive Design**: Works on mobile (300px height), tablet (400px), and desktop
  - **Interactive Features**: Chart tooltips, legend click to toggle debts, month-to-month comparisons
  - **Data Processing**: Calculates 12 months historical + 24 months projection in real-time
  - **Integrated on Debts Page**: Positioned after Payment Tracking section, before What-If Calculator
  - **Performance Optimized**: Lazy loading, memoized calculations, efficient data structures
  - **Accessibility**: Proper ARIA labels, keyboard navigation, color contrast
  - **Empty State**: Gracefully handles users with no debts or no payment history

9. ✅ Principal vs Interest Pie Chart (COMPLETED)

  For each debt, show:
  - How much of each payment goes to principal vs interest
  - Visual comparison early vs late in loan term
  - Total interest paid vs remaining

  Implementation complete with:
  - **PaymentComparisonPieCharts Component**: Side-by-side comparison of first, midpoint, and final payments
    - Three pie charts showing payment composition at different stages
    - Percentage and dollar amount breakdowns
    - Color-coded legends with emoji indicators
    - Insight badges highlighting key points (e.g., "Most interest paid early")
    - Responsive grid layout (3 cols desktop, 2 cols tablet, 1 col mobile)
  - **TotalCostPieChart Component**: Overall cost breakdown showing true cost of borrowing
    - Large pie chart visualizing principal vs total interest
    - Interest multiplier calculation (e.g., "You'll pay 1.5x the original amount")
    - Total cost banner with payment timeline
    - Smart alerts based on interest rate (high/great/zero interest)
    - Statistics grid with detailed breakdowns
  - **PaymentBreakdownSection Container**: Orchestrates all pie chart components
    - Collapsible section (default collapsed to save space)
    - Multi-debt support with visual debt selector
    - Insight box with actionable savings tips
    - Quick action buttons linking to What-If Calculator and Payoff Strategy
    - Educational content explaining payment composition changes
  - **Theme Integration**: All colors use CSS variables for consistency
    - Uses `--color-chart-principal` (green) for principal amounts
    - Uses `--color-chart-interest` (red) for interest amounts
    - Semantic color tokens for all UI elements
    - Works seamlessly with Dark Mode and Dark Pink themes
  - **Responsive Design**: Optimized for all screen sizes
    - Mobile: Single column layout with smaller pie charts (200px height)
    - Tablet: 2-column grid for comparisons
    - Desktop: 3-column grid for comparisons, 2:1 split for total cost section
  - **Interactive Features**: Enhanced user experience
    - Hover tooltips showing detailed breakdown
    - Smooth animations on chart rendering
    - Percentage labels rendered directly on pie segments
    - Custom tooltip formatting with dollar amounts
  - **Educational Insights**: Helps users understand payment dynamics
    - Key insight banner explaining composition changes
    - Contextual tips based on payment stage
    - Smart savings recommendations
    - Interest multiplier warnings for high-cost debt
  - **Integrated on Debts Page**: Positioned between Payment Tracking and Debt Reduction Chart
  - **Performance Optimized**: Memoized calculations, efficient data transformations
  - **Accessibility**: ARIA labels, keyboard navigation, proper color contrast

10. ✅ Payment Frequency Options (COMPLETED)

  Support different payment schedules to match user income:
  - Weekly (52 payments/year) - Fastest debt payoff
  - Bi-weekly (26 payments/year) - 1 extra payment annually
  - Monthly (12 payments/year) - Standard schedule
  - Quarterly (4 payments/year) - For irregular income

  Implementation complete with:
  - ✅ **Database Schema**: Updated paymentFrequency enum to include all four options ('weekly', 'biweekly', 'monthly', 'quarterly')
  - ✅ **Type System**: Updated PaymentFrequency type in payoff-calculator.ts
  - ✅ **Interest Calculations** (lib/debts/payoff-calculator.ts):
    - Weekly payments: 7-day interest periods for revolving credit, annual rate ÷ 52 for installment loans
    - Bi-weekly payments: 14-day interest periods for revolving credit, annual rate ÷ 26 for installment loans
    - Monthly payments: 30.42-day average for revolving credit, annual rate ÷ 12 for installment loans
    - Quarterly payments: 91.25-day interest periods for revolving credit, annual rate ÷ 4 for installment loans
    - Accurate calculations for both revolving credit (credit cards) and installment loans (mortgages, car loans)
  - ✅ **Payments Per Year Helper**: getPaymentPeriodsPerYear() function returns correct count for each frequency
  - ✅ **Debt Settings Component** (components/debts/debt-payoff-strategy.tsx):
    - Responsive 2x2 grid layout (2 cols mobile, 4 cols desktop)
    - Color-coded frequency buttons: Weekly (green), Bi-weekly (pink), Monthly (accent), Quarterly (amber/warning)
    - Educational helper text for each frequency explaining payments/year and payoff speed
    - Auto-saves frequency selection to user settings
  - ✅ **What-If Calculator** (components/debts/what-if-calculator.tsx):
    - Updated type annotations to accept all four frequencies
    - Quick scenario templates added for Weekly and Quarterly
    - Conditional rendering: frequency buttons only show if not currently selected
    - Color-coded template buttons matching frequency theme
  - ✅ **Scenario Builder** (components/debts/scenario-builder.tsx):
    - 2x2 grid layout for frequency selection per scenario
    - All four frequencies available for each scenario
    - Consistent color coding and helper text
    - Per-scenario frequency flexibility (can compare monthly vs weekly in same comparison)
  - ✅ **API Validation** (app/api/debts/settings/route.ts):
    - Updated validation to accept all four frequency values
    - Proper error messages for invalid frequencies
    - Settings persistence for all frequencies
  - ✅ **Payoff Calculator API** (app/api/debts/payoff-strategy/route.ts):
    - Already compatible via PaymentFrequency type
    - No changes needed - inherits from updated type system
  - ✅ **Theme Integration**: All frequency selectors use CSS variables for colors
    - Weekly: `--color-success` (green - fastest)
    - Bi-weekly: `--color-primary` (pink)
    - Monthly: `bg-accent` (standard)
    - Quarterly: `--color-warning` (amber - slower)
  - ✅ **Responsive Design**: All frequency selectors work on mobile, tablet, desktop
  - ✅ **User Education**: Helper text explains impact of each frequency
    - Weekly: "52 payments/year - Fastest payoff, ideal for weekly paychecks"
    - Bi-weekly: "26 payments/year - 1 extra payment annually accelerates payoff"
    - Monthly: "12 payments/year - Standard payment schedule"
    - Quarterly: "4 payments/year - For irregular income, slower payoff"
  - ✅ **Build Verification**: TypeScript compilation and production build successful
  - ✅ **Performance**: No degradation with weekly schedules (52+ rows/year)

11. ✅ Credit Utilization Tracking (COMPLETED)

  For credit cards specifically:
  - Track utilization % (balance ÷ limit)
  - Alert when over 30% (impacts credit score)
  - Show credit limit fields
  - Calculate total available credit

  Implementation complete with:
  - ✅ **Database Migration (0019)**: Added `creditLimit` field to debts table
  - ✅ **Schema Update**: Updated debts schema with nullable creditLimit field
  - ✅ **Utility Functions** (lib/debts/credit-utilization-utils.ts):
    - calculateUtilization() - Calculate percentage (balance ÷ limit)
    - getUtilizationLevel() - Determine health level (excellent/good/fair/poor/critical)
    - getUtilizationColor() - Get theme-aware CSS color variable
    - getUtilizationLabel() & getUtilizationEmoji() - Display helpers
    - calculateCreditStats() - Aggregate statistics across all cards
    - calculatePaymentToTarget() - Calculate payment needed to reach 30%
    - estimateCreditScoreImpact() - Rough credit score impact estimation
  - ✅ **Color-Coded Health Levels**: Excellent (0-10%), Good (10-30%), Fair (30-50%), Poor (50-75%), Critical (75%+)
  - ✅ **Debt Form Credit Limit Input** (components/debts/debt-form.tsx):
    - Conditional credit limit field (credit cards only)
    - Real-time utilization calculation with color-coded display
    - Validation: credit limit must be >= balance
    - Helper text explaining 30% rule
    - Theme-aware styling
  - ✅ **Credit Utilization API Endpoint** (app/api/debts/credit-utilization/route.ts):
    - GET endpoint returning per-card and aggregate statistics
    - Filters for active credit cards with limits set
    - Calculates utilization, available credit, payment to target
    - Provides recommendations and estimated credit score impact
    - Health score calculation (0-100)
  - ✅ **CreditUtilizationBadge Component** (components/debts/credit-utilization-badge.tsx):
    - Inline badge showing utilization with emoji indicator
    - Size variants (sm/md/lg)
    - Color-coded based on health level
    - Hover tooltip with detailed breakdown
    - Shows balance, limit, available credit, and recommendation
  - ✅ **CreditUtilizationWidget Component** (components/debts/credit-utilization-widget.tsx):
    - Dashboard widget with circular progress ring
    - Shows overall utilization percentage
    - Quick stats: available credit, cards over 30%
    - Health score progress bar
    - Links to full debt management page
    - Loading, error, and empty states
    - Conditional rendering (only shows if credit cards exist)
  - ✅ **DebtPayoffTracker Enhancement** (components/debts/debt-payoff-tracker.tsx):
    - Credit utilization badge in card header (for credit cards)
    - Collapsible "Credit Utilization" section
    - Visual utilization progress bar with 30% target marker
    - Displays credit limit and available credit
    - Recommendation messages for high utilization
    - Payment calculator showing amount needed to reach 30%
    - Warning indicators for cards over target
  - ✅ **Dashboard Integration** (app/dashboard/page.tsx):
    - CreditUtilizationWidget added to dashboard grid
    - Positioned after Accounts card
    - Responsive grid layout (1 col mobile, 2 col tablet/desktop)
    - Auto-hides when no credit cards with limits exist
  - ✅ **Theme Integration**: All components use CSS variables for colors
    - Success/warning/error colors from theme config
    - Consistent with Dark Mode and Dark Pink themes
    - Smooth transitions and hover states
  - ✅ **Responsive Design**: All components optimized for mobile, tablet, and desktop
  - ✅ **Accessibility**: Proper ARIA labels, keyboard navigation, color contrast

12. ✅ Collapsible Debt Cards (COMPLETED)

  When you have many debts:
  - Expand/collapse individual debts
  - "Show payment history" accordion
  - "Show amortization schedule" accordion
  - Keeps UI clean but data accessible

  Implementation complete with:
  - ✅ **Implementation Plan**: Comprehensive 10-step plan documented (docs/collapsible-debt-cards-plan.md)
  - ✅ **PaymentHistoryList Component** (components/debts/payment-history-list.tsx):
    - Fetches and displays all payments for a debt
    - Reverse chronological order with date formatting
    - Shows principal/interest split when available
    - Highlights large payments (>$500 or >3x average)
    - "Show All" toggle for long histories (initially shows 5)
    - Empty state, loading skeleton, error handling
    - Total payments summary
    - Relative time display using date-fns
    - Theme integration with CSS variables
  - ✅ **DebtAmortizationSection Component** (components/debts/debt-amortization-section.tsx):
    - Wrapper for AmortizationScheduleView (single debt view)
    - Fetches and filters payoff strategy for specific debt
    - Loading state with spinner animation
    - Error handling with helpful messages
    - Hides for debts with 0% interest
    - Integrates with debt settings (extra payments, frequency)
  - ✅ **Collapsible Main Card** (components/debts/debt-payoff-tracker.tsx):
    - Click header to expand/collapse entire debt card
    - Collapsed shows: name, creditor, balance, quick stats
    - Expanded shows: full details, payment form, milestones, history, amortization
    - Smooth CSS transitions (300ms duration)
    - Chevron icon with rotation animation
  - ✅ **Payment History Accordion**:
    - Integrated into DebtPayoffTracker
    - Toggle button with History icon
    - Fetches payment data on demand (lazy loading)
    - Shows all payment details in chronological order
  - ✅ **Amortization Schedule Accordion**:
    - Integrated into DebtPayoffTracker
    - Toggle button with BarChart3 icon
    - Only shown for debts with interest > 0
    - Full three-tab view (Overview, Schedule, Charts)
  - ✅ **Expand/Collapse All Controls** (app/dashboard/debts/page.tsx):
    - "Expand All" / "Collapse All" buttons above debt list
    - Only shown when 2+ debts exist
    - Debt count indicator
    - Default state: all debts collapsed for clean UI
  - ✅ **localStorage Persistence** (lib/hooks/use-debt-expansion.ts):
    - Custom useDebtExpansion hook
    - Saves user preference per debt
    - Respects Expand All/Collapse All overrides
    - Handles client-side hydration properly
  - ✅ **Smooth Animations**: CSS transitions for all expand/collapse actions
  - ✅ **Theme Integration**: All colors use CSS variables
  - ✅ **Responsive Design**: Works on mobile, tablet, desktop
  - ✅ **Accessibility**: Proper click event handling, stopPropagation for nested buttons
  - ✅ **Performance**: Lazy loading of payment history and amortization data

13. ✅ Settings Section & Theme Chooser (COMPLETED)

  Reorganize navigation and add theme management:
  - New "Settings" section in sidebar
  - Move Categories, Merchants, Rules, Notifications to Settings
  - Add Theme settings page with current theme display
  - Theme preference persistence via API
  - Color palette preview for each theme
  - Theme selector with available/coming soon status

  Implementation complete with:
  - **Sidebar Reorganization**: New Settings section created, items moved from Tools
  - **Theme Configuration System**: Centralized theme definitions with ThemeColors interface
  - **Theme Page**: Full color palette display showing all 13 colors (backgrounds, transactions, UI, text)
  - **Theme Persistence API**: GET/PUT endpoints at `/api/user/settings/theme`
  - **Theme Selector**: Interactive cards with click-to-select, Active/Coming Soon badges
  - **Color Previews**: Visual circles showing income/expense/transfer/primary colors
  - **Database Schema**: Added `theme` field to `userSettings` table (migration 0018)
  - **Theme Utilities**: Helper functions for theme validation and management
  - **Auto-creation**: API creates user settings record if it doesn't exist
  - **Toast Notifications**: Success/error feedback for theme changes
  - **Locked Themes**: Coming soon themes are visible but disabled with lock icon
  - **Mobile Responsive**: All components work on small screens
  - **Dark Mode Styling**: Consistent with existing design system

14. Theme chooser on settings page - ✅ COMPLETED (see #13 above)

15. New theme that is elegant an girly with pink and turquoise and other colors that work well with those colors. it should be colorful and fun and elegant

  Status: ✅ COMPLETED
  - Theme defined in configuration as "Dark Pink Theme"
  - Available on theme page
  - Full color palette implemented with pink accents
  - Deep aubergine backgrounds with turquoise, pink, and purple accents

16. ✅ Page Reorganization & UX Improvements (COMPLETED)

  Reorganize debts and reports pages for better information hierarchy:
  - Move debt cards above analysis sections on debts page
  - Consolidate advanced debt visualizations in reports page
  - Make payment tracking collapsible to reduce clutter
  - Reorder sections by priority and user workflow

  Implementation complete with:
  - **Debts Page Reorganization**:
    - Debt cards moved to top (immediately after filters) for quick access
    - Payoff Strategy section moved up in priority (position 6)
    - Payment Tracking (Adherence & Streak) now in collapsible section with 📊 icon
    - What-If Calculator remains accessible as collapsible section
    - Minimum Payment Warning moved to bottom as cautionary analysis
    - Improved flow: View debts → Choose strategy → Track payments → Analyze scenarios → Review warnings

  - **Reports Page Enhancement**:
    - New "Debt Analysis" section added to reports page
    - **Payment Breakdown Analysis** (📊): Principal vs Interest pie charts moved from debts page
    - **Debt Reduction Progress** (📉): Historical + projected charts moved from debts page
    - **Interactive Amortization Schedule** (📈): Full schedule view moved from debts page
    - All three sections collapsible for clean presentation
    - Debt analysis only appears when active debts with payoff strategy exist
    - Seamlessly integrated with existing financial reports

  - **UX Benefits**:
    - Reduced cognitive load on debts page (focused on action items)
    - Advanced analysis consolidated in reports (comprehensive view)
    - All sections collapsible by default for clean UI
    - Better separation of concerns: Debts = Action, Reports = Analysis
    - Consistent collapsible pattern across both pages
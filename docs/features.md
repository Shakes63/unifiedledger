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

8. Debt Reduction Chart

  Track progress over time:
  - Line chart showing total debt declining
  - Compare to original projection
  - Show individual debt balances stacked
  - Celebrate when lines hit zero

9. Principal vs Interest Pie Chart

  For each debt, show:
  - How much of each payment goes to principal vs interest
  - Visual comparison early vs late in loan term
  - Total interest paid vs remaining

10. Payment Frequency Options

  Support different payment schedules:
  - Weekly, bi-weekly, monthly, quarterly
  - Some people get paid bi-weekly and want to match
  - Adjust interest calculations accordingly

11. Credit Utilization Tracking

  For credit cards specifically:
  - Track utilization % (balance ÷ limit)
  - Alert when over 30% (impacts credit score)
  - Show credit limit fields
  - Calculate total available credit

12. Collapsible Debt Cards

  When you have many debts:
  - Expand/collapse individual debts
  - "Show payment history" accordion
  - "Show amortization schedule" accordion
  - Keeps UI clean but data accessible

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
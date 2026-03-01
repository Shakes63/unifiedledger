import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Wallet,
  PieChart,
  Receipt,
  Target,
  BarChart3,
} from 'lucide-react';
import { isFirstUser } from '@/lib/auth/owner-helpers';
import { Instrument_Serif, Outfit } from 'next/font/google';

const displayFont = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const bodyFont = Outfit({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect('/dashboard');
  }

  const firstUser = await isFirstUser();
  if (firstUser) {
    redirect('/sign-up?firstSetup=true');
  }

  return (
    <div
      className={`${displayFont.variable} ${bodyFont.variable} landing-page`}
      style={{ fontFamily: 'var(--font-body, var(--font-sans))' }}
    >
      <div className="landing-grain" />
      <div className="landing-ambient" />

      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-30 border-b border-white/6 backdrop-blur-xl"
        style={{ backgroundColor: 'oklch(0.14 0 0 / 0.72)' }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <Image
                src="/logo.png"
                alt="Unified Ledger"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Unified Ledger
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="px-5 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-white/90 transition-all"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative z-10 min-h-[85vh] flex items-center">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 w-full py-20 lg:py-0">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <h1
                className="landing-fade-up text-5xl sm:text-6xl lg:text-7xl leading-[1.08] tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Your finances,
                <br />
                <em className="landing-hero-gradient not-italic">unified.</em>
              </h1>

              <p
                className="landing-fade-up mt-7 text-lg sm:text-xl text-white/45 max-w-lg leading-relaxed mx-auto lg:mx-0"
                style={{ animationDelay: '120ms' }}
              >
                Track every dollar, crush your budgets, eliminate debt,
                and build real wealth&mdash;all from one focused command center.
              </p>

              <div
                className="landing-fade-up mt-10 flex flex-wrap gap-4 justify-center lg:justify-start"
                style={{ animationDelay: '240ms' }}
              >
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center gap-2 px-7 py-3.5 font-medium rounded-full text-base hover:opacity-90 transition-all"
                  style={{ backgroundColor: 'oklch(0.696 0.149 162.48)', color: 'oklch(0 0 0)' }}
                >
                  Start for free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center px-7 py-3.5 border border-white/10 text-white/60 rounded-full text-base hover:bg-white/4 hover:border-white/15 hover:text-white transition-all"
                >
                  Sign in
                </Link>
              </div>

              {/* Mobile decorative accent */}
              <div className="lg:hidden mt-14 flex justify-center">
                <svg className="w-72 h-12 opacity-25" viewBox="0 0 240 32" fill="none">
                  <path
                    d="M0 28 Q40 22,70 24 T140 14 T200 8 T240 4"
                    stroke="oklch(0.70 0.15 162)"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M0 28 Q40 22,70 24 T140 14 T200 8 T240 4 V32 H0Z"
                    fill="url(#mobileGrad)"
                    opacity="0.2"
                  />
                  <defs>
                    <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.70 0.15 162)" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Floating dashboard cards (desktop) */}
            <div className="relative hidden lg:block h-[480px]">
              {/* Background glow */}
              <div
                className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full"
                style={{
                  background: 'radial-gradient(circle, oklch(0.32 0.11 162 / 0.35) 0%, transparent 70%)',
                  animation: 'landing-glow-pulse 5s ease-in-out infinite',
                }}
              />

              {/* Card 1 — Balance */}
              <div
                className="absolute top-6 left-4 w-72 rounded-2xl border border-white/8 p-5 shadow-2xl"
                style={{
                  backgroundColor: 'oklch(0.17 0.005 0 / 0.85)',
                  backdropFilter: 'blur(20px)',
                  animation: 'landing-float-1 6s ease-in-out infinite',
                }}
              >
                <div className="text-[11px] text-white/35 font-medium tracking-widest uppercase">
                  Total Balance
                </div>
                <div
                  className="mt-2 text-[2rem] font-semibold tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  $24,850<span className="text-white/25">.00</span>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                  <span style={{ color: 'oklch(0.75 0.15 145)' }}>&#8593;&thinsp;12.4%</span>
                  <span className="text-white/20">vs last month</span>
                </div>
                <svg className="mt-3 w-full h-8" viewBox="0 0 200 28" fill="none">
                  <path
                    d="M0 24 Q25 20,48 22 T96 14 T144 9 T200 4"
                    stroke="oklch(0.65 0.14 162 / 0.5)"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M0 24 Q25 20,48 22 T96 14 T144 9 T200 4 V28 H0Z"
                    fill="url(#heroTrendGrad)"
                    opacity="0.12"
                  />
                  <defs>
                    <linearGradient id="heroTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.14 162)" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Card 2 — Budget ring */}
              <div
                className="absolute top-44 right-0 w-56 rounded-2xl border border-white/8 p-5 shadow-2xl"
                style={{
                  backgroundColor: 'oklch(0.17 0.005 0 / 0.85)',
                  backdropFilter: 'blur(20px)',
                  animation: 'landing-float-2 7s ease-in-out infinite',
                }}
              >
                <div className="text-[11px] text-white/35 font-medium tracking-widest uppercase">
                  Monthly Budget
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <svg className="w-14 h-14 -rotate-90 shrink-0" viewBox="0 0 44 44">
                    <circle
                      cx="22" cy="22" r="18"
                      fill="none"
                      stroke="oklch(0.22 0 0)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="22" cy="22" r="18"
                      fill="none"
                      stroke="oklch(0.65 0.13 250)"
                      strokeWidth="3"
                      strokeDasharray={`${0.68 * 2 * Math.PI * 18} ${2 * Math.PI * 18}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div>
                    <div
                      className="text-2xl font-semibold text-white"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      68%
                    </div>
                    <div className="text-xs text-white/25">$2,720 left</div>
                  </div>
                </div>
              </div>

              {/* Card 3 — Income */}
              <div
                className="absolute bottom-10 left-14 w-52 rounded-2xl border border-white/8 p-4 shadow-2xl"
                style={{
                  backgroundColor: 'oklch(0.17 0.005 0 / 0.85)',
                  backdropFilter: 'blur(20px)',
                  animation: 'landing-float-3 5s ease-in-out infinite',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-white/35 font-medium tracking-widest uppercase">
                    Income
                  </div>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                    style={{
                      backgroundColor: 'oklch(0.70 0.15 145 / 0.12)',
                      color: 'oklch(0.75 0.15 145)',
                    }}
                  >
                    &#8593;
                  </div>
                </div>
                <div
                  className="mt-2 text-xl font-semibold"
                  style={{ fontFamily: 'var(--font-body)', color: 'oklch(0.75 0.15 145)' }}
                >
                  +$5,200
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Capability strip ─── */}
      <section
        className="relative z-10 border-y border-white/6"
        style={{ backgroundColor: 'oklch(1 0 0 / 0.015)' }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 text-[13px] text-white/28">
            {[
              'Transactions',
              'Budgets',
              'Bills',
              'Savings Goals',
              'Debt Payoff',
              'Reports',
              'Calendar',
              'Tax',
              'Households',
            ].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'oklch(0.65 0.12 162 / 0.5)' }}
                />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16 sm:mb-20">
            <h2
              className="landing-fade-up text-3xl sm:text-4xl lg:text-5xl tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Everything you need.
              <br />
              <span className="text-white/25">Nothing you don&apos;t.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Transactions — col-span-2 */}
            <div className="landing-feature-card md:col-span-2 group">
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 25% 50%, oklch(0.22 0.08 162 / 0.18) 0%, transparent 60%)' }}
              />
              <div className="relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: 'oklch(0.70 0.15 162 / 0.10)' }}
                >
                  <Wallet className="w-5 h-5" style={{ color: 'oklch(0.75 0.14 162)' }} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Transactions</h3>
                <p className="text-white/38 leading-relaxed max-w-md">
                  Log income, expenses, and transfers with smart categorization,
                  merchant tracking, powerful search, and CSV import.
                </p>
              </div>
              {/* Decorative ledger lines */}
              <svg
                className="absolute bottom-5 right-6 w-28 h-16 opacity-[0.06] pointer-events-none"
                viewBox="0 0 100 50"
              >
                <line x1="0" y1="10" x2="90" y2="10" stroke="white" strokeWidth="1" />
                <line x1="0" y1="22" x2="70" y2="22" stroke="white" strokeWidth="1" />
                <line x1="0" y1="34" x2="85" y2="34" stroke="white" strokeWidth="1" />
                <line x1="0" y1="46" x2="55" y2="46" stroke="white" strokeWidth="1" />
              </svg>
            </div>

            {/* Budgets */}
            <div className="landing-feature-card group">
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 50% 50%, oklch(0.20 0.07 250 / 0.18) 0%, transparent 60%)' }}
              />
              <div className="relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: 'oklch(0.65 0.13 250 / 0.10)' }}
                >
                  <PieChart className="w-5 h-5" style={{ color: 'oklch(0.72 0.13 250)' }} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Budgets</h3>
                <p className="text-white/38 leading-relaxed">
                  Set limits by category and see exactly where you stand, in real time.
                </p>
              </div>
              {/* Decorative arc */}
              <svg
                className="absolute bottom-4 right-5 w-16 h-16 opacity-[0.06] pointer-events-none"
                viewBox="0 0 60 60"
              >
                <circle cx="60" cy="60" r="40" fill="none" stroke="white" strokeWidth="1.5" />
                <circle cx="60" cy="60" r="28" fill="none" stroke="white" strokeWidth="1" />
              </svg>
            </div>

            {/* Bills */}
            <div className="landing-feature-card group">
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 50% 50%, oklch(0.22 0.08 55 / 0.15) 0%, transparent 60%)' }}
              />
              <div className="relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: 'oklch(0.75 0.14 55 / 0.10)' }}
                >
                  <Receipt className="w-5 h-5" style={{ color: 'oklch(0.80 0.13 55)' }} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Bills &amp; Recurring</h3>
                <p className="text-white/38 leading-relaxed">
                  Never miss a payment. Annual planning keeps you ahead of every due date.
                </p>
              </div>
              {/* Decorative calendar dots */}
              <svg
                className="absolute bottom-4 right-5 w-14 h-14 opacity-[0.06] pointer-events-none"
                viewBox="0 0 50 50"
              >
                {[0, 1, 2, 3].map((row) =>
                  [0, 1, 2, 3].map((col) => (
                    <circle
                      key={`${row}-${col}`}
                      cx={8 + col * 12}
                      cy={8 + row * 12}
                      r="2"
                      fill="white"
                    />
                  ))
                )}
              </svg>
            </div>

            {/* Goals & Debt — col-span-2 */}
            <div className="landing-feature-card md:col-span-2 group">
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 70% 50%, oklch(0.20 0.08 145 / 0.18) 0%, transparent 60%)' }}
              />
              <div className="relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: 'oklch(0.70 0.14 145 / 0.10)' }}
                >
                  <Target className="w-5 h-5" style={{ color: 'oklch(0.75 0.14 145)' }} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Goals &amp; Debt Payoff</h3>
                <p className="text-white/38 leading-relaxed max-w-md">
                  Set savings targets and build debt payoff scenarios.
                  Visualize your path to financial freedom with interactive timelines.
                </p>
              </div>
              {/* Decorative ascending steps */}
              <svg
                className="absolute bottom-5 right-6 w-24 h-14 opacity-[0.06] pointer-events-none"
                viewBox="0 0 80 45"
              >
                <rect x="0" y="35" width="12" height="10" fill="white" rx="1" />
                <rect x="18" y="26" width="12" height="19" fill="white" rx="1" />
                <rect x="36" y="17" width="12" height="28" fill="white" rx="1" />
                <rect x="54" y="6" width="12" height="39" fill="white" rx="1" />
              </svg>
            </div>

            {/* Reports — full width */}
            <div className="landing-feature-card md:col-span-3 group">
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 50% 50%, oklch(0.18 0.06 300 / 0.12) 0%, transparent 50%)' }}
              />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'oklch(0.68 0.12 300 / 0.10)' }}
                >
                  <BarChart3 className="w-5 h-5" style={{ color: 'oklch(0.72 0.12 300)' }} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Reports &amp; Insights</h3>
                  <p className="text-white/38 leading-relaxed">
                    Spending trends, category breakdowns, tax summaries, and deep analytics. Know your numbers.
                  </p>
                </div>
              </div>
              {/* Decorative bar chart */}
              <svg
                className="absolute bottom-4 right-6 w-20 h-12 opacity-[0.06] pointer-events-none hidden sm:block"
                viewBox="0 0 70 40"
              >
                <rect x="2" y="22" width="8" height="18" fill="white" rx="1" />
                <rect x="14" y="10" width="8" height="30" fill="white" rx="1" />
                <rect x="26" y="16" width="8" height="24" fill="white" rx="1" />
                <rect x="38" y="6" width="8" height="34" fill="white" rx="1" />
                <rect x="50" y="14" width="8" height="26" fill="white" rx="1" />
                <rect x="62" y="2" width="8" height="38" fill="white" rx="1" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ready to take
            <br />
            <em className="landing-hero-gradient not-italic">control?</em>
          </h2>
          <p className="text-lg text-white/35 mb-10 max-w-lg mx-auto leading-relaxed">
            Start building a clearer picture of your financial life today.
          </p>
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-2.5 px-8 py-4 bg-white text-black font-medium rounded-full text-lg hover:bg-white/90 transition-all"
          >
            Get started&thinsp;&mdash;&thinsp;it&apos;s free
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-white/6 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative w-6 h-6">
              <Image src="/logo.png" alt="Unified Ledger" fill className="object-contain" />
            </div>
            <span className="text-sm text-white/20">Unified Ledger</span>
          </div>
          <p className="text-sm text-white/15">
            &copy; {new Date().getFullYear()} Unified Ledger
          </p>
        </div>
      </footer>
    </div>
  );
}

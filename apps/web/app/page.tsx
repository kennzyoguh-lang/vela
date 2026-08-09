import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  LineChart,
  Users,
  Sparkles,
  Building2,
  Store,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { VelaLogo, VelaMark } from "@/components/brand/VelaLogo";
import { Card, CardTitle } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "VELA — The Business Operating System for African SMEs",
  description:
    "Invoicing, tax compliance, payroll, banking, and a staff-proof point of sale — one system, not five disconnected tools. Built for how Nigerian SMEs actually run.",
};

const MODULES = [
  {
    icon: LayoutDashboard,
    name: "Dashboard",
    description:
      "Cash position, outstanding invoices, compliance status, and payroll — one home screen that adapts to the business running it.",
  },
  {
    icon: FileText,
    name: "SmartInvoice",
    description:
      "Invoices with automatic risk scoring, reminders, and Paystack checkout built in. Quick Sale sends a payment link by QR, SMS, or WhatsApp with no client record needed.",
  },
  {
    icon: ShieldCheck,
    name: "ComplianceRadar",
    description:
      "VAT, WHT, and CIT obligations tracked against Nigeria Tax Act 2025 rules, with filing reminders that fire before the deadline, not after.",
  },
  {
    icon: LineChart,
    name: "Money",
    description:
      "Bank sync, automatic transaction categorisation, and a real profit & loss statement — updated with every transaction, not once a month.",
  },
  {
    icon: Users,
    name: "PeopleHub",
    description:
      "Payroll runs that get 2025's six-band PAYE and Pension Reform Act contributions right automatically, with a payslip the moment it's approved.",
  },
  {
    icon: Sparkles,
    name: "Ask Vela",
    description:
      "An AI that answers from your own ledger — every figure is pulled from real org data and cited back to the record it came from.",
  },
  {
    icon: Building2,
    name: "Accountant Portal",
    description:
      "One dashboard across every client an accountant serves, with tier badges and earnings tracked from referred conversions.",
  },
  {
    icon: Store,
    name: "Point of Sale",
    description:
      "Phone + PIN login for shop staff, device-bound so a stolen PIN alone can't log in elsewhere, plus owner-only discount approval and offline sales.",
  },
];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "₦0",
    period: "forever",
    blurb: "The core experience, permanently free — not a trial.",
    features: [
      "10 invoices / month",
      "1 team member",
      "5 Ask Vela questions / month",
      "3 compliance obligations tracked",
    ],
  },
  {
    name: "Basic",
    price: "₦15,000",
    period: "/month",
    blurb: "For a small team taking on regular clients.",
    features: [
      "Unlimited invoices",
      "Up to 5 team members",
      "Full compliance tracking",
      "In-app + SMS deadline alerts",
    ],
  },
  {
    name: "Growth",
    price: "₦35,000",
    period: "/month",
    blurb: "For a business running real payroll and reconciliation.",
    features: [
      "Up to 30 team members",
      "Unlimited payroll",
      "Bank reconciliation",
      "Unlimited Ask Vela",
    ],
  },
  {
    name: "Business",
    price: "₦75,000",
    period: "/month",
    blurb: "For a growing operation with multiple accounts.",
    features: [
      "Up to 100 team members",
      "Multi-bank accounts",
      "Audit-ready reports",
      "Expense claims",
    ],
  },
  {
    name: "Enterprise",
    price: "₦150,000",
    period: "/month",
    blurb: "For larger operations running multiple entities.",
    features: ["Up to 500 team members", "Accountant portal access", "API access", "Multi-entity"],
  },
];

const AFRICA_POINTS = [
  {
    title: "Paystack, the rail people trust",
    body: "Every invoice and Quick Sale link settles through the processor Nigerian customers already use.",
  },
  {
    title: "WhatsApp & SMS, not push notifications",
    body: "Daily summaries and payment links arrive on the channels an owner actually checks between customers.",
  },
  {
    title: "Works with no signal",
    body: "Sales and cash checks log on-device when the connection drops, and sync the moment it's back.",
  },
  {
    title: "English, Igbo, Yorùbá, Hausa",
    body: "The shop floor itself — not just the marketing pages — is fully translated.",
  },
];

export default function MarketingHomePage() {
  return (
    <div className="bg-surface-canvas min-h-dvh">
      {/* Nav */}
      <header className="border-border bg-surface-raised/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="hidden dark:block">
              <VelaLogo variant="primary-dark" />
            </div>
            <div className="block dark:hidden">
              <VelaLogo variant="mono-dark" />
            </div>
          </Link>
          <nav className="flex items-center gap-6">
            <a
              href="#modules"
              className="font-ui text-text-secondary hover:text-text-primary hidden text-[0.875rem] sm:inline"
            >
              Product
            </a>
            <a
              href="#pricing"
              className="font-ui text-text-secondary hover:text-text-primary hidden text-[0.875rem] sm:inline"
            >
              Pricing
            </a>
            <a
              href="#africa"
              className="font-ui text-text-secondary hover:text-text-primary hidden text-[0.875rem] sm:inline"
            >
              Built for Africa
            </a>
            <Link
              href="/login"
              className="font-ui text-text-secondary hover:text-text-primary text-[0.875rem]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-action-primary text-action-primaryText font-ui inline-flex h-10 items-center rounded-sm px-4 text-[0.875rem] font-bold hover:brightness-95"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[860px] px-4 pb-16 pt-20 text-center md:px-6 md:pt-28">
        <p className="font-data text-gold mb-6 inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.16em]">
          <span className="bg-gold size-1.5 rounded-full" aria-hidden />
          Live product — not a prototype
        </p>
        <h1 className="font-display text-text-primary text-[2.5rem] font-normal leading-[1.15] md:text-[3.25rem]">
          The Business Operating System, built for how{" "}
          <span className="text-gold">Nigerian SMEs</span> actually run.
        </h1>
        <div className="bg-gold mx-auto mt-8 h-0.5 w-16" aria-hidden />
        <p className="font-ui text-text-secondary mx-auto mt-8 max-w-[560px] text-[1.05rem] leading-[1.7]">
          Invoicing, tax compliance, payroll, banking, and a staff-proof point of sale — one system,
          not five disconnected tools. It adapts to the business it&apos;s running, from day one.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="bg-action-primary text-action-primaryText font-ui inline-flex h-12 items-center gap-2 rounded-sm px-7 text-[0.95rem] font-bold hover:brightness-95"
          >
            Start free <ArrowRight className="size-4" aria-hidden />
          </Link>
          <a
            href="#modules"
            className="border-border text-text-primary font-ui hover:border-gold inline-flex h-12 items-center rounded-sm border px-7 text-[0.95rem] font-bold"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Problem / solution */}
      <section className="border-border border-t">
        <div className="mx-auto max-w-[860px] px-4 py-16 text-center md:px-6">
          <h2 className="font-display text-text-primary text-[1.6rem] font-normal">
            Every SME owner is already running a Business OS.{" "}
            <span className="text-gold">It&apos;s just made of five different apps.</span>
          </h2>
          <p className="font-ui text-text-secondary mx-auto mt-5 max-w-[600px] text-[1rem] leading-[1.7]">
            A notebook for sales. A calculator for tax. A WhatsApp group for staff. A banking app
            for cash flow. An accountant&apos;s spreadsheet for payroll. VELA replaces all five with
            one login, one ledger, one source of truth — for the owner, the accountant, and the
            staff on the floor.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="border-border border-t">
        <div className="mx-auto max-w-[1180px] px-4 py-16 md:px-6">
          <div className="mb-10 max-w-[560px]">
            <p className="font-data text-gold mb-3 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
              The product
            </p>
            <h2 className="font-display text-text-primary text-[1.75rem] font-normal">
              Eight modules. One ledger.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => (
              <Card accent key={mod.name} className="flex flex-col gap-3">
                <mod.icon className="text-gold size-5" aria-hidden />
                <CardTitle>{mod.name}</CardTitle>
                <p className="font-ui text-text-secondary text-[0.83rem] leading-[1.6]">
                  {mod.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-border border-t">
        <div className="mx-auto max-w-[1180px] px-4 py-16 md:px-6">
          <div className="mb-10 max-w-[560px]">
            <p className="font-data text-gold mb-3 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
              Pricing
            </p>
            <h2 className="font-display text-text-primary text-[1.75rem] font-normal">
              Free to start. Pay as the business grows.
            </h2>
            <p className="font-ui text-text-secondary mt-3 text-[0.9rem] leading-[1.65]">
              Every plan starts on the free tier — no card required. Upgrade whenever a limit
              actually gets in your way.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PRICING_TIERS.map((tier) => (
              <Card key={tier.name} accent className="flex flex-col gap-4">
                <div>
                  <CardTitle eyebrow>{tier.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-data text-text-primary text-[1.4rem] font-bold tabular-nums">
                      {tier.price}
                    </span>
                    <span className="font-ui text-text-secondary text-[0.75rem]">
                      {tier.period}
                    </span>
                  </div>
                  <p className="font-ui text-text-secondary mt-2 text-[0.8rem] leading-[1.55]">
                    {tier.blurb}
                  </p>
                </div>
                <ul className="border-border flex flex-col gap-1.5 border-t pt-3">
                  {tier.features.map((f) => (
                    <li key={f} className="font-ui text-text-primary text-[0.78rem] leading-[1.5]">
                      {f}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <p className="font-ui text-text-secondary mt-6 text-[0.8rem]">
            Running a practice, not a business? Accountant Practice pricing starts at ₦50,000/month
            across up to 15 clients.
          </p>
        </div>
      </section>

      {/* Built for Africa */}
      <section id="africa" className="border-border border-t">
        <div className="mx-auto max-w-[1180px] px-4 py-16 md:px-6">
          <div className="mb-10 max-w-[560px]">
            <p className="font-data text-gold mb-3 text-[0.7rem] font-bold uppercase tracking-[0.14em]">
              Not a US template with ₦ swapped in
            </p>
            <h2 className="font-display text-text-primary text-[1.75rem] font-normal">
              Built from the SME&apos;s actual operating conditions up.
            </h2>
          </div>
          <div className="border-border divide-border grid grid-cols-1 divide-y overflow-hidden rounded-lg border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {AFRICA_POINTS.map((point) => (
              <div key={point.title} className="bg-surface-raised p-6">
                <h3 className="font-ui text-text-primary mb-2 text-[0.92rem] font-bold">
                  {point.title}
                </h3>
                <p className="font-ui text-text-secondary text-[0.83rem] leading-[1.6]">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-border border-t">
        <div className="mx-auto max-w-[640px] px-4 py-20 text-center md:px-6">
          <h2 className="font-display text-text-primary text-[1.9rem] font-normal">
            See it for yourself.
          </h2>
          <p className="font-ui text-text-secondary mt-4 text-[1rem] leading-[1.7]">
            Create an account, click through every module, and see the same numbers, the same
            formulas, running live.
          </p>
          <Link
            href="/signup"
            className="bg-action-primary text-action-primaryText font-ui mt-8 inline-flex h-12 items-center gap-2 rounded-sm px-7 text-[0.95rem] font-bold hover:brightness-95"
          >
            Start free <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border border-t">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <VelaMark variant="primary-dark" className="hidden size-6 dark:block" />
            <VelaMark variant="mono-dark" className="block size-6 dark:hidden" />
            <span className="font-ui text-text-secondary text-[0.8rem]">
              &copy; {new Date().getFullYear()} VELA
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="font-ui text-text-secondary hover:text-text-primary text-[0.8rem]"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="font-ui text-text-secondary hover:text-text-primary text-[0.8rem]"
            >
              Privacy
            </Link>
            <Link
              href="/firs-calculator"
              className="font-ui text-text-secondary hover:text-text-primary text-[0.8rem]"
            >
              FIRS Calculator
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

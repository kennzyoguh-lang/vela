import type { LucideIcon } from "lucide-react";
import type { ModuleKey } from "@vela/types";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Users,
  LineChart,
  Sparkles,
  Building2,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Design System 3.2: five destinations max on the mobile bottom tab bar. */
  mobilePrimary: boolean;
  /**
   * Business profiling — omitted means "always visible" (Home, Money,
   * Ask Vela, Settings aren't gated by any factor). Present means the
   * Sidebar hides this item when useModuleVisibility() says false.
   */
  moduleKey?: ModuleKey;
}

// One module = one icon, used consistently in nav, page headers, and empty
// states — never restyled per context (Design System 2.8). Module pages
// themselves are Phase 2+ (SmartInvoice, ComplianceRadar, PeopleHub, P&L,
// Ask Vela) — Foundation wires the shell's nav entries only.
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: LayoutDashboard, mobilePrimary: true },
  {
    label: "Invoices",
    href: "/invoices",
    icon: FileText,
    mobilePrimary: true,
    moduleKey: "invoicing",
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: ShieldCheck,
    mobilePrimary: false,
    moduleKey: "compliance",
  },
  { label: "People", href: "/people", icon: Users, mobilePrimary: true, moduleKey: "payroll" },
  { label: "Money", href: "/money", icon: LineChart, mobilePrimary: true },
  { label: "Ask Vela", href: "/ask-vela", icon: Sparkles, mobilePrimary: true },
  {
    label: "Accountant Portal",
    href: "/accountant-portal",
    icon: Building2,
    mobilePrimary: false,
    moduleKey: "accountantPortal",
  },
  { label: "Settings", href: "/settings", icon: Settings, mobilePrimary: false },
];

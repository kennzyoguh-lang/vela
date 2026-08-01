import { AppShell } from "@/components/layout/AppShell";
import { OnboardingGate } from "@/components/layout/OnboardingGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OnboardingGate />
      <AppShell>{children}</AppShell>
    </>
  );
}

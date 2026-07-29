"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";

interface InsightFact {
  kind: string;
  priority: number;
  message: string;
}

// Mirrors ComplianceWidget.tsx's shape. Deterministic, rule-based pick from
// already-computed facts (insight.service.ts) — never an LLM call, so this
// card is free, instant, and testable the same way invoice risk scoring is.
export function AskVelaInsightWidget() {
  const { data: insight, isLoading } = useQuery({
    queryKey: ["ask-vela", "insight"],
    queryFn: () => api.get<InsightFact | null>("/v1/ask-vela/insight"),
    staleTime: 5 * 60_000,
  });

  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>Ask Vela insight</CardTitle>
          <Sparkles className="text-data-aiAccent size-4" aria-hidden />
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : (
          <p className="font-ui text-text-primary text-[0.875rem]">
            {insight?.message ?? "You're all caught up."}
          </p>
        )}
      </div>
      <Link href="/ask-vela">
        <Button variant="secondary" size="sm">
          Ask Vela
        </Button>
      </Link>
    </Card>
  );
}

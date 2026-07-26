"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/layout/AdminGuard";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { AdminUserRow, ExamType } from "@/lib/types";
import { accentForExam } from "@/lib/utils/accent";
import { cn } from "@/lib/utils/cn";

const EXAM_TYPES: ExamType[] = ["DSAT", "AP", "IELTS"];

type SortKey = "name" | ExamType | "overallScore";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown size={14} className="text-foreground-muted/50" aria-hidden="true" />;
  return dir === "asc" ? (
    <ArrowUp size={14} aria-hidden="true" />
  ) : (
    <ArrowDown size={14} aria-hidden="true" />
  );
}

function AdminDashboard() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data: AdminUserRow[]) => setUsers(data));
  }, []);

  const sorted = useMemo(() => {
    if (!users) return [];
    const rows = [...users];
    rows.sort((a, b) => {
      const av = sortKey === "name" ? a.name.toLowerCase() : sortKey === "overallScore" ? a.overallScore : (a.scores[sortKey] ?? -1);
      const bv = sortKey === "name" ? b.name.toLowerCase() : sortKey === "overallScore" ? b.overallScore : (b.scores[sortKey] ?? -1);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [users, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!users) {
    return <Spinner label="Loading user directory…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} className="text-dsat" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
        </div>
        <p className="mt-1 text-foreground-muted">
          All {users.length} users and their readiness scores, sortable by any exam.
        </p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <th className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Student <SortIcon active={sortKey === "name"} dir={sortDir} />
                </button>
              </th>
              {EXAM_TYPES.map((examType) => (
                <th key={examType} className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort(examType)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {examType} <SortIcon active={sortKey === examType} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => handleSort("overallScore")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Overall <SortIcon active={sortKey === "overallScore"} dir={sortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-5 py-3">
                  <div className="font-medium text-foreground">{row.name}</div>
                  <div className="text-xs text-foreground-muted">{row.email}</div>
                </td>
                {EXAM_TYPES.map((examType) => (
                  <td key={examType} className="px-5 py-3">
                    {row.scores[examType] !== undefined ? (
                      <Badge accent={accentForExam(examType)}>{row.scores[examType]}%</Badge>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                ))}
                <td className={cn("px-5 py-3 font-semibold text-foreground")}>{row.overallScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <PageTransition>
        <AdminDashboard />
      </PageTransition>
    </AdminGuard>
  );
}

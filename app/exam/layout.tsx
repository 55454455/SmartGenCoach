import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen flex-1 bg-background text-foreground">{children}</div>
    </AuthGuard>
  );
}

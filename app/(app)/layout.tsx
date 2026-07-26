import { AskAiWidget } from "@/components/layout/AskAiWidget";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { TopNav } from "@/components/layout/TopNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <AskAiWidget />
    </AuthGuard>
  );
}

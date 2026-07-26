import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-4 py-10">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}

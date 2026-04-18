import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(79,141,255,0.22),transparent_42%),radial-gradient(circle_at_84%_10%,rgba(110,81,145,0.18),transparent_40%)]" />
      <ThemeToggle className="absolute right-4 top-4 z-10 md:right-6 md:top-6" />
      <div className="relative w-full max-w-[430px] rounded-2xl border border-border/80 bg-card/80 p-7 shadow-[0_35px_85px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl md:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">BILSEN</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Review Automation
          </p>
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Bilkent Software Engineering Group
        </p>
      </div>
    </div>
  );
}

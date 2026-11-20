import { Outlet } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <img src="https://appdirect.com/shortcut-icon.ico" alt="" className="size-7 rounded-sm" />
            <div className="leading-tight">
              <p className="font-display text-sm tracking-wide text-foreground">NOC</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Team performance
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, TrendingUp, Upload } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/upload", label: "Upload", icon: Upload },
];

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
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-md px-3 py-1 text-xs",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}

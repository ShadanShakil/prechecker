"use client";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  FileCheck2,
  ScanLine,
  TriangleAlert,
  BarChart3,
  Users,
  Settings,
  ChevronDown,
  Focus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

type Role = "ADMIN" | "REVIEWER" | "QC_INSPECTOR" | "OPERATOR";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles?: Role[]; // if set, restrict; else everyone signed-in
};

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/artwork", label: "Pre-Print Validation", icon: FileCheck2 },
      { href: "/prints", label: "Post-Print Inspection", icon: ScanLine },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { href: "/alerts", label: "Quality Alerts", icon: TriangleAlert },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        href: "/users",
        label: "User Management",
        icon: Users,
        roles: ["ADMIN"],
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
      },
    ],
  },
];

export function Sidebar({
  user,
  onSignOut,
}: {
  user: { name: string; email: string; role: Role; roleLabel: string };
  onSignOut: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside className="qc-auth-bg sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-white/5 lg:flex">
      <div className="px-5 pt-6 pb-4">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-white shadow-lg shadow-blue-900/40 transition-transform group-hover:scale-105">
            <Focus size={20} strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-white">QC Vision</div>
            <div className="text-xs text-slate-400">Quality Control AI</div>
          </div>
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const visible = group.items.filter(
            (it) => !it.roles || it.roles.includes(user.role),
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.title} className="mb-5">
              <div className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500">
                {group.title}
              </div>
              <ul className="space-y-1">
                {visible.map((it) => {
                  const Icon = it.icon;
                  const active =
                    pathname === it.href ||
                    pathname.startsWith(it.href + "/");
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-[var(--color-brand-600)] text-white shadow-md shadow-blue-900/30"
                            : "text-slate-300 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="qc-sidebar-active"
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 32,
                            }}
                            className="absolute inset-0 rounded-lg bg-[var(--color-brand-600)]"
                            style={{ zIndex: 0 }}
                          />
                        )}
                        <span className="relative z-[1] flex items-center gap-3">
                          <Icon size={17} className="flex-none" />
                          {it.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 bg-black/20 p-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-brand-600)] text-sm font-semibold text-white">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || user.email[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">
                {user.name || user.email}
              </div>
              <div className="truncate text-xs text-slate-400">
                {user.roleLabel}
              </div>
            </div>
            <ChevronDown
              size={16}
              className="flex-none text-slate-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-2 space-y-1 rounded-lg bg-black/30 p-2 text-xs text-slate-300">
            <div className="px-2 py-1 text-slate-400">Signed in as</div>
            <div className="truncate px-2 pb-2 text-slate-200">
              {user.email}
            </div>
            <div className="px-1">{onSignOut}</div>
          </div>
        </details>
      </div>
    </aside>
  );
}

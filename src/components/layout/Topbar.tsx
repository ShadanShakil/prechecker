"use client";
import { Bell, LogOut, Menu } from "lucide-react";
import Link from "next/link";

export function Topbar({
  unreadCount,
  onSignOut,
}: {
  unreadCount: number;
  onSignOut: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/alerts"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 inline-flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </Link>

        <div className="hidden h-8 w-px bg-slate-200 sm:block" />

        <span className="inline-flex">{onSignOut}</span>
      </div>
    </header>
  );
}

export function SignOutButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
    >
      <LogOut size={15} />
      {children}
    </button>
  );
}

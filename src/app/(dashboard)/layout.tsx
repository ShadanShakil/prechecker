import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold">
              Carton QC
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/artwork" className="text-slate-700 hover:text-slate-900">
                Artwork
              </Link>
              <Link href="/prints" className="text-slate-700 hover:text-slate-900">
                Prints
              </Link>
              <Link href="/alerts" className="text-slate-700 hover:text-slate-900">
                Alerts
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {session.user.name ?? session.user.email}{" "}
              <span className="text-xs text-slate-400">({ROLE_LABELS[role]})</span>
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { SignOutButton, Topbar } from "@/components/layout/Topbar";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, role, email, name } = session.user;
  const unreadCount = await prisma.notification.count({
    where: { userId: id, read: false },
  });

  const signOutForm = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
      className="inline"
    >
      <SignOutButton>Sign Out</SignOutButton>
    </form>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        user={{
          name: name ?? email ?? "",
          email: email ?? "",
          role,
          roleLabel: ROLE_LABELS[role],
        }}
        onSignOut={signOutForm}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar unreadCount={unreadCount} onSignOut={signOutForm} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

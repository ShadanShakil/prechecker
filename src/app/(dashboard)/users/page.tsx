import { redirect } from "next/navigation";
import { Users, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_MANAGE_USERS, hasRole, ROLE_LABELS } from "@/lib/roles";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MotionPage,
  MotionStagger,
  MotionItem,
} from "@/components/ui/MotionPage";
import { StatCard } from "@/components/ui/StatCard";
import { Callout } from "@/components/ui/Callout";

const ROLE_TONE: Record<
  string,
  "brand" | "warning" | "success" | "danger" | "info" | "purple" | "neutral"
> = {
  ADMIN: "purple",
  REVIEWER: "brand",
  QC_INSPECTOR: "info",
  OPERATOR: "neutral",
};

export default async function UsersPage() {
  const session = await auth();
  if (!hasRole(session?.user.role, CAN_MANAGE_USERS)) {
    redirect("/dashboard");
  }
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const initials = (name: string | null, email: string) =>
    (name ?? email)
      .split(/[\s@.]/)
      .filter(Boolean)
      .map((s) => s[0]!)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <MotionPage>
      <PageHeader
        title="User Management"
        subtitle="Read-only directory of seeded employees and their roles."
      />

      <MotionStagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MotionItem>
          <StatCard
            value={users.length}
            label="Employees"
            hint="Total users on platform"
            icon={<Users size={18} />}
            iconTone="brand"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={counts.ADMIN ?? 0}
            label="Administrators"
            hint="Full platform access"
            icon={<ShieldCheck size={18} />}
            iconTone="purple"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={(counts.QC_INSPECTOR ?? 0) + (counts.OPERATOR ?? 0)}
            label="Production Team"
            hint="Operators & QC inspectors"
            icon={<Users size={18} />}
            iconTone="success"
          />
        </MotionItem>
        <MotionItem>
          <StatCard
            value={counts.REVIEWER ?? 0}
            label="Reviewers"
            hint="Artwork approval power"
            icon={<Users size={18} />}
            iconTone="warning"
          />
        </MotionItem>
      </MotionStagger>

      <Callout title="Read-only directory" tone="info">
        User add, import, role assignment, and permission management are not
        yet implemented. The accounts shown below were seeded by{" "}
        <code className="rounded bg-white px-1 font-mono">
          pnpm db:seed
        </code>
        .
      </Callout>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            All users
          </h2>
          <span className="text-xs text-slate-500">
            {users.length} record{users.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Employee</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-xs font-semibold text-white">
                        {initials(u.name, u.email)}
                      </div>
                      <div className="font-medium text-slate-900">
                        {u.name ?? "—"}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">
                    {u.email}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={ROLE_TONE[u.role] ?? "neutral"}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {u.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </MotionPage>
  );
}

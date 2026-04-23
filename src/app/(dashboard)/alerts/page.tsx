import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAN_ACK_ALERTS, hasRole } from "@/lib/roles";
import AckButton from "./ack-client";

export default async function AlertsPage() {
  const session = await auth();
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      printJob: { include: { artwork: { select: { id: true, title: true } } } },
      acknowledgedBy: { select: { name: true, email: true } },
    },
    take: 200,
  });
  const canAck = hasRole(session?.user.role, CAN_ACK_ALERTS);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Severity</th>
              <th className="px-4 py-2 text-left">Message</th>
              <th className="px-4 py-2 text-left">Print</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2 font-medium">{a.severity}</td>
                <td className="px-4 py-2">{a.message}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/prints/${a.printJob.id}`}
                    className="underline"
                  >
                    {a.printJob.artwork.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-4 py-2">
                  {a.acknowledgedAt ? (
                    <span className="text-xs text-emerald-700">
                      acked by {a.acknowledgedBy?.name ?? a.acknowledgedBy?.email}
                    </span>
                  ) : (
                    <span className="text-xs text-red-700">open</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!a.acknowledgedAt && canAck && <AckButton id={a.id} />}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No alerts. Everything looks good.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

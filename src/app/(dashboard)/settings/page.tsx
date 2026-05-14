import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { MotionPage } from "@/components/ui/MotionPage";
import { Callout } from "@/components/ui/Callout";
import { auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;
  return (
    <MotionPage>
      <PageHeader
        title="Settings"
        subtitle="Account information and platform details"
      />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Account
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="Name">{session.user.name ?? "—"}</Row>
          <Row label="Email">
            <span className="font-mono text-xs">{session.user.email}</span>
          </Row>
          <Row label="Role">
            <Badge tone="brand">{ROLE_LABELS[session.user.role]}</Badge>
          </Row>
        </dl>
      </Card>

      <Callout title="More settings coming soon" tone="info">
        Theme, language preferences, notification routing, and SMTP
        configuration will be configurable here in a future release.
      </Callout>
    </MotionPage>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}

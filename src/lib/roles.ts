import type { Role } from "@prisma/client";

export const ROLES = {
  ADMIN: "ADMIN",
  REVIEWER: "REVIEWER",
  QC_INSPECTOR: "QC_INSPECTOR",
  OPERATOR: "OPERATOR",
} as const satisfies Record<Role, Role>;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  REVIEWER: "Artwork Reviewer",
  QC_INSPECTOR: "QC Inspector",
  OPERATOR: "Operator",
};

/** Role(s) that can upload artwork (Stage 1 intake). */
export const CAN_UPLOAD_ARTWORK: Role[] = ["OPERATOR", "REVIEWER", "ADMIN"];
/** Role(s) that can approve/reject artwork. */
export const CAN_REVIEW_ARTWORK: Role[] = ["REVIEWER", "ADMIN"];
/** Role(s) that can upload printed-carton photos (Stage 2). */
export const CAN_UPLOAD_PRINT: Role[] = ["QC_INSPECTOR", "ADMIN"];
/** Role(s) that can acknowledge alerts. */
export const CAN_ACK_ALERTS: Role[] = ["ADMIN", "QC_INSPECTOR"];
/** Role(s) that can manage users. */
export const CAN_MANAGE_USERS: Role[] = ["ADMIN"];

export function hasRole(role: Role | undefined | null, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

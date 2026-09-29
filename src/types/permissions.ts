import { z } from "zod";

export const PermissionScopeEnum = z.enum([
  "p2p:read",
  "p2p:write",
  "p2p:admin",
  "sme:read",
  "sme:write",
  "sme:admin",
  "international:read",
  "international:write",
  "salary:read",
  "salary:write",
  "gateway:read",
  "gateway:write",
  "gateway:admin",
  "enterprise:read",
  "enterprise:write",
  "enterprise:admin",
  "savings:read",
  "savings:write",
  "lending:read",
  "lending:write",
  "bills:read",
  "bills:write",
  "payroll:read",
  "payroll:write",
  "government:read",
  "government:write",
  "investment:read",
  "investment:write",
]);

export type PermissionScope = z.infer<typeof PermissionScopeEnum>;

export const PermissionsArraySchema = z.array(PermissionScopeEnum);

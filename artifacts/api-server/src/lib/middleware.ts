import { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME } from "./auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Express 5 types route params as `string | string[]` (repeatable params).
 * No route here declares a repeatable param, so normalize to a single string.
 */
export function param(req: Request, name: string): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    username: string;
    role: string;
    permissions: string[];
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = await verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // The token only proves identity. Role and permissions are re-read from the
  // database on every request, so deactivations, demotions and permission
  // revocations take effect immediately instead of when the 7-day token expires.
  const rows = await db
    .select({
      isActive: usersTable.isActive,
      username: usersTable.username,
      role: usersTable.role,
      permissions: usersTable.permissions,
    })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);
  if (!rows[0] || !rows[0].isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.auth = {
    userId: payload.userId,
    username: rows[0].username,
    role: rows[0].role,
    permissions: rows[0].permissions ?? [],
  };
  next();
}

export function isPrivileged(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!isPrivileged(req.auth?.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.auth?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (isPrivileged(req.auth?.role)) { next(); return; }
    if (!req.auth?.permissions?.includes(permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (isPrivileged(req.auth?.role)) { next(); return; }
    if (permissions.some(p => req.auth?.permissions?.includes(p))) {
      next(); return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}

import { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME } from "./auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  // Verify the user still exists and is active (catches deactivations within token lifetime)
  const rows = await db
    .select({ isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);
  if (!rows[0] || !rows[0].isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.auth = payload;
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

import { Router, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { requireAdmin, param, type AuthRequest } from "../lib/middleware";

const router = Router();

function requireSuperAdmin(req: AuthRequest, res: Response, next: Function) {
  if (req.auth!.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admin can perform this action" });
    return;
  }
  next();
}

const SELECTED_FIELDS = {
  id: usersTable.id,
  username: usersTable.username,
  role: usersTable.role,
  isActive: usersTable.isActive,
  commissionRate: usersTable.commissionRate,
  permissions: usersTable.permissions,
  createdAt: usersTable.createdAt,
} as const;

router.get("/users", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.select(SELECTED_FIELDS).from(usersTable).orderBy(usersTable.createdAt);
    res.json(users);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Only SUPER_ADMIN can create users
router.post("/users", requireAdmin, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, role, commissionRate, permissions } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    if (password.length < 12) {
      res.status(400).json({ error: "Password must be at least 12 characters" });
      return;
    }
    // SUPER_ADMIN cannot be assigned via API
    const safeRole = role === "ADMIN" ? "ADMIN" : "USER";
    const hashed = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      username,
      password: hashed,
      role: safeRole,
      commissionRate: String(Number(commissionRate) || 0),
      permissions: permissions || [],
    }).returning(SELECTED_FIELDS);
    res.status(201).json(user);
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Username already in use" });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const isSuperAdmin = req.auth!.role === "SUPER_ADMIN";
    const { username, role, commissionRate, isActive, permissions, password } = req.body;

    // An ADMIN may manage USER accounts and their own; only the SUPER_ADMIN
    // can touch other admin-level accounts. Without this, any admin could
    // reset the owner's password and take over the owner account.
    if (!isSuperAdmin && id !== req.auth!.userId) {
      const target = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
      if (!target[0]) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (target[0].role !== "USER") {
        res.status(403).json({ error: "Only the Super Admin can modify admin accounts" });
        return;
      }
    }

    if (password !== undefined && password !== "" && password.length < 12) {
      res.status(400).json({ error: "Password must be at least 12 characters" });
      return;
    }

    // Non-super-admins cannot change roles or permissions
    if (!isSuperAdmin && (role !== undefined || permissions !== undefined)) {
      res.status(403).json({ error: "Only Super Admin can change roles or permissions" });
      return;
    }

    // Self-protection guards
    if (id === req.auth!.userId) {
      if (isActive === false) {
        res.status(400).json({ error: "You cannot deactivate your own account" });
        return;
      }
      if (role && role !== req.auth!.role) {
        res.status(400).json({ error: "You cannot change your own role" });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (username) updateData.username = username;
    if (commissionRate !== undefined) updateData.commissionRate = String(commissionRate);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password && password.length >= 12) updateData.password = await hashPassword(password);

    // Only SUPER_ADMIN can set role/permissions
    if (isSuperAdmin) {
      if (role) updateData.role = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : role === "ADMIN" ? "ADMIN" : "USER";
      if (permissions !== undefined) updateData.permissions = permissions;
    }

    const [user] = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning(SELECTED_FIELDS);

    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(user);
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Username already in use" });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Only SUPER_ADMIN can delete users
router.delete("/users/:id", requireAdmin, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    if (id === req.auth!.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const targetRows = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!targetRows[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const deleted = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (!deleted[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    const pgCode = e?.code ?? e?.cause?.code;
    if (pgCode === "23503") {
      res.status(409).json({ error: "This user has created orders or customers and cannot be deleted. Deactivate the account instead." });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

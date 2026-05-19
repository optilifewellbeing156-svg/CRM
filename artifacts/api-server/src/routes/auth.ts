import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const ALL_PERMISSIONS = [
  "dashboard","products","purchases","customers","orders","sales-report",
  "manage-products","manage-customers","create-orders","edit-orders","delete-orders","add-purchases",
];
import { signToken, comparePassword, hashPassword, COOKIE_NAME, COOKIE_MAX_AGE } from "../lib/auth";

const router = Router();

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE * 1000,
      path: "/",
    });

    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/signup", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    if (password.length < 12) {
      res.status(400).json({ error: "Password must be at least 12 characters" });
      return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existing[0]) {
      res.status(409).json({ error: "Username already in use" });
      return;
    }

    const hashed = await hashPassword(password);

    // Bootstrap-admin must be atomic: serialize the count+insert with a
    // Postgres advisory lock so two concurrent first-signups can't both
    // observe count=0 and both become ADMIN. The lock is auto-released
    // at transaction end.
    const user = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(7331247001)`);
      const countRes = await tx.select({ c: sql<number>`count(*)::int` }).from(usersTable);
      const isFirstUser = (countRes[0]?.c ?? 0) === 0;
      const [created] = await tx.insert(usersTable).values({
        username,
        password: hashed,
        role: isFirstUser ? "ADMIN" : "USER",
        isActive: true,
        commissionRate: "0",
        permissions: isFirstUser ? ALL_PERMISSIONS : [],
      }).returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role, permissions: usersTable.permissions });
      return created;
    });

    const token = await signToken({ userId: user.id, username: user.username, role: user.role, permissions: user.permissions });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE * 1000,
      path: "/",
    });

    res.status(201).json({ success: true });
  } catch (e: any) {
    // Drizzle wraps pg errors as _DrizzleQueryError; the underlying pg error is on `cause`.
    const pgCode = e?.code ?? e?.cause?.code;
    if (pgCode === "23505") {
      res.status(409).json({ error: "Username already in use" });
      return;
    }
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  res.cookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  res.json({ success: true });
});

export default router;

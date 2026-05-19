import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET environment variable is required");
    process.exit(1);
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error("ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required.");
    console.error("Example: ADMIN_USERNAME=admin ADMIN_PASSWORD=<strongpassword> pnpm --filter @workspace/api-server run seed");
    process.exit(1);
  }

  if (adminPassword.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters for security");
    process.exit(1);
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, adminUsername)).limit(1);

  if (existing[0]) {
    console.log(`Admin user "${adminUsername}" already exists — skipping.`);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(adminPassword, 12);
  await db.insert(usersTable).values({
    username: adminUsername,
    password: hashed,
    role: "ADMIN",
    isActive: true,
    commissionRate: "0",
    permissions: [],
  });

  console.log(`Admin user "${adminUsername}" created. Use the credentials you provided via ADMIN_USERNAME / ADMIN_PASSWORD to sign in.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

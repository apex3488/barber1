import { config } from "dotenv";
import { resolve } from "node:path";
import { hash } from "argon2";
import { prisma } from "../lib/prisma.js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const login = process.env.ADMIN_LOGIN ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? "admin123";
const passwordHash = await hash(password);

const admin = await prisma.adminUser.upsert({
  where: { login },
  create: { login, passwordHash },
  update: { passwordHash },
});

console.log(`Admin ready: login=${admin.login} password=${password}`);
await prisma.$disconnect();

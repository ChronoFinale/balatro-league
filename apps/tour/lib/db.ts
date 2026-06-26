// Shared Tour Prisma client (the generated client lives at the custom output
// prisma/generated/client). Singleton to survive dev hot-reloads.
import { PrismaClient } from "../prisma/generated/client/index.js";

const g = globalThis as unknown as { __tourPrisma?: PrismaClient };

export const prisma: PrismaClient = g.__tourPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") g.__tourPrisma = prisma;

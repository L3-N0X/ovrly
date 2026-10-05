import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const appBaseUrl = process.env.APP_BASE_URL as string;

export const auth = betterAuth({
  secret: process.env.AUTH_SECRET as string,
  baseURL: appBaseUrl,
  trustedOrigins: [appBaseUrl],
  pages: {
    success: `${appBaseUrl}/`,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    twitch: {
      clientId: process.env.AUTH_TWITCH_ID as string,
      clientSecret: process.env.AUTH_TWITCH_SECRET as string,
    },
  },
});

export { prisma };

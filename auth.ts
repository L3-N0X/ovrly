import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

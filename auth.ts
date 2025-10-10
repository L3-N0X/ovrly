import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  secret: process.env.AUTH_SECRET as string,
  baseURL: "http://localhost:5173",
  trustedOrigins: ["http://localhost:5173"],
  pages: {
    success: "http://localhost:5173/",
  },
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  socialProviders: {
    twitch: {
      clientId: process.env.AUTH_TWITCH_ID as string,
      clientSecret: process.env.AUTH_TWITCH_SECRET as string,
    },
  },
});

export { prisma };

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
  databaseHooks: {
    session: {
      create: {
        // Link pending invitations (added by Twitch name before the user existed) once
        // per sign-in instead of on every authenticated request.
        after: async (session) => {
          try {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { id: true, name: true },
            });
            if (!user) return;
            // Twitch names are case-insensitive, invitations may be typed in any case.
            const where = {
              twitchName: { equals: user.name, mode: "insensitive" as const },
              userId: null,
            };
            const data = { userId: user.id };
            await Promise.all([
              prisma.accountShare.updateMany({ where, data }),
              prisma.overlayShare.updateMany({ where, data }),
            ]);
          } catch (error) {
            console.error("[AUTH] Failed to link pending invitations:", error);
          }
        },
      },
    },
  },
  socialProviders: {
    twitch: {
      clientId: process.env.AUTH_TWITCH_ID as string,
      clientSecret: process.env.AUTH_TWITCH_SECRET as string,
    },
  },
});

export { prisma };

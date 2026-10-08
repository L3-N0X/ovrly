/**
 * Creates the local test user that coding agents sign in with (see CLAUDE.md).
 * Needs AUTH_EMAIL_PASSWORD=true and a reachable DATABASE_URL. Safe to re-run.
 */
import { auth, prisma } from "../auth";

const email = "test@ovrly.local";
const password = "ovrly-test-password";
const name = "ovrly_test";

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.log(`[test-user] ${email} already exists`);
} else {
  await auth.api.signUpEmail({ body: { email, password, name } });
  console.log(`[test-user] created ${email}`);
}
await prisma.$disconnect();

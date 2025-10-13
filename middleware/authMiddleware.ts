import { auth } from "../auth";

export const authenticate = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers });
  return session;
};
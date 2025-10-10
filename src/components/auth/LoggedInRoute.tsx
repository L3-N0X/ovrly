import { authClient } from "@/lib/auth-client";
import { Outlet } from "react-router-dom";

const LoggedInRoute = () => {
  const { isPending } = authClient.useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  return <Outlet />;
};

export default LoggedInRoute;

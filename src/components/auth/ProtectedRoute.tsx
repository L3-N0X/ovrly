import { authClient } from "@/lib/auth-client";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const { data: user, isPending } = authClient.useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

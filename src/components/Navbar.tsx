import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { authClient } from "@/lib/auth-client";
import { Link, useNavigate } from "react-router-dom";
import { ModeToggle } from "./toggle";
import { Button } from "./ui/button";

import { LogOut, Settings, User } from "lucide-react";
import ovrlyLogo from "../assets/ovrly-logo.png";
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";

const Navbar = () => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut().then(() => {
      navigate("/");
    });
  };

  return (
    <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background: px-4 md:px-6 z-50 backdrop-blur-xl ">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-semibold md:text-base font-mono"
            >
              <img src={ovrlyLogo} alt="Ovrly Logo" className="h-8 w-8 dark:invert" />
              Ovrly
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="ml-auto flex-1 sm:flex-initial"></div>
        <ModeToggle></ModeToggle>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                {(user?.image && (
                  <img
                    alt="User Avatar"
                    src={user?.image}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )) || <User />}
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user && (
                <DropdownMenuLabel className="text-muted-foreground">
                  {user?.name}
                </DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {/* <DropdownMenuSeparator /> */}
              <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default Navbar;

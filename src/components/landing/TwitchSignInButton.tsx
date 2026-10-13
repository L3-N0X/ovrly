import { TwitchIcon } from "@/components/icons/TwitchIcon";
import { Button } from "@/components/ui/button";
import { useTwitchSignIn } from "@/lib/hooks/useTwitchSignIn";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type React from "react";

export const TwitchSignInButton: React.FC<{
  className?: string;
  size?: "sm" | "default" | "lg";
  children?: React.ReactNode;
}> = ({ className, size = "lg", children = "Sign in with Twitch" }) => {
  const { signIn, isSigningIn } = useTwitchSignIn();
  return (
    <Button
      size={size}
      onClick={() => void signIn()}
      disabled={isSigningIn}
      className={cn(
        "bg-brand-twitch text-brand-twitch-foreground shadow-[0_8px_30px_-8px] shadow-brand-twitch/60 hover:bg-brand-twitch/90",
        className
      )}
    >
      {isSigningIn ? <Loader2 className="animate-spin" /> : <TwitchIcon />}
      {children}
    </Button>
  );
};

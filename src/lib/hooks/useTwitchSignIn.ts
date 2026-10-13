import { authClient } from "@/lib/auth-client";
import { useState } from "react";

// Starts the Twitch sign-in. Every attempt overwrites the OAuth state cookie, so a second
// click while the first redirect is in flight makes the callback fail with state_mismatch.
export const useTwitchSignIn = (callbackURL?: string) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const signIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const { error } = await authClient.signIn.social({ provider: "twitch", callbackURL });
      if (error) setIsSigningIn(false);
    } catch (error) {
      setIsSigningIn(false);
      throw error;
    }
  };

  return { signIn, isSigningIn };
};

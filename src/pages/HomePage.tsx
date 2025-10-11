import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Overlay {
  id: string;
  name: string;
  description: string | null;
}

const HomePage: React.FC = () => {
  const { data: user, isPending: isSessionPending } = authClient.useSession();
  const navigate = useNavigate();
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOverlayName, setNewOverlayName] = useState("");
  const [newOverlayDescription, setNewOverlayDescription] = useState("");

  const fetchOverlays = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/api/overlays", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch overlays");
      }
      const data = await response.json();
      setOverlays(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOverlays();
    }
  }, [user]);

  const handleCreateOverlay = async () => {
    if (!newOverlayName) {
      setError("Overlay name is required.");
      return;
    }
    try {
      const response = await fetch("http://localhost:3000/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOverlayName, description: newOverlayDescription }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to create overlay");
      }
      fetchOverlays(); // Refetch overlays after creating a new one
      setIsDialogOpen(false); // Close the dialog
      setNewOverlayName(""); // Reset form
      setNewOverlayDescription(""); // Reset form
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const handleTwitchSignIn = async () => {
    await authClient.signIn.social({ provider: "twitch" });
  };

  if (isSessionPending) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="w-full max-w-4xl p-8 space-y-4">
        {user ? (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold">Welcome, {user.user.name}!</h1>
            </div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Overlays</h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4" />
                    Create New Overlay
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Overlay</DialogTitle>
                    <DialogDescription>
                      Enter a name and an optional description for your new overlay.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newOverlayName}
                        onChange={(e) => setNewOverlayName(e.target.value)}
                        placeholder="My Awesome Overlay"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={newOverlayDescription}
                        onChange={(e) => setNewOverlayDescription(e.target.value)}
                        placeholder="A short description of what this overlay is for."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateOverlay}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {isLoading ? (
              <p>Loading overlays...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overlays.map((overlay) => (
                  <Card
                    key={overlay.id}
                    onClick={() => navigate(`/overlay/${overlay.id}`)}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <CardTitle>{overlay.name}</CardTitle>
                      {overlay.description && (
                        <CardDescription>{overlay.description}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Sign In</h1>
            <Button onClick={handleTwitchSignIn} className="w-full max-w-xs mt-4">
              Sign in with Twitch
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;

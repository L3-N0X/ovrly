import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Inbox, Plus, RefreshCw, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Element {
  id: string;
  name: string;
  type: string;
  style?: Record<string, unknown>;
}

interface Overlay {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  elements: Element[];
  createdAt: string;
}

interface OverlayPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  elements: Element[];
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
  const [selectedPreset, setSelectedPreset] = useState<OverlayPreset | null>(
    null
  );
  const [presets, setPresets] = useState<OverlayPreset[]>([]);
  const [isCreating, setIsCreating] = useState(false);

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
      const sortedData = data.sort(
        (a: Overlay, b: Overlay) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOverlays(sortedData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await fetch("/presets/overlay-presets.json");
      if (!response.ok) {
        throw new Error("Failed to fetch presets");
      }
      const data = await response.json();
      setPresets(data.presets);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while loading presets"
      );
    }
  };

  useEffect(() => {
    if (user) {
      fetchOverlays();
    }
  }, [user]);

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleCreateOverlay = async () => {
    if (!newOverlayName || !selectedPreset) {
      setError("Overlay name and preset selection are required.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("http://localhost:3000/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOverlayName,
          description: newOverlayDescription,
          presetId: selectedPreset.id,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to create overlay");
      }
      fetchOverlays(); // Refetch overlays after creating a new one
      setIsDialogOpen(false); // Close the dialog
      setNewOverlayName(""); // Reset form
      setNewOverlayDescription(""); // Reset form
      setSelectedPreset(null); // Reset form
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePresetSelect = (preset: OverlayPreset) => {
    setSelectedPreset(preset);
  };

  const handleCreateNewOverlay = () => {
    setSelectedPreset(null);
    setNewOverlayName("");
    setNewOverlayDescription("");
    setIsDialogOpen(true);
  };

  const handleTwitchSignIn = async () => {
    await authClient.signIn.social({ provider: "twitch" });
  };

  if (isSessionPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        {user ? (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {user.user.name}!
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Ready to create something amazing today?
              </p>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Your Overlays</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchOverlays}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleCreateNewOverlay}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Overlay</DialogTitle>
                      <DialogDescription>
                        {selectedPreset
                          ? `Selected template: ${selectedPreset.name}`
                          : "Choose a template for your new overlay"}
                      </DialogDescription>
                    </DialogHeader>

                    {!selectedPreset ? (
                      <div className="space-y-4 py-4">
                        <h3 className="font-semibold">Select a Template</h3>
                        <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto p-1">
                          {presets.map((preset) => (
                            <div
                              key={preset.id}
                              className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                              onClick={() => handlePresetSelect(preset)}
                            >
                              {preset.icon ? (
                                <img
                                  src={`/presets/icons/${preset.icon}`}
                                  alt={`${preset.name} icon`}
                                  className="h-6 w-6 mr-3"
                                />
                              ) : (
                                <div className="text-2xl mr-3">
                                  {preset.icon}
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{preset.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {preset.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 py-4">
                        <div className="flex items-center p-3 border rounded-lg bg-accent mb-4">
                          {selectedPreset.icon ? (
                            <img
                              src={`/presets/icons/${selectedPreset.icon}`}
                              alt={`${selectedPreset.name} icon`}
                              className="h-6 w-6 mr-3"
                            />
                          ) : (
                            <div className="text-2xl mr-3">
                              {selectedPreset.icon}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">
                              {selectedPreset.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {selectedPreset.description}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="name">Overlay Name *</Label>
                          <Input
                            id="name"
                            value={newOverlayName}
                            onChange={(e) => setNewOverlayName(e.target.value)}
                            placeholder="My Awesome Overlay"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">
                            Overlay Description
                          </Label>
                          <Input
                            id="description"
                            value={newOverlayDescription}
                            onChange={(e) =>
                              setNewOverlayDescription(e.target.value)
                            }
                            placeholder="A short description of what this overlay is for."
                          />
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!selectedPreset) {
                            setIsDialogOpen(false);
                          } else {
                            setSelectedPreset(null);
                          }
                        }}
                      >
                        {selectedPreset ? "Back" : "Cancel"}
                      </Button>
                      {selectedPreset && (
                        <Button
                          onClick={handleCreateOverlay}
                          disabled={isCreating}
                        >
                          {isCreating ? "Creating..." : "Create"}
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {isLoading && overlays.length === 0 ? (
              <p className="text-center text-muted-foreground">
                Loading overlays...
              </p>
            ) : error ? (
              <p className="text-red-500 text-center">{error}</p>
            ) : overlays.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overlays.map((overlay) => (
                  <Card
                    key={overlay.id}
                    onClick={() => navigate(`/overlay/${overlay.id}`)}
                    className="cursor-pointer hover:shadow-lg transition-shadow flex flex-col"
                  >
                    <CardHeader className="flex-grow">
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{overlay.name}</span>
                        {overlay.userId !== user.user.id && (
                          <span title="Shared with you">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </span>
                        )}
                      </CardTitle>
                      {overlay.description && (
                        <CardDescription className="pt-2">
                          {overlay.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty variant="outline" className="py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox className="h-10 w-10" />
                  </EmptyMedia>
                  <EmptyTitle className="mt-4">No overlays yet</EmptyTitle>
                  <EmptyDescription>
                    It looks like you haven't created any overlays.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={handleCreateNewOverlay}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first overlay
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <h1 className="text-4xl font-bold">Welcome to Ovrly</h1>
            <p className="text-muted-foreground mt-2">
              Your one-stop solution for stream overlays.
            </p>
            <Button
              onClick={handleTwitchSignIn}
              className="w-full max-w-xs mt-8"
            >
              Sign in with Twitch
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;

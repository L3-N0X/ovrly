import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { authClient } from "@/lib/auth-client";
import { Inbox, Plus, RefreshCw } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import OverlayCard from "@/components/OverlayCard";
import CreateOverlayModal from "@/components/CreateOverlayModal";

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
  const [selectedPreset, setSelectedPreset] = useState<OverlayPreset | null>(null);
  const [presets, setPresets] = useState<OverlayPreset[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

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
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(
        errorMessage.includes("fetch")
          ? "Unable to connect to the server. Please check your internet connection and try again."
          : `Failed to load overlays: ${errorMessage}`
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
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(
        errorMessage.includes("fetch")
          ? "Unable to load overlay templates. Please check your connection and refresh the page."
          : `Failed to load templates: ${errorMessage}`
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

  const handleDuplicateOverlay = async (overlayId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/overlays/${overlayId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to duplicate overlay");
      }
      fetchOverlays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const handleCopyPublicUrl = (overlayId: string) => {
    const url = `${window.location.origin}/public/overlay/${overlayId}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopiedId(overlayId);
        setTimeout(() => setCopiedId(null), 2000);
      },
      (err) => {
        alert("Failed to copy URL.");
        console.error("Could not copy text: ", err);
      }
    );
  };

  const handleDeleteOverlay = async (overlayId: string) => {
    if (!window.confirm("Are you sure you want to delete this overlay?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/overlays/${overlayId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete overlay");
      }
      fetchOverlays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const handleCreateOverlay = async () => {
    // Clear any previous modal errors
    setModalError(null);

    if (!newOverlayName.trim()) {
      setModalError("Overlay name is required.");
      return;
    }

    if (!selectedPreset) {
      setModalError("Please select a template for your overlay.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("http://localhost:3000/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOverlayName.trim(),
          description: newOverlayDescription.trim(),
          presetId: selectedPreset.id,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create overlay");
      }
      fetchOverlays(); // Refetch overlays after creating a new one
      setIsDialogOpen(false); // Close the dialog
      setNewOverlayName(""); // Reset form
      setNewOverlayDescription(""); // Reset form
      setSelectedPreset(null); // Reset form
      setModalError(null); // Clear any errors
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "An unknown error occurred while creating the overlay"
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
                Manage your stream overlays below
              </p>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Your Overlays</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={fetchOverlays} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
                <CreateOverlayModal
                  isDialogOpen={isDialogOpen}
                  setIsDialogOpen={setIsDialogOpen}
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                  presets={presets}
                  newOverlayName={newOverlayName}
                  setNewOverlayName={setNewOverlayName}
                  newOverlayDescription={newOverlayDescription}
                  setNewOverlayDescription={setNewOverlayDescription}
                  isCreating={isCreating}
                  onCreateOverlay={handleCreateOverlay}
                  onPresetSelect={handlePresetSelect}
                  onCreateNewOverlay={handleCreateNewOverlay}
                  modalError={modalError}
                />
              </div>
            </div>

            {isLoading && overlays.length === 0 ? (
              <p className="text-center text-muted-foreground">Loading overlays...</p>
            ) : error ? (
              <p className="text-destructive text-center">{error}</p>
            ) : overlays.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overlays.map((overlay) => (
                  <OverlayCard
                    key={overlay.id}
                    overlay={overlay}
                    user={user}
                    navigate={navigate}
                    handleCopyPublicUrl={handleCopyPublicUrl}
                    handleDuplicateOverlay={handleDuplicateOverlay}
                    handleDeleteOverlay={handleDeleteOverlay}
                    copiedId={copiedId}
                  />
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
            <Button onClick={handleTwitchSignIn} className="w-full max-w-xs mt-8">
              Sign in with Twitch
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;

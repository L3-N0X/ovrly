import { Button } from "@/components/ui/button";
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
import { Plus } from "lucide-react";
import React from "react";

interface Element {
  id: string;
  name: string;
  type: string;
  style?: Record<string, unknown>;
}

interface OverlayPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  elements: Element[];
}

interface CreateOverlayModalProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedPreset: OverlayPreset | null;
  setSelectedPreset: (preset: OverlayPreset | null) => void;
  presets: OverlayPreset[];
  newOverlayName: string;
  setNewOverlayName: (name: string) => void;
  newOverlayDescription: string;
  setNewOverlayDescription: (description: string) => void;
  isCreating: boolean;
  onCreateOverlay: () => void;
  onPresetSelect: (preset: OverlayPreset) => void;
  onCreateNewOverlay: () => void;
  modalError: string | null;
}

const CreateOverlayModal: React.FC<CreateOverlayModalProps> = ({
  isDialogOpen,
  setIsDialogOpen,
  selectedPreset,
  setSelectedPreset,
  presets,
  newOverlayName,
  setNewOverlayName,
  newOverlayDescription,
  setNewOverlayDescription,
  isCreating,
  onCreateOverlay,
  onPresetSelect,
  onCreateNewOverlay,
  modalError,
}) => {
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={onCreateNewOverlay}>
          <Plus />
          New overlay
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[min(28rem,60vh)] overflow-y-auto p-1">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className="flex items-center p-3 border rounded-lg text-left cursor-pointer hover:bg-accent hover:border-primary/40 transition-colors"
                  onClick={() => onPresetSelect(preset)}
                >
                  {preset.icon ? (
                    <div className="w-12 h-12 mr-3 shrink-0 flex items-center justify-center rounded-md bg-muted p-1.5">
                      <img
                        src={`/presets/icons/${preset.icon}`}
                        alt={`${preset.name} icon`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-2xl mr-3">{preset.icon}</div>
                  )}
                  <div>
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-sm text-muted-foreground">{preset.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center p-3 border rounded-lg bg-accent mb-4">
              {selectedPreset.icon ? (
                <div className="w-10 h-10 mr-3 flex items-center justify-center">
                  <img
                    src={`/presets/icons/${selectedPreset.icon}`}
                    alt={`${selectedPreset.name} icon`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-2xl mr-3">{selectedPreset.icon}</div>
              )}
              <div>
                <div className="font-medium">{selectedPreset.name}</div>
                <div className="text-sm text-muted-foreground">{selectedPreset.description}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Overlay Name *</Label>
              <Input
                id="name"
                autoFocus
                value={newOverlayName}
                onKeyDown={(e) => e.key === "Enter" && !isCreating && onCreateOverlay()}
                onChange={(e) => setNewOverlayName(e.target.value)}
                placeholder="My Awesome Overlay"
                className={modalError ? "border-destructive focus:border-destructive" : ""}
              />
              {modalError && <p className="text-sm text-destructive mt-1">{modalError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Overlay Description</Label>
              <Input
                id="description"
                value={newOverlayDescription}
                onChange={(e) => setNewOverlayDescription(e.target.value)}
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
            <Button onClick={onCreateOverlay} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOverlayModal;

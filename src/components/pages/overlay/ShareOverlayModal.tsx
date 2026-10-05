import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";

interface OverlayEditorDisplay {
  // This will be the editorTwitchName, used for unique identification, display, and revocation.
  identifier: string;
  name: string;
  isGlobalEditor: boolean; // To distinguish between overlay-specific and global editors
}

interface ShareOverlayModalProps {
  overlayId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareOverlayModal({ overlayId, isOpen, onClose }: ShareOverlayModalProps) {
  const { data: session } = useSession();
  const [overlayEditorDisplays, setOverlayEditorDisplays] = useState<OverlayEditorDisplay[]>([]);
  const [globalEditorDisplays, setGlobalEditorDisplays] = useState<OverlayEditorDisplay[]>([]);
  const [twitchName, setTwitchName] = useState("");

  const [canManage, setCanManage] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchEditors = useCallback(async () => {
    if (!session) return;

    // Returns the overlay's own editors and the owner's global editors (who can edit every
    // overlay of the owner), plus whether the current user may change the list.
    const response = await fetch(`/api/overlays/${overlayId}/editors`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const data: {
      editors: { editorTwitchName: string }[];
      globalEditors: { editorTwitchName: string }[];
      canManage: boolean;
    } = await response.json();
    setOverlayEditorDisplays(
      data.editors.map((oe) => ({
        identifier: oe.editorTwitchName,
        name: oe.editorTwitchName,
        isGlobalEditor: false,
      }))
    );
    setGlobalEditorDisplays(
      data.globalEditors.map((editor) => ({
        identifier: editor.editorTwitchName,
        name: editor.editorTwitchName,
        isGlobalEditor: true,
      }))
    );
    setCanManage(data.canManage);
  }, [session, overlayId]);

  useEffect(() => {
    if (isOpen) {
      setAddError(null);
      fetchEditors();
    }
  }, [isOpen, fetchEditors]);

  const handleAddEditor = async () => {
    if (!session || !twitchName.trim()) return;
    const response = await fetch(`/api/overlays/${overlayId}/editors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ twitchName: twitchName.trim() }),
      credentials: "include",
    });
    if (response.ok) {
      setTwitchName("");
      setAddError(null);
      fetchEditors();
    } else {
      const data = await response.json().catch(() => ({}));
      setAddError(data.error || "Failed to add editor");
    }
  };

  const handleRevokeAccess = async (editorTwitchName: string) => {
    if (!session) return;
    const response = await fetch(
      `/api/overlays/${overlayId}/editors/${encodeURIComponent(editorTwitchName)}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (response.ok) {
      fetchEditors();
    }
  };

  const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const allEditors = [
    ...overlayEditorDisplays,
    ...globalEditorDisplays.filter(
      (ge) => !overlayEditorDisplays.some((oe) => sameName(oe.identifier, ge.identifier))
    ),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Overlay</DialogTitle>
        </DialogHeader>
        {canManage && (
          <div className="mb-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter Twitch name"
                value={twitchName}
                onChange={(e) => setTwitchName(e.target.value)}
              />
              <Button onClick={handleAddEditor}>Add Editor</Button>
            </div>
            {addError && <p className="text-sm text-destructive mt-2">{addError}</p>}
          </div>
        )}
        <div>
          <h3 className="font-semibold mb-2">Current Editors:</h3>
          <ul>
            {allEditors.map((editor) => {
              return (
                <li key={editor.identifier} className="flex justify-between items-center mb-2">
                  <span>{editor.name}</span>
                  {editor.isGlobalEditor ? (
                    <em className="text-sm text-muted-foreground">(Global Editor)</em>
                  ) : null}

                  {canManage && !editor.isGlobalEditor && ( // Global editors are managed in Settings
                    <Button
                      variant="destructive"
                      onClick={() => handleRevokeAccess(editor.identifier)}
                    >
                      Revoke Access
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

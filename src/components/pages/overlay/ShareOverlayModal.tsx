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

  const fetchEditors = useCallback(async () => {
    if (!session) return;

    // Fetch overlay-specific editors
    const overlayEditorsResponse = await fetch(
      `http://localhost:3000/api/overlays/${overlayId}/editors`,
      {
        credentials: "include",
      }
    );
    if (overlayEditorsResponse.ok) {
      // Backend returns an array of prisma.OverlayEditor objects, which include editorTwitchName
      const data: { editorId: string | null; editorTwitchName: string }[] =
        await overlayEditorsResponse.json();
      setOverlayEditorDisplays(
        data.map((oe) => ({
          identifier: oe.editorTwitchName,
          name: oe.editorTwitchName,
          isGlobalEditor: false,
        }))
      );
    }

    // Fetch global editors
    // Assuming the global editors endpoint returns objects with editorId and editorTwitchName
    const globalEditorsResponse = await fetch("http://localhost:3000/api/editors", {
      credentials: "include",
    });
    if (globalEditorsResponse.ok) {
      const data: { editorId: string | null; editorTwitchName: string }[] =
        await globalEditorsResponse.json();
      setGlobalEditorDisplays(
        data.map((editor) => ({
          identifier: editor.editorTwitchName, // Use twitch name as identifier
          name: editor.editorTwitchName,
          isGlobalEditor: true,
        }))
      );
    }
  }, [session, overlayId]);

  useEffect(() => {
    if (isOpen) {
      fetchEditors();
    }
  }, [isOpen, fetchEditors]);

  const handleAddEditor = async () => {
    if (!session || !twitchName) return;
    const response = await fetch(`http://localhost:3000/api/overlays/${overlayId}/editors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ twitchName }),
      credentials: "include",
    });
    if (response.ok) {
      setTwitchName("");
      fetchEditors();
    }
  };

  const handleRevokeAccess = async (editorTwitchName: string) => {
    if (!session) return;
    const response = await fetch(
      `http://localhost:3000/api/overlays/${overlayId}/editors/${encodeURIComponent(
        editorTwitchName
      )}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (response.ok) {
      fetchEditors();
    }
  };

  const allEditors = [
    ...overlayEditorDisplays,
    ...globalEditorDisplays.filter(
      (ge) => !overlayEditorDisplays.some((oe) => oe.identifier === ge.identifier)
    ),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Overlay</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Input
            type="text"
            placeholder="Enter Twitch name"
            value={twitchName}
            onChange={(e) => setTwitchName(e.target.value)}
          />
          <Button onClick={handleAddEditor}>Add Editor</Button>
        </div>
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

                  {!editor.isGlobalEditor && ( // Only allow revoking for overlay-specific editors
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

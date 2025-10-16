import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth-client";

interface Editor {
  id: string;
  name: string;
}

interface ShareOverlayModalProps {
  overlayId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareOverlayModal({ overlayId, isOpen, onClose }: ShareOverlayModalProps) {
  const { data: session } = useSession();
  const [overlayEditors, setOverlayEditors] = useState<Editor[]>([]);
  const [globalEditors, setGlobalEditors] = useState<Editor[]>([]);
  const [twitchName, setTwitchName] = useState("");

  const fetchEditors = useCallback(async () => {
    if (!session) return;

    // Fetch overlay-specific editors
    const overlayEditorsResponse = await fetch(`http://localhost:3000/api/overlays/${overlayId}/editors`, {
      credentials: "include",
    });
    if (overlayEditorsResponse.ok) {
      const data = await overlayEditorsResponse.json();
      setOverlayEditors(data);
    }

    // Fetch global editors
    const globalEditorsResponse = await fetch("http://localhost:3000/api/editors", {
      credentials: "include",
    });
    if (globalEditorsResponse.ok) {
      const data: { editorId: string, editorTwitchName: string }[] = await globalEditorsResponse.json();
      setGlobalEditors(data.map((editor) => ({ id: editor.editorId, name: editor.editorTwitchName })));
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

  const handleRevokeAccess = async (editorId: string) => {
    if (!session) return;
    const response = await fetch(`http://localhost:3000/api/overlays/${overlayId}/editors/${editorId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      fetchEditors();
    }
  };

  const allEditors = [...overlayEditors, ...globalEditors.filter(ge => !overlayEditors.some(oe => oe.id === ge.id))];

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
              const isGlobal = globalEditors.some(ge => ge.id === editor.id);
              return (
                <li key={editor.id} className="flex justify-between items-center mb-2">
                  <span>{editor.name} {isGlobal && "(Global)"}</span>
                  {!isGlobal && (
                    <Button
                      variant="destructive"
                      onClick={() => handleRevokeAccess(editor.id)}
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
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

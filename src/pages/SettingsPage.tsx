import { useCallback, useEffect, useState } from "react";
import { useSession } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

interface Editor {
  id: string;
  editorTwitchName: string;
}

export function SettingsPage() {
  const { data: session } = useSession();
  const [editors, setEditors] = useState<Editor[]>([]);
  const [twitchName, setTwitchName] = useState("");

  const fetchEditors = useCallback(async () => {
    if (!session) return;
    const response = await fetch("http://localhost:3000/api/editors", {
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      setEditors(data);
    }
  }, [session]);

  useEffect(() => {
    fetchEditors();
  }, [fetchEditors]);

  const handleAddEditor = async () => {
    if (!session || !twitchName) return;
    const response = await fetch("http://localhost:3000/api/editors", {
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
    const response = await fetch("http://localhost:3000/api/editors", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ twitchName: editorTwitchName }),
      credentials: "include",
    });
    if (response.ok) {
      fetchEditors();
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Manage Editors</CardTitle>
        </CardHeader>
        <CardContent>
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
              {editors.map((editor) => (
                <li key={editor.id} className="flex justify-between items-center mb-2">
                  <span>{editor.editorTwitchName}</span>
                  <Button
                    variant="destructive"
                    onClick={() => handleRevokeAccess(editor.editorTwitchName)}
                  >
                    Revoke Access
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

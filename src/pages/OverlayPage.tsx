import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Overlay {
  id: string;
  name: string;
  description: string | null;
  counter: number;
  title: string | null;
}

const OverlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [title, setTitle] = useState("");
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOverlay = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3000/api/overlays/${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch overlay");
      }
      const data = await response.json();
      setOverlay(data);
      setCount(data.counter);
      setTitle(data.title || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchOverlay();
    }
  }, [id, fetchOverlay]);

  const handleDeleteOverlay = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/overlays/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete overlay");
      }
      navigate("/"); // Navigate back to home page after deletion
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const updateCountInDb = useCallback(
    async (newCount: number) => {
      try {
        const response = await fetch(`http://localhost:3000/api/overlays/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counter: newCount }),
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to update counter");
        }
      } catch (err) {
        // Optionally handle and display this error to the user
        console.error(err);
      }
    },
    [id]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const updateTitleInDb = async () => {
    if (overlay && title !== (overlay.title || "")) {
      try {
        const response = await fetch(`http://localhost:3000/api/overlays/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title }),
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to update title");
        }
        const updatedOverlay = await response.json();
        setOverlay(updatedOverlay);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      }
    }
  };

  const handleCountChange = (newCount: number) => {
    setCount(newCount);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      updateCountInDb(newCount);
    }, 500); // 500ms debounce delay
  };

  const handleIncrease = () => handleCountChange(count + 1);
  const handleDecrease = () => handleCountChange(count - 1);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      handleCountChange(value);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading overlay...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>
    );
  }

  if (!overlay) {
    return <div className="flex items-center justify-center min-h-screen">Overlay not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-4">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{overlay.name}</h1>
          {overlay.description && (
            <p className="text-sm text-muted-foreground">{overlay.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side */}
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg">
          <h2 className="text-4xl font-bold mb-4">{title}</h2>
          <p className="text-9xl font-bold">{count}</p>
        </div>

        {/* Right Side */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Counter Controls</CardTitle>
              <CardDescription>
                Use these controls to adjust the counter.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center space-x-2 pt-4">
              <Button onClick={handleDecrease} size="lg">
                -
              </Button>
              <Input
                type="number"
                value={count}
                onChange={handleInputChange}
                className="w-24 text-center text-2xl h-14"
              />
              <Button onClick={handleIncrease} size="lg">
                +
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overlay Title</CardTitle>
              <CardDescription>
                Change the title that is displayed on the overlay.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={handleTitleChange}
                  onBlur={updateTitleInDb}
                  placeholder="Enter overlay title"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                These actions are irreversible. Please be certain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDeleteOverlay} variant="destructive" className="w-full">
                Delete Overlay
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OverlayPage;

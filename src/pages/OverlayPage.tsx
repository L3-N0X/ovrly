import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Overlay {
  id: string;
  name: string;
  description: string | null;
  counter: number;
}

const OverlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
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
    <div className="w-full max-w-md mx-auto p-8 space-y-6">
      <div className="relative flex items-center justify-center mb-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{overlay.name}</h1>
          {overlay.description && <p className="text-gray-500">{overlay.description}</p>}
        </div>
      </div>
      <div className="flex items-center justify-center space-x-2 pt-4">
        <Button onClick={handleDecrease}>-</Button>
        <Input
          type="number"
          value={count}
          onChange={handleInputChange}
          className="w-24 text-center"
        />
        <Button onClick={handleIncrease}>+</Button>
      </div>
      <Button onClick={handleDeleteOverlay} variant="destructive" className="w-full">
        Delete Overlay
      </Button>
    </div>
  );
};

export default OverlayPage;

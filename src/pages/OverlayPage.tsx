import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Copy, Minus, Plus } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StyleEditor from "@/components/overlay/editor/StyleEditor";
import FontLoader from "@/components/FontLoader";
import type { ElementType, PrismaElement, PrismaOverlay, BaseElementStyle } from "@/lib/types";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";

const OverlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<PrismaOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const calculateScale = useCallback(() => {
    if (previewContainerRef.current) {
      const { width } = previewContainerRef.current.getBoundingClientRect();
      setScale(width / 800);
    }
  }, []);

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
      const data: PrismaOverlay = await response.json();
      setOverlay(data);
      // Load fonts when overlay data is initially fetched
      loadOverlayFonts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Function to extract and load fonts from overlay data
  const loadOverlayFonts = (overlayData: PrismaOverlay) => {
    if (!overlayData) return null;

    // Extract unique font families and weights from overlay elements
    const fonts = new Set<string>();

    // Check individual elements for font families and weights
    if (overlayData.elements) {
      overlayData.elements.forEach((element) => {
        // Check if the element style exists before accessing its properties
        if (element.style) {
          // Type guard to check if the style has fontFamily property
          const elementStyle = element.style as BaseElementStyle;
          if (elementStyle.fontFamily) {
            // Check if style has fontWeight (even though it's not in the type)
            const fontWeight = (elementStyle as { fontWeight?: string }).fontWeight || "400";
            fonts.add(`${elementStyle.fontFamily}:${fontWeight}`);
          }
        }
      });
    }

    // Render FontLoader for each unique font family and weight
    return Array.from(fonts).map((fontString, index) => {
      const [fontFamily, fontWeight] = fontString.split(":");
      return <FontLoader key={index} fontFamily={fontFamily} fontWeight={fontWeight} />;
    });
  };

  useEffect(() => {
    if (id) {
      fetchOverlay();
    }
  }, [id, fetchOverlay]);

  useEffect(() => {
    if (!id) return;

    const ws = new WebSocket(`ws://localhost:3000/ws?overlayId=${id}`);

    ws.onmessage = (event) => {
      try {
        const updatedOverlay: PrismaOverlay = JSON.parse(event.data);
        setOverlay(updatedOverlay);
        // Load fonts when overlay data changes via WebSocket
        loadOverlayFonts(updatedOverlay);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    // The cleanup function will be called when the component unmounts.
    return () => {
      // By the time the cleanup function runs, the WebSocket constructor has been called.
      // We can safely call close() on it. The browser will handle the case where the
      // connection is not yet open by canceling the connection attempt.
      ws.close();
    };
  }, [id]);

  useEffect(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [calculateScale, overlay]);

  // Debounced PATCH request function
  const debouncedUpdate = useCallback((url: string, body: object) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to update");
        }
      } catch (err) {
        console.error(err);
      }
    }, 500);
  }, []);

  // Recursive helper function to compare and find changed elements
  const findChangedElements = (
    updatedElements: PrismaElement[],
    originalElements: PrismaElement[]
  ): PrismaElement[] => {
    const changedElements: PrismaElement[] = [];

    // Create a map of original elements by id for quick lookup
    const originalMap = new Map<string, PrismaElement>();
    const buildOriginalMap = (elements: PrismaElement[]) => {
      elements.forEach((el) => {
        originalMap.set(el.id, el);
        if (el.children) {
          buildOriginalMap(el.children);
        }
      });
    };
    buildOriginalMap(originalElements);

    // Check each updated element against original
    const checkElements = (elements: PrismaElement[]) => {
      elements.forEach((el) => {
        const originalEl = originalMap.get(el.id);
        if (!originalEl || JSON.stringify(el.style) !== JSON.stringify(originalEl.style)) {
          changedElements.push(el);
        }
        if (el.children) {
          checkElements(el.children);
        }
      });
    };
    checkElements(updatedElements);

    return changedElements;
  };

  const handleOverlayChange = (updatedOverlay: PrismaOverlay) => {
    if (!overlay) return;

    // Check if globalStyle has changed
    if (JSON.stringify(updatedOverlay.globalStyle) !== JSON.stringify(overlay.globalStyle)) {
      debouncedUpdate(`http://localhost:3000/api/overlays/${id}`, {
        globalStyle: updatedOverlay.globalStyle,
      });
    }

    // Recursively find all elements with changed styles
    const changedElements = findChangedElements(updatedOverlay.elements, overlay.elements);

    // Send update requests for each changed element
    changedElements.forEach((element) => {
      debouncedUpdate(`http://localhost:3000/api/elements/${element.id}`, {
        style: element.style,
      });
    });

    setOverlay(updatedOverlay);
  };

  // Recursive helper function to find an element by ID
  // const findElementById = (elements: PrismaElement[], id: string): PrismaElement | undefined => {
  //   for (const el of elements) {
  //     if (el.id === id) return el;
  //     if (el.children) {
  //       const found = findElementById(el.children, id);
  //       if (found) return found;
  //     }
  //   }
  //   return undefined;
  // };

  // Recursive helper function to update an element by ID
  const updateElementById = (
    elements: PrismaElement[],
    id: string,
    updateFn: (el: PrismaElement) => void
  ): boolean => {
    for (const el of elements) {
      if (el.id === id) {
        updateFn(el);
        return true;
      }
      if (el.children) {
        if (updateElementById(el.children, id, updateFn)) {
          return true;
        }
      }
    }
    return false;
  };

  const handleDataChange = (elementId: string, data: { value: number } | { text: string }) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay)) as PrismaOverlay;

    // Use the recursive update function to find and update the element
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (element) => {
      if ("value" in data && element.type === "COUNTER" && element.counter) {
        element.counter.value = data.value;
      }
      if ("text" in data && element.type === "TITLE" && element.title) {
        element.title.text = data.text;
      }
    });

    if (elementUpdated) {
      setOverlay(newOverlay);
      debouncedUpdate(`http://localhost:3000/api/elements/${elementId}`, { data });
    }
  };

  const handleDeleteOverlay = async () => {
    try {
      await fetch(`http://localhost:3000/api/overlays/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const handleCopy = () => {
    if (id) {
      const url = `${window.location.origin}/public/${id}`;
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (isLoading)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>
    );
  if (!overlay)
    return <div className="flex items-center justify-center min-h-screen">Overlay not found</div>;

  // Recursive helper function to find the first element of a specific type
  const findFirstElementByType = (
    elements: PrismaElement[],
    type: ElementType
  ): PrismaElement | undefined => {
    for (const el of elements) {
      if (el.type === type) return el;
      if (el.children) {
        const found = findFirstElementByType(el.children, type);
        if (found) return found;
      }
    }
    return undefined;
  };

  const counterElement = findFirstElementByType(overlay.elements, "COUNTER");
  const titleElement = findFirstElementByType(overlay.elements, "TITLE");

  return (
    <>
      {loadOverlayFonts(overlay)}
      <div className="container mx-auto">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-4">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-grow">
            <h1 className="text-2xl font-bold">{overlay.name}</h1>
            {overlay.description && (
              <p className="text-sm text-muted-foreground">{overlay.description}</p>
            )}
          </div>
          <Button variant="outline" size="lg" onClick={handleCopy}>
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy Link
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div
            ref={previewContainerRef}
            className="flex flex-col items-center border rounded-lg bg-secondary pt-4 sticky top-20"
          >
            <h2 className="text-xl font-semibold mb-2 w-full px-4">Preview</h2>
            <div className="aspect-[4/3] w-full max-w-full overflow-hidden flex justify-center items-center bg-sidebar">
              <div
                style={{
                  width: "800px",
                  height: "600px",
                  transform: `scale(${scale})`,
                  transformOrigin: "center center",
                }}
              >
                <OverlayCanvas overlay={overlay} />
              </div>
            </div>
            <div className="py-2 text-sm text-muted-foreground mb-4">Live Preview (800x600)</div>
          </div>

          <div className="space-y-8 pb-96">
            {/* These controls now target the FIRST element of their type */}
            <Card>
              <CardHeader>
                <CardTitle>Data Controls</CardTitle>
                <CardDescription>Adjust the content of your elements.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col space-y-6 pt-4">
                {counterElement && (
                  <div className="space-y-2">
                    <Label htmlFor="count">Counter: {counterElement.name}</Label>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() =>
                          handleDataChange(counterElement.id, {
                            value: (counterElement.counter?.value || 0) - 1,
                          })
                        }
                        size="icon-lg"
                        variant="secondary"
                        className="h-14 w-14"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="count"
                        value={counterElement.counter?.value || 0}
                        onChange={(e) =>
                          handleDataChange(counterElement.id, {
                            value: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-36 text-center text-2xl h-14"
                      />
                      <Button
                        onClick={() =>
                          handleDataChange(counterElement.id, {
                            value: (counterElement.counter?.value || 0) + 1,
                          })
                        }
                        size="icon-lg"
                        variant="secondary"
                        className="h-14 w-14"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {titleElement && (
                  <div className="space-y-2">
                    <Label htmlFor="title">Title: {titleElement.name}</Label>
                    <Input
                      id="title"
                      value={titleElement.title?.text || ""}
                      onChange={(e) => handleDataChange(titleElement.id, { text: e.target.value })}
                      placeholder="Enter title text"
                    />
                  </div>
                )}
                {!counterElement && !titleElement && (
                  <p className="text-sm text-muted-foreground">
                    No editable elements in this overlay.
                  </p>
                )}
              </CardContent>
            </Card>

            <StyleEditor overlay={overlay} onOverlayChange={handleOverlayChange} />

            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>This action is irreversible. Please be certain.</CardDescription>
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
    </>
  );
};

export default OverlayPage;

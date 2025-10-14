import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Copy, Minus, Plus, Pause, Play, RotateCcw } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StyleEditor from "@/components/overlay/editor/StyleEditor";
import FontLoader from "@/components/FontLoader";
import type { PrismaElement, PrismaOverlay, BaseElementStyle } from "@/lib/types";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";

const OverlayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<PrismaOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [timerDisplayTimes, setTimerDisplayTimes] = useState<{ [key: string]: string }>({});
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
      const response = await fetch(`/api/overlays/${id}`, {
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

  const formatTime = useCallback((milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${remainingMinutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const timerElements = overlay ? overlay.elements.filter((el) => el.type === "TIMER") : [];
    const intervalIds: number[] = [];

    const initialTimes: { [key: string]: string } = {};

    timerElements.forEach((timerElement) => {
      if (!timerElement.timer) {
        initialTimes[timerElement.id] = "00:00";
        return;
      }

      const { startedAt, pausedAt } = timerElement.timer;
      const getPausedDuration = () => (pausedAt ? new Date(pausedAt).getTime() : 0);

      if (startedAt) {
        const startTime = new Date(startedAt).getTime();
        const pausedDuration = getPausedDuration();

        const elapsed = Date.now() - startTime;
        initialTimes[timerElement.id] = formatTime(pausedDuration + elapsed);

        const intervalId = window.setInterval(() => {
          const elapsed = Date.now() - startTime;
          setTimerDisplayTimes((prev) => ({
            ...prev,
            [timerElement.id]: formatTime(pausedDuration + elapsed),
          }));
        }, 1000);
        intervalIds.push(intervalId);
      } else {
        initialTimes[timerElement.id] = formatTime(getPausedDuration());
      }
    });

    setTimerDisplayTimes(initialTimes);

    return () => {
      intervalIds.forEach(clearInterval);
    };
  }, [overlay, formatTime]);

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
      debouncedUpdate(`/api/overlays/${id}`, {
        globalStyle: updatedOverlay.globalStyle,
      });
    }

    // Recursively find all elements with changed styles
    const changedElements = findChangedElements(updatedOverlay.elements, overlay.elements);

    // Send update requests for each changed element
    changedElements.forEach((element) => {
      debouncedUpdate(`/api/elements/${element.id}`, {
        style: element.style,
      });
    });

    setOverlay(updatedOverlay);
  };

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

  const sendUpdateImmediately = async (elementId: string, data: object) => {
    try {
      await fetch(`/api/elements/${elementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to send immediate update", err);
    }
  };

  const handleCounterChange = (elementId: string, value: number) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.counter) el.counter.value = value;
    });
    if (elementUpdated) {
      setOverlay(newOverlay);
      debouncedUpdate(`/api/elements/${elementId}`, { data: { value } });
    }
  };

  const handleTitleChange = (elementId: string, text: string) => {
    if (!overlay) return;
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementUpdated = updateElementById(newOverlay.elements, elementId, (el) => {
      if (el.title) el.title.text = text;
    });
    if (elementUpdated) {
      setOverlay(newOverlay);
      debouncedUpdate(`/api/elements/${elementId}`, { data: { text } });
    }
  };

  const handleTimerToggle = (elementId: string) => {
    const timerElement = overlay?.elements.find((el) => el.id === elementId);
    if (!timerElement?.id || !timerElement.timer) return;
    const { startedAt, pausedAt } = timerElement.timer;

    if (startedAt) {
      // Running -> Pause
      const startTime = new Date(startedAt).getTime();
      const elapsed = Date.now() - startTime;
      const oldDuration = pausedAt ? new Date(pausedAt).getTime() : 0;
      const newDuration = oldDuration + elapsed;
      sendUpdateImmediately(timerElement.id, {
        data: { startedAt: null, pausedAt: new Date(newDuration).toISOString() },
      });
    } else {
      // Paused -> Start
      sendUpdateImmediately(timerElement.id, {
        data: { startedAt: new Date().toISOString(), pausedAt: pausedAt },
      });
    }
  };

  const handleTimerReset = (elementId: string) => {
    const timerElement = overlay?.elements.find((el) => el.id === elementId);
    if (!timerElement?.id) return;
    sendUpdateImmediately(timerElement.id, {
      data: { startedAt: null, pausedAt: new Date(0).toISOString() },
    });
  };

  const handleDeleteOverlay = async () => {
    try {
      await fetch(`/api/overlays/${id}`, {
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

  const counterElements = overlay.elements.filter((el) => el.type === "COUNTER");
  const titleElements = overlay.elements.filter((el) => el.type === "TITLE");
  const timerElements = overlay.elements.filter((el) => el.type === "TIMER");

  return (
    <>
      {loadOverlayFonts(overlay)}
      <div className="container mx-auto">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-4">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex-grow">
            <div className="flex items-center space-x-3">
              {overlay.icon && (
                <img
                  src={`/presets/icons/${overlay.icon}`}
                  alt={`${overlay.name} icon`}
                  className="h-6 w-6"
                />
              )}
              <h1 className="text-2xl font-bold">{overlay.name}</h1>
            </div>
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
            <Card>
              <CardHeader>
                <CardTitle>Data Controls</CardTitle>
                <CardDescription>Adjust the content of your elements.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col space-y-6 pt-4">
                {timerElements.map((timerElement) => (
                  <div key={timerElement.id} className="space-y-2">
                    <Label>Timer: {timerElement.name}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="text-2xl font-mono bg-secondary h-14 flex items-center justify-center rounded-md px-4 flex-grow">
                        {timerDisplayTimes[timerElement.id] || "00:00"}
                      </div>
                      <Button
                        onClick={() => handleTimerToggle(timerElement.id)}
                        size="icon-lg"
                        variant="secondary"
                        className="h-14 w-14"
                      >
                        {timerElement.timer?.startedAt ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleTimerReset(timerElement.id)}
                        size="icon-lg"
                        variant="secondary"
                        className="h-14 w-14"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {counterElements.map((counterElement) => (
                  <div key={counterElement.id} className="space-y-2">
                    <Label htmlFor={`count-${counterElement.id}`}>
                      Counter: {counterElement.name}
                    </Label>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() =>
                          handleCounterChange(
                            counterElement.id,
                            (counterElement.counter?.value || 0) - 1
                          )
                        }
                        size="icon-lg"
                        variant="secondary"
                        className="h-14 w-14"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id={`count-${counterElement.id}`}
                        value={counterElement.counter?.value || 0}
                        onChange={(e) =>
                          handleCounterChange(
                            counterElement.id,
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-36 text-center text-2xl h-14"
                      />
                      <Button
                        onClick={() =>
                          handleCounterChange(
                            counterElement.id,
                            (counterElement.counter?.value || 0) + 1
                          )
                        }
                        size="icon-lg"
                        variant="secondary"
                        className="h-14 w-14"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {titleElements.map((titleElement) => (
                  <div key={titleElement.id} className="space-y-2">
                    <Label htmlFor={`title-${titleElement.id}`}>Title: {titleElement.name}</Label>
                    <Input
                      id={`title-${titleElement.id}`}
                      value={titleElement.title?.text || ""}
                      onChange={(e) => handleTitleChange(titleElement.id, e.target.value)}
                      placeholder="Enter title text"
                    />
                  </div>
                ))}
                {counterElements.length === 0 &&
                  titleElements.length === 0 &&
                  timerElements.length === 0 && (
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

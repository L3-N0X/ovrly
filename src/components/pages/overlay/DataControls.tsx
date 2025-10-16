import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimerEditModal } from "@/components/overlay/editor/TimerEditModal";
import type { PrismaElement, PrismaOverlay } from "@/lib/types";
import TimerControl from "./controls/TimerControl";
import CounterControl from "./controls/CounterControl";
import TitleControl from "./controls/TitleControl";
import ImageControl from "./controls/ImageControl";

interface DataControlsProps {
  overlay: PrismaOverlay;
  handleCounterChange: (elementId: string, value: number) => void;
  handleImmediateCounterChange: (elementId: string, value: number) => void;
  handleTitleChange: (elementId: string, text: string) => void;
  handleImageChange: (elementId: string, src: string) => void;
  handleTimerToggle: (elementId: string) => void;
  handleTimerReset: (elementId: string) => void;
  handleTimerUpdate: (elementId: string, update: { duration?: number; countDown?: boolean }) => void;
  handleTimerAddTime: (elementId: string, timeToAdd: number) => void;
  selectedTimer: PrismaElement | null;
  setSelectedTimer: (timer: PrismaElement | null) => void;
}

const DataControls: React.FC<DataControlsProps> = ({
  overlay,
  handleCounterChange,
  handleImmediateCounterChange,
  handleTitleChange,
  handleImageChange,
  handleTimerToggle,
  handleTimerReset,
  handleTimerUpdate,
  handleTimerAddTime,
  selectedTimer,
  setSelectedTimer,
}) => {
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);

  const editableElements = overlay.elements.filter(
    (el) => el.type === "COUNTER" || el.type === "TITLE" || el.type === "TIMER" || el.type === "IMAGE"
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Data Controls</CardTitle>
          <CardDescription>Adjust the content of your elements.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-6 pt-4">
          {editableElements.length > 0 ? (
            editableElements.map((element) => {
              switch (element.type) {
                case "TIMER":
                  return (
                    <TimerControl
                      key={element.id}
                      element={element}
                      handleTimerToggle={handleTimerToggle}
                      handleTimerReset={handleTimerReset}
                      setSelectedTimer={setSelectedTimer}
                      setIsTimerModalOpen={setIsTimerModalOpen}
                    />
                  );
                case "COUNTER":
                  return (
                    <CounterControl
                      key={element.id}
                      element={element}
                      handleCounterChange={handleCounterChange}
                      handleImmediateCounterChange={handleImmediateCounterChange}
                    />
                  );
                case "TITLE":
                  return (
                    <TitleControl
                      key={element.id}
                      element={element}
                      handleTitleChange={handleTitleChange}
                    />
                  );
                case "IMAGE":
                  return (
                    <ImageControl
                      key={element.id}
                      element={element}
                      handleImageChange={handleImageChange}
                    />
                  );
                default:
                  return null;
              }
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No editable elements in this overlay.
            </p>
          )}
        </CardContent>
      </Card>
      {selectedTimer && (
        <TimerEditModal
          isOpen={isTimerModalOpen}
          onClose={() => setIsTimerModalOpen(false)}
          element={selectedTimer}
          onUpdate={handleTimerUpdate}
          onAddTime={handleTimerAddTime}
        />
      )}
    </>
  );
};

export default DataControls;
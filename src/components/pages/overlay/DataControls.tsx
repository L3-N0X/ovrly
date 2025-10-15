import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimerEditModal } from "@/components/overlay/editor/TimerEditModal";
import type { PrismaElement, PrismaOverlay } from "@/lib/types";
import TimerControl from "./controls/TimerControl";
import CounterControl from "./controls/CounterControl";
import TitleControl from "./controls/TitleControl";

interface DataControlsProps {
  overlay: PrismaOverlay;
  handleCounterChange: (elementId: string, value: number) => void;
  handleTitleChange: (elementId: string, text: string) => void;
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
  handleTitleChange,
  handleTimerToggle,
  handleTimerReset,
  handleTimerUpdate,
  handleTimerAddTime,
  selectedTimer,
  setSelectedTimer,
}) => {
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);

  const editableElements = overlay.elements.filter(
    (el) => el.type === "COUNTER" || el.type === "TITLE" || el.type === "TIMER"
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
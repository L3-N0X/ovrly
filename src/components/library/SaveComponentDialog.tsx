import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMPONENTS_QUERY_KEY,
  droppedImagesMessage,
  exportComponent,
  saveComponent,
  type OverlayComponent,
  type SavedComponent,
} from "@/lib/components";
import type { PrismaElement } from "@/lib/types";
import { ComponentDetailsForm } from "./ComponentDetailsForm";

// Saves an element, with everything nested in it, as a component (from the layers context
// menu). Once saved, it offers the file to share it with.
export const SaveComponentDialog = ({
  overlayId,
  element,
  onClose,
}: {
  overlayId: string;
  // The element to save; null while the dialog is closed.
  element: PrismaElement | null;
  onClose: () => void;
}) => {
  // Kept while the dialog animates out, after `element` has been cleared.
  const [shown, setShown] = useState(element);
  if (element && element !== shown) setShown(element);

  return (
    <Dialog open={!!element} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {shown && (
          // Keyed, so every opening starts over.
          <SaveComponentSteps key={shown.id} overlayId={overlayId} element={shown} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
};

const SaveComponentSteps = ({
  overlayId,
  element,
  onClose,
}: {
  overlayId: string;
  element: PrismaElement;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<SavedComponent | null>(null);

  if (!saved) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Save as component</DialogTitle>
          <DialogDescription>
            “{element.name}” and everything in it is saved to your components. Add it to any
            overlay from “Add element”, or export it as a file to share.
          </DialogDescription>
        </DialogHeader>
        <ComponentDetailsForm
          initial={{ name: element.name, description: null }}
          submitLabel="Save component"
          onCancel={onClose}
          onSubmit={async (details) => {
            const component = await saveComponent(overlayId, element.id, details);
            queryClient.setQueryData<OverlayComponent[]>(COMPONENTS_QUERY_KEY, (current) =>
              current ? [component, ...current] : current
            );
            setSaved(component);
          }}
        />
      </>
    );
  }

  const dropped = droppedImagesMessage(saved.droppedImages);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Check className="size-5 text-emerald-500" />
          Component saved
        </DialogTitle>
        <DialogDescription>
          “{saved.name}” is in your components now. Changing “{element.name}” from here on doesn't
          change the component.
        </DialogDescription>
      </DialogHeader>
      {dropped && (
        <p className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          {dropped}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => exportComponent(saved)}>
          <Download />
          Export file
        </Button>
        <Button autoFocus onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
};

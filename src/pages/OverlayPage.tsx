import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ShieldOff } from "lucide-react";
import { BingoDataProvider } from "@/lib/hooks/useBingoData";
import FontLoader from "@/components/FontLoader";
import type { PrismaOverlay, BaseElementStyle } from "@/lib/types";
import { fontFamilyOf, fontWeightOf, type FontWeight } from "@/lib/fonts";
import { UNDO_DELETE_MS, useOverlayData } from "@/lib/hooks/useOverlayData";
import { ElementListEditor } from "@/components/overlay/editor/elementlist/ElementListEditor";
import { subtreeOf } from "@/components/overlay/editor/elementlist/tree";
import OverlayHeader from "@/components/pages/overlay/OverlayHeader";
import EditorCanvas from "@/components/pages/overlay/EditorCanvas";
import Inspector from "@/components/pages/overlay/Inspector";
import type { ContentHandlers } from "@/components/pages/overlay/controls/ElementContentControl";
import type { EditorSelection } from "@/components/pages/overlay/editorSelection";
import ControlView from "@/components/pages/overlay/ControlView";
import { PanelTabs } from "@/components/pages/overlay/PanelTabs";
import { VariablesPanel } from "@/components/variables/VariablesPanel";
import { VariablesProvider } from "@/components/variables/VariablesProvider";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/sharing";
import { DeleteElementDialog, UndoDeleteToast } from "@/components/pages/overlay/ElementDeletion";

const OverlayPage: React.FC = () => {
  const {
    id,
    overlay,
    access,
    role,
    isLoading,
    error,
    handleOverlayChange,
    handleStructureChange,
    handleDeleteElements,
    handleUndoDelete,
    handleCounterChange,
    handleCounterIncrement,
    handleTitleChange,
    handleImageChange,
    handleIconChange,
    handleBingoDataChange,
    handleTimerToggle,
    handleTimerReset,
    handleTimerAddTime,
    handleCountdownAction,
    handleDeleteOverlay,
    handleBindingChange,
    variablesVersion,
  } = useOverlayData();
  const navigate = useNavigate();
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  // Shared by the canvas, the layers panel and the inspector.
  const [selectedId, setSelectedId] = useState<EditorSelection>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  // The right hand panel: the selection's settings, or the owner's variables.
  const [panel, setPanel] = useState<"editor" | "variables">("editor");
  const showVariables = useCallback(() => setPanel("variables"), []);
  // Picking something on the canvas or in the layers panel brings its settings back.
  const select = useCallback((selection: EditorSelection) => {
    setSelectedId(selection);
    if (selection) setPanel("editor");
  }, []);
  // The element waiting for the user to confirm its deletion.
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);
  // The latest deletion, while it can still be undone.
  const [lastDeletion, setLastDeletion] = useState<NonNullable<
    ReturnType<typeof handleDeleteElements>
  > | null>(null);

  const content = useMemo<ContentHandlers>(
    () => ({
      onCounterChange: handleCounterChange,
      onCounterIncrement: handleCounterIncrement,
      onTitleChange: handleTitleChange,
      onImageChange: handleImageChange,
      onIconChange: handleIconChange,
      onBingoDataChange: handleBingoDataChange,
      onTimerToggle: handleTimerToggle,
      onTimerReset: handleTimerReset,
      onTimerAddTime: handleTimerAddTime,
      onCountdownAction: handleCountdownAction,
    }),
    [
      handleCounterChange,
      handleCounterIncrement,
      handleTitleChange,
      handleImageChange,
      handleIconChange,
      handleBingoDataChange,
      handleTimerToggle,
      handleTimerReset,
      handleTimerAddTime,
      handleCountdownAction,
    ]
  );

  // Each selection starts at the top of its settings.
  useEffect(() => {
    inspectorRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  const deleteRequest = useMemo(
    () => (overlay && deleteRequestId ? subtreeOf(overlay.elements, deleteRequestId) : []),
    [overlay, deleteRequestId]
  );

  const confirmDelete = () => {
    setDeleteRequestId(null);
    const deletion = handleDeleteElements(deleteRequest.map((el) => el.id));
    if (!deletion) return;
    if (deletion.elements.some((el) => el.id === selectedId)) setSelectedId(null);
    setLastDeletion(deletion);
  };

  const undoDelete = useCallback(() => {
    if (!lastDeletion) return;
    if (handleUndoDelete(lastDeletion)) setSelectedId(lastDeletion.elements[0]?.id ?? null);
    setLastDeletion(null);
  }, [lastDeletion, handleUndoDelete]);

  const dismissUndo = useCallback(() => setLastDeletion(null), []);

  const handleToggleShareModal = () => {
    setShareModalOpen(!isShareModalOpen);
  };

  // Every font the overlay's text needs, fetched before it is painted so the canvas doesn't
  // flash a fallback. Renderers fill in the default family, so elements without a stored
  // font count too.
  const loadOverlayFonts = (overlayData: PrismaOverlay | null) => {
    if (!overlayData) return null;

    // Keyed so a family used at two weights is only asked for once per weight.
    const fonts = new Map<string, { fontFamily: string; fontWeight: FontWeight }>();
    overlayData.elements.forEach((element) => {
      const style = element.style as BaseElementStyle | null;
      const fontFamily = fontFamilyOf(style);
      const fontWeight = fontWeightOf(style);
      fonts.set(`${fontFamily}:${fontWeight}`, { fontFamily, fontWeight });
    });

    return Array.from(fonts, ([key, font]) => <FontLoader key={key} {...font} />);
  };

  if (isLoading)
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  if (error || !overlay || !id || !role)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border bg-card">
          <ShieldOff className="size-5 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">Can't open this overlay</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {error ?? "This overlay doesn't exist, or it isn't shared with you."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Back to overlays</Link>
        </Button>
      </div>
    );

  const canEdit = hasRole(role, "EDITOR");
  const canControl = hasRole(role, "CONTROLLER");

  const page = (
    <>
      {loadOverlayFonts(overlay)}
      {/* Full screen on large displays, with each panel scrolling on its own. Smaller screens
          stack canvas, inspector and layers and scroll as a whole. */}
      <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
        <OverlayHeader
          overlay={overlay}
          id={id}
          role={role}
          memberCount={access ? access.members.length + 1 : undefined}
          onShare={handleToggleShareModal}
          onOverlayUpdate={handleOverlayChange}
          onDelete={handleDeleteOverlay}
        />
        {!canEdit ? (
          <ControlView
            overlay={overlay}
            role={canControl ? "CONTROLLER" : "VIEWER"}
            content={content}
            ownerName={access?.owner.name}
            panel={panel}
            onPanelChange={setPanel}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside
              aria-label="Layers"
              className="order-3 shrink-0 border-t bg-background lg:order-1 lg:w-64 lg:overflow-y-auto lg:border-t-0 lg:border-r"
            >
              <ElementListEditor
                overlay={overlay}
                onOverlayChange={handleOverlayChange}
                onStructureChange={handleStructureChange}
                selectedId={selectedId}
                onSelect={select}
              />
            </aside>
            <main className="order-1 h-[55vh] shrink-0 lg:order-2 lg:h-auto lg:min-w-0 lg:flex-1 lg:shrink">
              <EditorCanvas
                overlay={overlay}
                onOverlayChange={handleOverlayChange}
                onStructureChange={handleStructureChange}
                selectedId={selectedId}
                onSelect={select}
                onRequestDelete={setDeleteRequestId}
                ownerName={access?.owner.name ?? null}
              />
            </main>
            <aside
              aria-label="Inspector"
              className="order-2 flex shrink-0 flex-col border-t bg-background lg:order-3 lg:w-[340px] lg:border-t-0 lg:border-l xl:w-[360px]"
            >
              <PanelTabs label="Panel" tabs={PANEL_TABS} value={panel} onValueChange={setPanel} />
              <div ref={inspectorRef} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {panel === "editor" ? (
                  <Inspector
                    overlay={overlay}
                    selectedId={selectedId}
                    onSelect={select}
                    onOverlayChange={handleOverlayChange}
                    onRequestDelete={setDeleteRequestId}
                    content={content}
                  />
                ) : (
                  <VariablesPanel overlay={overlay} />
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
      <DeleteElementDialog
        elements={deleteRequest.length > 0 ? deleteRequest : null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRequestId(null)}
      />
      {lastDeletion && (
        <UndoDeleteToast
          // A new deletion restarts the countdown.
          key={lastDeletion.key}
          name={lastDeletion.elements[0]?.name ?? "element"}
          duration={UNDO_DELETE_MS}
          onUndo={undoDelete}
          onDismiss={dismissUndo}
        />
      )}
      <ShareDialog
        overlayId={id}
        overlayName={overlay.name}
        open={isShareModalOpen}
        onOpenChange={setShareModalOpen}
        onLeft={() => navigate("/")}
      />
    </>
  );

  // Without the providers the canvas treats bingo cards as read only and fields can't be bound;
  // viewers can't see the owner's variables.
  return canControl ? (
    <VariablesProvider
      overlayId={id}
      version={variablesVersion}
      canControl={canControl}
      canEdit={canEdit}
      onBind={handleBindingChange}
      showVariables={showVariables}
    >
      <BingoDataProvider onBingoDataChange={handleBingoDataChange}>{page}</BingoDataProvider>
    </VariablesProvider>
  ) : (
    page
  );
};

const PANEL_TABS = [
  { value: "editor", label: "Editor" },
  { value: "variables", label: "Variables" },
] as const;

export default OverlayPage;

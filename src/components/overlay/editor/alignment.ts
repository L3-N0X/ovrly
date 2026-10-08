import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  AlignVerticalSpaceBetween,
  Baseline,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";
import type { SegmentedOption } from "@/components/ui/segmented-control";

// Options for flex alignment whose icons follow the direction: justify-content runs along the
// main axis and align-items across it, so in a column "start" is the top for one and the left
// for the other.

export const isRowDirection = (direction: string | undefined) => !!direction?.startsWith("row");

export const justifyOptions = (row: boolean) =>
  [
    { value: "flex-start", label: "Start", icon: row ? AlignHorizontalJustifyStart : AlignVerticalJustifyStart },
    { value: "center", label: "Center", icon: row ? AlignHorizontalJustifyCenter : AlignVerticalJustifyCenter },
    { value: "flex-end", label: "End", icon: row ? AlignHorizontalJustifyEnd : AlignVerticalJustifyEnd },
    { value: "space-between", label: "Space between", icon: row ? AlignHorizontalSpaceBetween : AlignVerticalSpaceBetween },
    { value: "space-around", label: "Space around", icon: row ? AlignHorizontalSpaceAround : AlignVerticalSpaceAround },
    { value: "space-evenly", label: "Space evenly", icon: row ? AlignHorizontalDistributeCenter : AlignVerticalDistributeCenter },
  ] satisfies SegmentedOption<string>[];

export const alignOptions = (row: boolean, { stretch = false }: { stretch?: boolean } = {}) =>
  [
    { value: "flex-start", label: row ? "Top" : "Left", icon: row ? AlignStartHorizontal : AlignStartVertical },
    { value: "center", label: "Center", icon: row ? AlignCenterHorizontal : AlignCenterVertical },
    { value: "flex-end", label: row ? "Bottom" : "Right", icon: row ? AlignEndHorizontal : AlignEndVertical },
    ...(stretch
      ? [{ value: "stretch", label: "Stretch", icon: row ? StretchVertical : StretchHorizontal }]
      : []),
    { value: "baseline", label: "Baseline", icon: Baseline },
  ] satisfies SegmentedOption<string>[];

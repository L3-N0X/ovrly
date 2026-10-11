import React, { useMemo } from "react";
import type { PrismaElement, VideoStyle } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { DEFAULT_VIDEO_VOLUME, videoLoops } from "@/lib/video";
import { SizeField } from "./appearance";
import { FIXED_OR_FILL, fixedOrFill, sizeModePatch } from "./sizing";

interface VideoStyleEditorProps {
  element: PrismaElement;
  onChange: (style: VideoStyle) => void;
}

const VideoStyleEditor: React.FC<VideoStyleEditorProps> = ({ element, onChange }) => {
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as VideoStyle) || {}, [element.style]);
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle);

  const updateStyle = (patch: Partial<VideoStyle>) => {
    const newStyle = { ...style, ...patch };
    setStyle(newStyle);
    onChange(newStyle);
  };

  const id = (name: string) => `${element.id}-video-${name}`;

  return (
    <div className="space-y-4">
      <SizeField
        id={id("width")}
        label={"Width"}
        property="style.width"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "width")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "width", mode, 100))}
        min={1}
        value={style.width || 100}
        onChange={(width) => updateStyle({ width })}
      />
      <SizeField
        id={id("height")}
        label={"Height"}
        property="style.height"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "height")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "height", mode, 100))}
        min={1}
        value={style.height || 100}
        onChange={(height) => updateStyle({ height })}
      />
      <div className="grid grid-cols-2 gap-4">
        <BindableField property="style.borderRadius" label="Border Radius" htmlFor={id("radius")}>
          <NumberField
            id={id("radius")}
            value={style.borderRadius || 0}
            min={0}
            unit="px"
            onChange={(borderRadius) => updateStyle({ borderRadius })}
          />
        </BindableField>
        <div className="space-y-2">
          <Label htmlFor={id("fit")}>Object Fit</Label>
          <SegmentedControl
            id={id("fit")}
            aria-label="Object fit"
            value={style.objectFit || "cover"}
            onValueChange={(objectFit) => updateStyle({ objectFit })}
            options={[
              { value: "cover", label: "Cover" },
              { value: "contain", label: "Contain" },
            ]}
          />
        </div>
      </div>
      <BindableField
        inline
        htmlFor={id("loop")}
        label={
          <>
            Loop
            <span className="ml-1 font-normal text-muted-foreground">(else it stops at the end)</span>
          </>
        }
      >
        <Switch
          id={id("loop")}
          checked={videoLoops(style)}
          onCheckedChange={(loop) => updateStyle({ loop })}
        />
      </BindableField>
      <BindableField
        inline
        htmlFor={id("hide")}
        label={
          <>
            Hide when not playing
            <span className="ml-1 font-normal text-muted-foreground">(paused, stopped or ended)</span>
          </>
        }
      >
        <Switch
          id={id("hide")}
          checked={style.hideWhenStopped === true}
          onCheckedChange={(hideWhenStopped) => updateStyle({ hideWhenStopped })}
        />
      </BindableField>
      <BindableField
        property="style.muted"
        inline
        htmlFor={id("muted")}
        label={
          <>
            Mute
            <span className="ml-1 font-normal text-muted-foreground">(sound only plays in OBS)</span>
          </>
        }
      >
        <Switch
          id={id("muted")}
          checked={style.muted === true}
          onCheckedChange={(muted) => updateStyle({ muted })}
        />
      </BindableField>
      <BindableField property="style.volume" label="Volume" htmlFor={id("volume")}>
        <NumberField
          id={id("volume")}
          value={style.volume ?? DEFAULT_VIDEO_VOLUME}
          min={0}
          max={100}
          unit="%"
          progress
          disabled={style.muted === true}
          onChange={(volume) => updateStyle({ volume })}
        />
      </BindableField>
    </div>
  );
};

export default VideoStyleEditor;

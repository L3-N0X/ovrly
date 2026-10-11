import React from "react";
import { Volume2 } from "lucide-react";
import type { PrismaElement, VideoStyle } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import { DEFAULT_VIDEO_VOLUME, videoLoops } from "@/lib/video";
import {
  CornerRadiusProp,
  EffectsSection,
  Field,
  FieldGrid,
  InspectorSection,
  NumberProp,
  SizeModeFields,
} from "./fields";
import { useStyleDraft } from "./useStyleDraft";

interface VideoStyleEditorProps {
  element: PrismaElement;
  onChange: (style: VideoStyle) => void;
}

const VideoStyleEditor: React.FC<VideoStyleEditorProps> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-video`;

  return (
    <>
      <InspectorSection title="Layout">
        <SizeModeFields
          elementId={element.id}
          style={style}
          defaultSize={{ width: 100, height: 100 }}
          onChange={update}
        />
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="borderRadius"
            value={style.borderRadius || 0}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
        <Field label="Fit" htmlFor={`${id}-fit`}>
          <SegmentedControl
            id={`${id}-fit`}
            aria-label="Object fit"
            size="sm"
            stretch
            value={style.objectFit || "cover"}
            onValueChange={(objectFit) => update({ objectFit })}
            options={[
              { value: "cover", label: "Cover" },
              { value: "contain", label: "Contain" },
            ]}
          />
        </Field>
      </InspectorSection>
      <InspectorSection title="Playback">
        <BindableField
          inline
          htmlFor={`${id}-loop`}
          label={
            <>
              Loop
              <span className="ml-1 font-normal text-muted-foreground">
                (else it stops at the end)
              </span>
            </>
          }
        >
          <Switch
            id={`${id}-loop`}
            checked={videoLoops(style)}
            onCheckedChange={(loop) => update({ loop })}
          />
        </BindableField>
        <BindableField
          inline
          htmlFor={`${id}-hide`}
          label={
            <>
              Hide when not playing
              <span className="ml-1 font-normal text-muted-foreground">
                (paused, stopped or ended)
              </span>
            </>
          }
        >
          <Switch
            id={`${id}-hide`}
            checked={style.hideWhenStopped === true}
            onCheckedChange={(hideWhenStopped) => update({ hideWhenStopped })}
          />
        </BindableField>
        <BindableField
          property="style.muted"
          inline
          htmlFor={`${id}-muted`}
          label={
            <>
              Mute
              <span className="ml-1 font-normal text-muted-foreground">
                (sound only plays in OBS)
              </span>
            </>
          }
        >
          <Switch
            id={`${id}-muted`}
            checked={style.muted === true}
            onCheckedChange={(muted) => update({ muted })}
          />
        </BindableField>
        <FieldGrid>
          <NumberProp
            id={`${id}-volume`}
            label="Volume"
            prefix={<Volume2 />}
            property="style.volume"
            min={0}
            max={100}
            unit="%"
            progress
            disabled={style.muted === true}
            value={style.volume ?? DEFAULT_VIDEO_VOLUME}
            onChange={(volume) => update({ volume })}
          />
        </FieldGrid>
      </InspectorSection>
      <EffectsSection id={id} style={style} colorProps={colorProps} onChange={update} />
    </>
  );
};

export default VideoStyleEditor;

import { FontPicker } from "@/components/FontPicker";
import { FontWeightPicker } from "@/components/FontWeightPicker";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import {
  CHAT_PLACEHOLDERS,
  CHAT_TIME_FORMAT_LABELS,
  chatChannelLogin,
  formatHas,
  toggleFormatPart,
} from "@/lib/chat/format";
import { DEFAULT_FONT_FAMILY, isFontWeight } from "@/lib/fonts";
import {
  CHAT_ANIMATION_DURATION_RANGE,
  CHAT_HIDE_AFTER_RANGE,
  CHAT_MAX_MESSAGES_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CHAT_ANIMATION_DURATION,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_FORMAT,
  DEFAULT_CHAT_GAP,
  DEFAULT_CHAT_HEIGHT,
  DEFAULT_CHAT_HIDE_AFTER,
  DEFAULT_CHAT_MAX_MESSAGES,
  DEFAULT_CHAT_NAME_COLOR,
  DEFAULT_CHAT_WIDTH,
  type ChatAnimation,
  type ChatStyle,
  type ChatTimeFormat,
  type PrismaElement,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ALargeSmall,
  AlignCenter,
  AlignLeft,
  AlignRight,
  BetweenHorizontalStart,
  Clock,
  Info,
  ListOrdered,
  Smile,
  SquareRoundCorner,
  Timer,
} from "lucide-react";
import React from "react";
import {
  ColorProp,
  CornerRadiusProp,
  EffectsSection,
  Field,
  FieldGrid,
  FieldHint,
  FillSection,
  InspectorSection,
  Letter,
  NumberProp,
  SectionAction,
  SizeModeFields,
  SMALL_CONTROL,
  StrokeSection,
  TextSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

const EDGE_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
] as const;

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
] as const;

const ANIMATION_LABELS: Record<ChatAnimation, string> = {
  "slide-left": "Slide in from the left",
  "slide-right": "Slide in from the right",
  rise: "Rise in",
  fade: "Fade in",
  pop: "Pop in",
  none: "No animation",
};

// One line of the format's help: a placeholder and what it stands for.
const FormatHelp = () => (
  <Popover>
    <PopoverTrigger aria-label="Format placeholders">
      <Info className="size-3 cursor-pointer" />
    </PopoverTrigger>
    <PopoverContent>
      <div className="space-y-2 text-sm">
        <p className="font-semibold">How a message is written</p>
        <ul className="space-y-1">
          {CHAT_PLACEHOLDERS.map((placeholder) => (
            <li key={placeholder.token}>
              <code className="font-mono font-semibold">{placeholder.token}</code>{" "}
              <span className="text-muted-foreground">{placeholder.description}</span>
            </li>
          ))}
        </ul>
        <p>
          Everything else is written as it is, in the divider color. For example{" "}
          <code className="font-mono">{"<{name}> | {message}"}</code> shows{" "}
          <span className="font-mono">{"<L3_N0X> | hello"}</span>.
        </p>
      </div>
    </PopoverContent>
  </Popover>
);

// The live Twitch chat of a channel: where it comes from, how messages are written and move,
// and how the box around them looks.
export const ChatEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ChatStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-chat`;

  const format = style.format ?? DEFAULT_CHAT_FORMAT;
  const showsTime = formatHas(format, "{time}");
  const fontSize = typeof style.fontSize === "number" ? style.fontSize : DEFAULT_CHAT_FONT_SIZE;
  const nameWeight = isFontWeight(style.nameFontWeight) ? style.nameFontWeight : 700;
  const useUserColors = style.useUserColors !== false;
  const hasBubble = !!style.messageBackgroundColor;
  const channelInvalid = !!style.channel?.trim() && !chatChannelLogin(style.channel);

  return (
    <>
      <InspectorSection title="Chat">
        <Field label="Twitch channel" htmlFor={`${id}-channel`}>
          <Input
            id={`${id}-channel`}
            value={style.channel ?? ""}
            placeholder="Your own channel"
            onChange={(event) => update({ channel: event.target.value || undefined })}
            className={cn("w-full", SMALL_CONTROL)}
            aria-invalid={channelInvalid}
          />
        </Field>
        <FieldHint>
          {channelInvalid
            ? "That isn't a Twitch name. Enter a name like “shroud” or a link to the channel."
            : "Leave it empty for the channel of the overlay's owner. The editor shows sample messages until someone writes in chat."}
        </FieldHint>
        <Field label="Emotes besides Twitch's">
          <div className="space-y-1.5">
            {(
              [
                ["sevenTv", "7TV"],
                ["bttv", "BetterTTV"],
                ["ffz", "FrankerFaceZ"],
              ] as const
            ).map(([key, label]) => (
              <BindableField key={key} inline htmlFor={`${id}-${key}`} label={label}>
                <Switch
                  id={`${id}-${key}`}
                  checked={style[key] !== false}
                  onCheckedChange={(on) => update({ [key]: on })}
                />
              </BindableField>
            ))}
          </div>
        </Field>
        <BindableField inline htmlFor={`${id}-hide-commands`} label="Hide commands (messages starting with !)">
          <Switch
            id={`${id}-hide-commands`}
            checked={style.hideCommands === true}
            onCheckedChange={(hideCommands) => update({ hideCommands })}
          />
        </BindableField>
        <Field label="Hide messages from" htmlFor={`${id}-hidden-users`}>
          <Input
            id={`${id}-hidden-users`}
            value={style.hiddenUsers ?? ""}
            placeholder="nightbot, streamelements"
            onChange={(event) => update({ hiddenUsers: event.target.value || undefined })}
            className={cn("w-full", SMALL_CONTROL)}
          />
        </Field>
      </InspectorSection>

      <InspectorSection title="Messages">
        <Field
          htmlFor={`${id}-format`}
          label={
            <>
              Format
              <FormatHelp />
            </>
          }
        >
          <Input
            id={`${id}-format`}
            value={format}
            onChange={(event) => update({ format: event.target.value })}
            className={cn("w-full font-mono", SMALL_CONTROL)}
          />
        </Field>
        <BindableField inline htmlFor={`${id}-badges`} label="Badges">
          <Switch
            id={`${id}-badges`}
            checked={formatHas(format, "{badges}")}
            onCheckedChange={(on) => update({ format: toggleFormatPart(format, "{badges}", on) })}
          />
        </BindableField>
        <BindableField inline htmlFor={`${id}-time`} label="Timestamp">
          <Switch
            id={`${id}-time`}
            checked={showsTime}
            onCheckedChange={(on) => update({ format: toggleFormatPart(format, "{time}", on) })}
          />
        </BindableField>
        <FieldGrid>
          {showsTime && (
            <Select
              value={style.timeFormat ?? "24h"}
              onValueChange={(timeFormat) => update({ timeFormat: timeFormat as ChatTimeFormat })}
            >
              <SelectTrigger id={`${id}-time-format`} aria-label="Time format" className={SMALL_CONTROL}>
                <span className="flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
                  <Clock />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CHAT_TIME_FORMAT_LABELS) as ChatTimeFormat[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {CHAT_TIME_FORMAT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showsTime && (
            <ColorProp
              id={`${id}-time-color`}
              label="Timestamp color"
              property="style.timeColor"
              value={style.timeColor || "#ffffff99"}
              onChange={(timeColor) => update({ timeColor })}
              {...colorProps}
            />
          )}
          <ColorProp
            id={`${id}-divider-color`}
            label="Divider color (the text between the placeholders)"
            property="style.dividerColor"
            value={style.dividerColor || style.color || "#ffffff"}
            onChange={(dividerColor) => update({ dividerColor })}
            {...colorProps}
          />
        </FieldGrid>
        <FieldGrid>
          <Field label="New messages at" htmlFor={`${id}-newest`}>
            <SegmentedControl
              id={`${id}-newest`}
              aria-label="New messages at"
              size="sm"
              stretch
              value={style.newestAt === "top" ? "top" : "bottom"}
              onValueChange={(newestAt) => update({ newestAt })}
              options={EDGE_OPTIONS}
            />
          </Field>
          <Field label="Align messages" htmlFor={`${id}-align`}>
            <SegmentedControl
              id={`${id}-align`}
              aria-label="Align messages"
              size="sm"
              stretch
              value={style.align === "top" ? "top" : "bottom"}
              onValueChange={(align) => update({ align })}
              options={EDGE_OPTIONS}
            />
          </Field>
        </FieldGrid>
        <FieldGrid>
          <NumberProp
            id={`${id}-max`}
            label="Most messages shown"
            prefix={<ListOrdered />}
            min={CHAT_MAX_MESSAGES_RANGE.min}
            max={CHAT_MAX_MESSAGES_RANGE.max}
            value={style.maxMessages ?? DEFAULT_CHAT_MAX_MESSAGES}
            onChange={(maxMessages) => update({ maxMessages })}
          />
        </FieldGrid>
        <BindableField inline htmlFor={`${id}-hide`} label="Remove messages after a while">
          <Switch
            id={`${id}-hide`}
            checked={style.hideMessages === true}
            onCheckedChange={(hideMessages) => update({ hideMessages })}
          />
        </BindableField>
        {style.hideMessages === true && (
          <FieldGrid>
            <NumberProp
              id={`${id}-hide-after`}
              label="Seconds a message is shown"
              prefix={<Timer />}
              min={CHAT_HIDE_AFTER_RANGE.min}
              max={CHAT_HIDE_AFTER_RANGE.max}
              unit="s"
              value={style.hideAfter ?? DEFAULT_CHAT_HIDE_AFTER}
              onChange={(hideAfter) => update({ hideAfter })}
            />
          </FieldGrid>
        )}
        <FieldGrid>
          <Field label="Animation" htmlFor={`${id}-animation`}>
            <Select
              value={style.animation ?? "slide-left"}
              onValueChange={(animation) => update({ animation: animation as ChatAnimation })}
            >
              <SelectTrigger id={`${id}-animation`} className={SMALL_CONTROL}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ANIMATION_LABELS) as ChatAnimation[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {ANIMATION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {style.animation !== "none" && (
            <Field label="Duration" htmlFor={`${id}-animation-duration`}>
              <NumberProp
                id={`${id}-animation-duration`}
                label="Animation duration"
                prefix={<Clock />}
                min={CHAT_ANIMATION_DURATION_RANGE.min}
                max={CHAT_ANIMATION_DURATION_RANGE.max}
                step={0.05}
                unit="s"
                value={style.animationDuration ?? DEFAULT_CHAT_ANIMATION_DURATION}
                onChange={(animationDuration) => update({ animationDuration })}
              />
            </Field>
          )}
        </FieldGrid>
        <BindableField inline htmlFor={`${id}-fade-edge`} label="Fade out at the cut-off edge">
          <Switch
            id={`${id}-fade-edge`}
            checked={style.fadeEdge === true}
            onCheckedChange={(fadeEdge) => update({ fadeEdge })}
          />
        </BindableField>
      </InspectorSection>

      <InspectorSection title="Layout">
        <SizeModeFields
          elementId={element.id}
          style={style}
          defaultSize={{ width: DEFAULT_CHAT_WIDTH, height: DEFAULT_CHAT_HEIGHT }}
          onChange={update}
        />
        <FieldGrid>
          <NumberProp
            id={`${id}-gap`}
            label="Gap between messages"
            prefix={<BetweenHorizontalStart />}
            property="style.gap"
            min={0}
            unit="px"
            value={style.gap ?? DEFAULT_CHAT_GAP}
            onChange={(gap) => update({ gap })}
          />
          <span />
          <NumberProp
            id={`${id}-padding-x`}
            label="Horizontal padding"
            prefix={<Letter>X</Letter>}
            property="style.paddingX"
            min={0}
            unit="px"
            value={style.paddingX ?? 0}
            onChange={(paddingX) => update({ paddingX })}
          />
          <NumberProp
            id={`${id}-padding-y`}
            label="Vertical padding"
            prefix={<Letter>Y</Letter>}
            property="style.paddingY"
            min={0}
            unit="px"
            value={style.paddingY ?? 0}
            onChange={(paddingY) => update({ paddingY })}
          />
        </FieldGrid>
      </InspectorSection>

      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="borderRadius"
            value={style.borderRadius ?? DEFAULT_BORDER_RADIUS}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
      </InspectorSection>

      <TextSection
        id={id}
        style={style}
        defaultFontSize={DEFAULT_CHAT_FONT_SIZE}
        previewWord="Hello chat"
        colorProps={colorProps}
        onChange={update}
      >
        <SegmentedControl
          aria-label="Text alignment"
          size="sm"
          value={style.textAlign ?? "left"}
          onValueChange={(textAlign) => update({ textAlign })}
          options={TEXT_ALIGN_OPTIONS}
        />
      </TextSection>
      <InspectorSection title="Emotes">
        <FieldGrid>
          <NumberProp
            id={`${id}-emote-size`}
            label="Emote height"
            prefix={<Smile />}
            property="style.emoteSize"
            min={8}
            unit="px"
            value={style.emoteSize ?? Math.round(fontSize * 1.6)}
            onChange={(emoteSize) => update({ emoteSize })}
          />
        </FieldGrid>
      </InspectorSection>

      <InspectorSection title="Names">
        <FontPicker
          id={`${id}-name-font-family`}
          value={style.nameFontFamily || style.fontFamily || DEFAULT_FONT_FAMILY}
          weight={nameWeight}
          onChange={(nameFontFamily) => update({ nameFontFamily })}
          previewWord="L3_N0X"
          className={cn("w-full font-normal", SMALL_CONTROL)}
        />
        <FieldGrid>
          <FontWeightPicker
            id={`${id}-name-font-weight`}
            value={nameWeight}
            onChange={(nameFontWeight) => update({ nameFontWeight })}
            className={SMALL_CONTROL}
          />
          <NumberProp
            id={`${id}-name-font-size`}
            label="Name font size"
            prefix={<ALargeSmall />}
            property="style.nameFontSize"
            min={1}
            unit="px"
            value={style.nameFontSize ?? fontSize}
            onChange={(nameFontSize) => update({ nameFontSize })}
          />
        </FieldGrid>
        <BindableField inline htmlFor={`${id}-user-colors`} label="Each chatter's own color">
          <Switch
            id={`${id}-user-colors`}
            checked={useUserColors}
            onCheckedChange={(on) => update({ useUserColors: on })}
          />
        </BindableField>
        {!useUserColors && (
          <ColorProp
            id={`${id}-name-color`}
            label="Name color"
            property="style.nameColor"
            value={style.nameColor || DEFAULT_CHAT_NAME_COLOR}
            onChange={(nameColor) => update({ nameColor })}
            {...colorProps}
          />
        )}
      </InspectorSection>

      <InspectorSection
        title="Message background"
        action={
          <SectionAction
            kind={hasBubble ? "remove" : "add"}
            label={hasBubble ? "Remove message background" : "Add message background"}
            onClick={() =>
              update({ messageBackgroundColor: hasBubble ? undefined : "#000000a0" })
            }
          />
        }
      >
        {hasBubble && (
            <FieldGrid>
              <ColorProp
                id={`${id}-message-background`}
                label="Message background"
                property="style.messageBackgroundColor"
                value={style.messageBackgroundColor || "#000000a0"}
                onChange={(messageBackgroundColor) => update({ messageBackgroundColor })}
                {...colorProps}
              />
              <NumberProp
                id={`${id}-message-radius`}
                label="Corner radius of each message"
                prefix={<SquareRoundCorner />}
                property="style.messageRadius"
                min={0}
                unit="px"
                value={style.messageRadius ?? 8}
                onChange={(messageRadius) => update({ messageRadius })}
              />
              <NumberProp
                id={`${id}-message-padding-x`}
                label="Horizontal padding of each message"
                prefix={<Letter>X</Letter>}
                min={0}
                unit="px"
                value={style.messagePaddingX ?? 10}
                onChange={(messagePaddingX) => update({ messagePaddingX })}
              />
              <NumberProp
                id={`${id}-message-padding-y`}
                label="Vertical padding of each message"
                prefix={<Letter>Y</Letter>}
                min={0}
                unit="px"
                value={style.messagePaddingY ?? 6}
                onChange={(messagePaddingY) => update({ messagePaddingY })}
              />
            </FieldGrid>
        )}
      </InspectorSection>

      <FillSection
        id={id}
        value={style.backgroundColor}
        colorProps={colorProps}
        onChange={(backgroundColor) => update({ backgroundColor })}
      />
      <StrokeSection
        id={id}
        color={style.borderColor}
        width={style.borderWidth ?? DEFAULT_BORDER_WIDTH}
        defaultColor={DEFAULT_BORDER_COLOR}
        colorProps={colorProps}
        onChange={update}
      />
      <EffectsSection
        id={id}
        style={style}
        spread={spreadFor(style.backgroundColor)}
        colorProps={colorProps}
        onChange={update}
      />
    </>
  );
};

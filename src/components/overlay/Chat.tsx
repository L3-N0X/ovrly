import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_FONT_FAMILY, isFontWeight, loadFont } from "@/lib/fonts";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CHAT_ANIMATION_DURATION,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_GAP,
  DEFAULT_CHAT_HEIGHT,
  DEFAULT_CHAT_HIDE_AFTER,
  DEFAULT_CHAT_MAX_MESSAGES,
  DEFAULT_CHAT_NAME_COLOR,
  DEFAULT_CHAT_WIDTH,
  type ChatAnimation,
  type ChatStyle,
  type PrismaElement,
} from "@/lib/types";
import type { Emote, EmoteMap } from "@/lib/chat/emotes";
import {
  chatChannelLogin,
  defaultNameColor,
  formatChatTime,
  messageFragments,
  parseChatFormat,
  parseHiddenUsers,
  type FormatPart,
} from "@/lib/chat/format";
import type { ChatMessage } from "@/lib/chat/irc";
import { useTwitchChat, type ChatBadge, type ChatEntry } from "@/lib/chat/useTwitchChat";
import { useCanvasEditing } from "./canvasEditing";
import { useCanvasSelection } from "./canvasSelection";
import { useChatPreview } from "./chatPreview";
import { useFill } from "./fill";
import { shadowStyle } from "./shadow";
import { textStyle } from "./textStyle";
import { useElementResize } from "./useElementResize";

const MIN_CHAT_SIZE = 40;
// Above this height emotes are drawn from their largest picture.
const LARGE_EMOTE_SIZE = 56;
// Settles softly, like a list making room.
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const POP_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// ---- Sample messages, shown in the editor until the real chat says something ---------------

const sampleMessage = (
  index: number,
  displayName: string,
  color: string,
  badges: string[],
  text: string,
  twitchEmotes: Record<string, string> = {},
  action = false
): ChatEntry => {
  // Twitch marks its emotes by code point position; the samples find theirs by name.
  const emotes = Object.entries(twitchEmotes).flatMap(([name, id]) => {
    const start = Array.from(text.slice(0, text.indexOf(name))).length;
    return text.includes(name) ? [{ id, start, end: start + Array.from(name).length - 1 }] : [];
  });
  return {
    message: {
      id: `sample-${index}`,
      login: displayName.toLowerCase(),
      displayName,
      color,
      badges,
      text,
      emotes,
      action,
      sentAt: Date.now() - (5 - index) * 47_000,
    },
    receivedAt: 0,
    leaving: false,
  };
};

const SAMPLE_ENTRIES: ChatEntry[] = [
  sampleMessage(0, "L3_N0X", "#FF7F50", ["broadcaster/1"], "Welcome in, chat! HeyGuys", { HeyGuys: "30259" }),
  sampleMessage(1, "PixelPal", "#1E90FF", ["moderator/1"], "this overlay looks so clean"),
  sampleMessage(2, "night_owl", "", ["subscriber/0"], "first time catching a stream live VoHiYo", {
    VoHiYo: "81274",
  }),
  sampleMessage(3, "SpeedySam", "#9ACD32", ["vip/1"], "that last run was insane SeemsGood", {
    SeemsGood: "64138",
  }),
  sampleMessage(4, "chat_enjoyer", "#DAA520", [], "waves at everyone Kappa", { Kappa: "25" }, true),
];

// ---- One message ---------------------------------------------------------------------------

interface LineStyle {
  parts: FormatPart[];
  timeFormat: ChatStyle["timeFormat"];
  nameStyle: React.CSSProperties;
  nameFallback: string;
  useUserColors: boolean;
  dividerColor: string | undefined;
  timeColor: string;
  emoteSize: number;
  bubble: React.CSSProperties | null;
}

const EmoteImage: React.FC<{ emote: Emote; size: number; overlay?: boolean }> = ({ emote, size, overlay }) => (
  <img
    src={size > LARGE_EMOTE_SIZE ? emote.largeUrl : emote.url}
    alt={emote.name}
    title={emote.name}
    draggable={false}
    style={{
      gridArea: "1 / 1",
      height: `${size}px`,
      width: "auto",
      justifySelf: "center",
      alignSelf: "center",
      // Zero width emotes can be wider than the one they sit on without pushing the text away.
      maxWidth: overlay ? "none" : undefined,
    }}
  />
);

// An emote in the flow of the text, with zero width ones stacked on top of it. Pulled into the
// line a little, so a tall emote doesn't push lines far apart.
const EmoteView: React.FC<{ emote: Emote; overlays: Emote[]; size: number }> = ({ emote, overlays, size }) => (
  <span
    style={{
      display: "inline-grid",
      verticalAlign: "middle",
      margin: `${-size * 0.18}px 0.08em`,
    }}
  >
    <EmoteImage emote={emote} size={size} />
    {overlays.map((overlay, index) => (
      <EmoteImage key={index} emote={overlay} size={size} overlay />
    ))}
  </span>
);

const MessageLine: React.FC<{
  message: ChatMessage;
  line: LineStyle;
  emotes: EmoteMap;
  badges: Record<string, ChatBadge>;
}> = ({ message, line, emotes, badges }) => {
  const fragments = useMemo(() => messageFragments(message, emotes), [message, emotes]);
  const nameColor = line.useUserColors
    ? message.color || defaultNameColor(message.login)
    : line.nameFallback;
  const shownBadges = message.badges.flatMap((key) => (badges[key] ? [{ key, ...badges[key] }] : []));

  return (
    <div style={line.bubble ?? undefined}>
      {line.parts.map((part, index) => {
        switch (part.kind) {
          case "time":
            return (
              <span key={index} style={{ color: line.timeColor }}>
                {formatChatTime(message.sentAt, line.timeFormat)}
              </span>
            );
          case "badges":
            return shownBadges.length > 0 ? (
              <span key={index} style={{ fontSize: line.nameStyle.fontSize }}>
                {shownBadges.map((badge) => (
                  <img
                    key={badge.key}
                    src={badge.url}
                    alt={badge.title}
                    title={badge.title}
                    draggable={false}
                    style={{
                      display: "inline-block",
                      height: "1em",
                      width: "1em",
                      verticalAlign: "-0.15em",
                      marginRight: "0.25em",
                    }}
                  />
                ))}
              </span>
            ) : null;
          case "name":
            return (
              <span key={index} style={{ ...line.nameStyle, color: nameColor }}>
                {message.displayName}
              </span>
            );
          case "text":
            return (
              <span key={index} style={{ color: line.dividerColor, whiteSpace: "pre-wrap" }}>
                {part.text}
              </span>
            );
          case "break":
            return <br key={index} />;
          case "message":
            return (
              <span
                key={index}
                // Twitch writes /me messages in the chatter's color.
                style={message.action ? { color: nameColor, fontStyle: "italic" } : undefined}
              >
                {fragments.map((fragment, fragmentIndex) =>
                  fragment.kind === "text" ? (
                    <React.Fragment key={fragmentIndex}>{fragment.text}</React.Fragment>
                  ) : (
                    <EmoteView
                      key={fragmentIndex}
                      emote={fragment.emote}
                      overlays={fragment.overlays}
                      size={line.emoteSize}
                    />
                  )
                )}
              </span>
            );
        }
      })}
    </div>
  );
};

// ---- Coming in and leaving -----------------------------------------------------------------

const enterFrames = (animation: ChatAnimation, fromBelow: boolean): Keyframe[] => {
  switch (animation) {
    case "slide-left":
      return [{ opacity: 0, transform: "translateX(-100%)" }, { opacity: 1, transform: "none" }];
    case "slide-right":
      return [{ opacity: 0, transform: "translateX(100%)" }, { opacity: 1, transform: "none" }];
    case "rise":
      return [
        { opacity: 0, transform: `translateY(${fromBelow ? 60 : -60}%)` },
        { opacity: 1, transform: "none" },
      ];
    case "pop":
      return [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }];
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
};

/**
 * A message in the list. A new one (`animate`) grows from nothing while its content comes in,
 * so the others glide aside instead of jumping; one that is `leaving` goes the same way back,
 * then calls `onGone`. `gap` is space on the side of the older messages, which grows and shrinks
 * along with it.
 */
const ChatItem = memo(function ChatItem({
  entry,
  animate,
  animation,
  durationMs,
  newestAtBottom,
  gap,
  origin,
  onGone,
  children,
}: {
  entry: ChatEntry;
  animate: boolean;
  animation: ChatAnimation;
  durationMs: number;
  newestAtBottom: boolean;
  gap: number;
  origin: string;
  onGone: (id: string) => void;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const still = animation === "none" || durationMs <= 0;

  // Coming in, once, when it is first drawn.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!animate || still || !outer || !inner) return;
    const height = outer.offsetHeight;
    // Only while it grows, so its emotes and shadows aren't cut off once it is in.
    outer.style.overflow = "hidden";
    const grow = outer.animate([{ height: "0px" }, { height: `${height}px` }], {
      duration: durationMs,
      easing: EASING,
    });
    const show = inner.animate(enterFrames(animation, newestAtBottom), {
      duration: durationMs,
      easing: animation === "pop" ? POP_EASING : EASING,
      fill: "backwards",
    });
    const done = () => {
      outer.style.overflow = "";
    };
    grow.onfinish = done;
    grow.oncancel = done;
    return () => {
      grow.cancel();
      show.cancel();
    };
    // The way in is decided when it arrives; later style changes don't replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving: its content goes first, then the room it took closes.
  const id = entry.message.id;
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!entry.leaving) return;
    if (still || !outer || !inner) {
      onGone(id);
      return;
    }
    const height = outer.offsetHeight;
    outer.style.overflow = "hidden";
    const hide = inner.animate([...enterFrames(animation, newestAtBottom)].reverse(), {
      duration: durationMs * 0.6,
      easing: EASING,
      fill: "forwards",
    });
    const collapse = outer.animate([{ height: `${height}px` }, { height: "0px" }], {
      duration: durationMs * 0.6,
      delay: durationMs * 0.4,
      easing: EASING,
      fill: "forwards",
    });
    collapse.onfinish = () => onGone(id);
    return () => {
      hide.cancel();
      collapse.cancel();
    };
  }, [entry.leaving, still, animation, durationMs, newestAtBottom, id, onGone]);

  return (
    <div ref={outerRef} style={{ flexShrink: 0 }}>
      <div
        ref={innerRef}
        style={{
          [newestAtBottom ? "paddingTop" : "paddingBottom"]: `${gap}px`,
          transformOrigin: origin,
        }}
      >
        {children}
      </div>
    </div>
  );
});

// ---- The chat ------------------------------------------------------------------------------

interface ChatProps {
  element: PrismaElement;
}

/**
 * The live Twitch chat of a channel (the overlay owner's unless another one is picked), with
 * Twitch, 7TV, BTTV and FFZ emotes. Messages are written in the element's format and stack up
 * from the side it is aligned to; once they fill the box, the oldest are cut off at the far side.
 * In the editor sample messages stand in until the chat says something.
 */
const Chat: React.FC<ChatProps> = ({ element }) => {
  const editing = useCanvasEditing();
  const inEditor = useCanvasSelection() !== null;
  const preview = useChatPreview();
  const style = (element.style || {}) as ChatStyle;

  const fill = useFill(element);
  const { dragSize, handle } = useElementResize(element, MIN_CHAT_SIZE, {
    width: !fill.width,
    height: !fill.height,
  });
  const width = dragSize?.width ?? toNumber(style.width, DEFAULT_CHAT_WIDTH);
  const height = dragSize?.height ?? toNumber(style.height, DEFAULT_CHAT_HEIGHT);

  const fontSize = toNumber(style.fontSize, DEFAULT_CHAT_FONT_SIZE);
  const gap = Math.max(0, toNumber(style.gap, DEFAULT_CHAT_GAP));
  const newestAtBottom = style.newestAt !== "top";
  const align = style.align === "top" ? "top" : "bottom";
  const animation: ChatAnimation = style.animation ?? "slide-left";
  const durationMs =
    Math.max(0, toNumber(style.animationDuration, DEFAULT_CHAT_ANIMATION_DURATION)) * 1000;
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const paddingX = Math.max(0, toNumber(style.paddingX, 0));
  const paddingY = Math.max(0, toNumber(style.paddingY, 0));

  const hiddenUsers = useMemo(() => parseHiddenUsers(style.hiddenUsers), [style.hiddenUsers]);
  const hideCommands = style.hideCommands === true;
  const isHidden = useCallback(
    (message: ChatMessage) =>
      hiddenUsers.has(message.login) || (hideCommands && message.text.trimStart().startsWith("!")),
    [hiddenUsers, hideCommands]
  );
  const providers = useMemo(
    () =>
      [
        style.sevenTv !== false && ("7tv" as const),
        style.bttv !== false && ("bttv" as const),
        style.ffz !== false && ("ffz" as const),
      ].filter((provider) => provider !== false),
    [style.sevenTv, style.bttv, style.ffz]
  );

  const chat = useTwitchChat({
    overlayId: preview ? null : (element.overlayId ?? null),
    login: chatChannelLogin(style.channel),
    providers,
    maxMessages: Math.max(1, Math.round(toNumber(style.maxMessages, DEFAULT_CHAT_MAX_MESSAGES))),
    hideAfterMs:
      style.hideMessages === true
        ? Math.max(1, toNumber(style.hideAfter, DEFAULT_CHAT_HIDE_AFTER)) * 1000
        : null,
    isHidden,
  });
  // The editor and previews show what messages will look like before anyone writes one.
  const samples = (inEditor || preview || !element.overlayId) && !chat.received;
  const entries = samples ? SAMPLE_ENTRIES : chat.entries;

  // Names may use a font of their own, which nothing else loads.
  const nameFamily = style.nameFontFamily || style.fontFamily || DEFAULT_FONT_FAMILY;
  const nameWeight = isFontWeight(style.nameFontWeight) ? style.nameFontWeight : 700;
  useEffect(() => {
    loadFont(nameFamily, nameWeight).catch((error) =>
      console.error(`Failed to load font: ${nameFamily}`, error)
    );
  }, [nameFamily, nameWeight]);

  const line = useMemo<LineStyle>(() => {
    const messageBackground = style.messageBackgroundColor;
    return {
      parts: parseChatFormat(style.format),
      timeFormat: style.timeFormat,
      nameStyle: {
        fontFamily: `"${nameFamily}"`,
        fontWeight: nameWeight,
        fontSize: `${toNumber(style.nameFontSize, fontSize)}px`,
      },
      nameFallback: style.nameColor || DEFAULT_CHAT_NAME_COLOR,
      useUserColors: style.useUserColors !== false,
      dividerColor: style.dividerColor,
      timeColor: style.timeColor || "#ffffff99",
      emoteSize: Math.max(8, toNumber(style.emoteSize, Math.round(fontSize * 1.6))),
      bubble: messageBackground
        ? {
            display: "inline-block",
            maxWidth: "100%",
            boxSizing: "border-box",
            textAlign: "left",
            backgroundColor: messageBackground,
            borderRadius: `${Math.max(0, toNumber(style.messageRadius, 8))}px`,
            padding: `${Math.max(0, toNumber(style.messagePaddingY, 6))}px ${Math.max(
              0,
              toNumber(style.messagePaddingX, 10)
            )}px`,
          }
        : null,
    };
  }, [
    style.format,
    style.timeFormat,
    style.nameFontSize,
    style.nameColor,
    style.useUserColors,
    style.dividerColor,
    style.timeColor,
    style.emoteSize,
    style.messageBackgroundColor,
    style.messageRadius,
    style.messagePaddingX,
    style.messagePaddingY,
    nameFamily,
    nameWeight,
    fontSize,
  ]);

  // While the messages fit, they sit at the side the chat is aligned to; once they don't, at the
  // side new ones come in at, so the newest stay in view and the oldest are cut off.
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;
    const measure = () =>
      // The list carries one gap too many, on the side of the oldest message (see ChatItem).
      setOverflows(list.offsetHeight - gap > viewport.clientHeight + 0.5);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(list);
    return () => observer.disconnect();
  }, [gap]);
  const anchor = overflows ? (newestAtBottom ? "bottom" : "top") : align;
  // That extra gap is pushed out of the box.
  const anchorOffset = (anchor === "top") === newestAtBottom ? -gap : 0;

  const textAlign = style.textAlign ?? "left";
  const origin = `${textAlign === "right" ? "right" : textAlign === "center" ? "center" : "left"} center`;
  const fade = style.fadeEdge === true;
  const fadeTowards = newestAtBottom ? "to bottom" : "to top";
  const mask = fade ? `linear-gradient(${fadeTowards}, transparent 0, #000 18%)` : undefined;

  return (
    <div
      style={{
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        boxSizing: "border-box",
        padding: `${paddingY}px ${paddingX}px`,
        backgroundColor: style.backgroundColor,
        borderRadius: `${toNumber(style.borderRadius, DEFAULT_BORDER_RADIUS)}px`,
        border:
          borderWidth > 0
            ? `${borderWidth}px solid ${style.borderColor || DEFAULT_BORDER_COLOR}`
            : undefined,
        ...fill.style,
        ...shadowStyle(style, { box: !!style.backgroundColor }),
      }}
      className={
        editing ? "outline-1 -outline-offset-1 outline-dashed outline-white/40" : undefined
      }
    >
      <div
        ref={viewportRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: "inherit",
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        <div
          ref={listRef}
          style={{
            ...textStyle(style, DEFAULT_CHAT_FONT_SIZE),
            lineHeight: 1.35,
            textAlign,
            overflowWrap: "anywhere",
            position: "absolute",
            left: 0,
            right: 0,
            [anchor]: `${anchorOffset}px`,
            display: "flex",
            flexDirection: newestAtBottom ? "column" : "column-reverse",
          }}
        >
          {entries.map((entry) => (
            <ChatItem
              key={entry.message.id}
              entry={entry}
              animate={!samples}
              animation={animation}
              durationMs={durationMs}
              newestAtBottom={newestAtBottom}
              gap={gap}
              origin={origin}
              onGone={chat.onGone}
            >
              <MessageLine
                message={entry.message}
                line={line}
                emotes={chat.emotes}
                badges={chat.badges}
              />
            </ChatItem>
          ))}
        </div>
      </div>
      {handle}
    </div>
  );
};

export default Chat;

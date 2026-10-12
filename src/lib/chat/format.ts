import { DEFAULT_CHAT_FORMAT, type ChatTimeFormat } from "../types";
import { twitchEmote, type Emote, type EmoteMap } from "./emotes";
import type { ChatMessage } from "./irc";

// How a chat element writes a message: a format with placeholders, and the message itself split
// into text and emotes.

export const CHAT_PLACEHOLDERS = [
  { token: "{name}", description: "The chatter's name" },
  { token: "{message}", description: "What they wrote, with emotes" },
  { token: "{badges}", description: "Their badges (moderator, subscriber, ...)" },
  { token: "{time}", description: "When they wrote it" },
  { token: "{br}", description: "A line break" },
] as const;

export type FormatPart =
  | { kind: "name" | "message" | "badges" | "time" | "break" }
  // Written as it is, between the placeholders: ": ", " | ", "<".
  | { kind: "text"; text: string };

const PLACEHOLDER = /\{(name|message|badges|time|br)\}/g;

/** The parts of a format; one without `{message}` gets it at the end, so messages never vanish. */
export const parseChatFormat = (format: string | undefined): FormatPart[] => {
  const source = format ?? DEFAULT_CHAT_FORMAT;
  const parts: FormatPart[] = [];
  let last = 0;
  for (const match of source.matchAll(PLACEHOLDER)) {
    if (match.index > last) parts.push({ kind: "text", text: source.slice(last, match.index) });
    const name = match[1];
    parts.push({ kind: name === "br" ? "break" : (name as "name" | "message" | "badges" | "time") });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ kind: "text", text: source.slice(last) });
  if (!parts.some((part) => part.kind === "message")) {
    parts.push({ kind: "text", text: " " }, { kind: "message" });
  }
  return parts;
};

/** Whether a format shows a placeholder. */
export const formatHas = (format: string | undefined, token: string) =>
  (format ?? DEFAULT_CHAT_FORMAT).includes(token);

/**
 * The format with a placeholder switched on or off: added at the start (badges go right before
 * the name, where Twitch shows them), or removed along with the space after it.
 */
export const toggleFormatPart = (format: string | undefined, token: "{badges}" | "{time}", on: boolean) => {
  const source = format ?? DEFAULT_CHAT_FORMAT;
  if (!on) return source.replace(new RegExp(`${token.replace(/[{}]/g, "\\$&")} ?`, "g"), "");
  if (source.includes(token)) return source;
  if (token === "{badges}" && source.includes("{name}")) return source.replace("{name}", "{badges}{name}");
  return token === "{time}" ? `{time} ${source}` : `${token}${source}`;
};

export type MessageFragment =
  | { kind: "text"; text: string }
  // `overlays` are zero width emotes drawn on top of it.
  | { kind: "emote"; emote: Emote; overlays: Emote[] };

const pushText = (fragments: MessageFragment[], text: string) => {
  if (!text) return;
  const last = fragments[fragments.length - 1];
  if (last?.kind === "text") last.text += text;
  else fragments.push({ kind: "text", text });
};

// Words of `text` that name an emote become one; a zero width one goes on top of the emote
// right before it (when there is one), dropping the space between them.
const pushWords = (fragments: MessageFragment[], text: string, emotes: EmoteMap) => {
  for (const word of text.split(/(\s+)/)) {
    const emote = word.trim() ? emotes.get(word) : undefined;
    if (!emote) {
      pushText(fragments, word);
      continue;
    }
    if (emote.zeroWidth) {
      const last = fragments[fragments.length - 1];
      const beforeSpace = last?.kind === "text" && !last.text.trim() ? fragments[fragments.length - 2] : last;
      if (beforeSpace?.kind === "emote") {
        if (beforeSpace !== last) fragments.pop();
        beforeSpace.overlays.push(emote);
        continue;
      }
    }
    fragments.push({ kind: "emote", emote, overlays: [] });
  }
};

/** A message as text and emotes: Twitch's (by the positions it sends), then 7TV/BTTV/FFZ's. */
export const messageFragments = (message: ChatMessage, emotes: EmoteMap): MessageFragment[] => {
  // Twitch counts positions in code points, so emoji before an emote don't shift it.
  const chars = Array.from(message.text);
  const ranges = [...message.emotes].sort((a, b) => a.start - b.start);
  const fragments: MessageFragment[] = [];
  let at = 0;
  for (const range of ranges) {
    if (range.start < at || range.end >= chars.length) continue;
    pushWords(fragments, chars.slice(at, range.start).join(""), emotes);
    const name = chars.slice(range.start, range.end + 1).join("");
    fragments.push({ kind: "emote", emote: twitchEmote(range.id, name), overlays: [] });
    at = range.end + 1;
  }
  pushWords(fragments, chars.slice(at).join(""), emotes);
  return fragments;
};

const TIME_FORMATS: Record<ChatTimeFormat, Intl.DateTimeFormatOptions> = {
  "24h": { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  "24h-seconds": { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" },
  "12h": { hour: "numeric", minute: "2-digit", hour12: true },
};

export const CHAT_TIME_FORMAT_LABELS: Record<ChatTimeFormat, string> = {
  "24h": "14:05",
  "24h-seconds": "14:05:09",
  "12h": "2:05 PM",
};

export const formatChatTime = (sentAt: number, format: ChatTimeFormat | undefined) =>
  new Date(sentAt).toLocaleTimeString([], TIME_FORMATS[format ?? "24h"] ?? TIME_FORMATS["24h"]);

// The colors Twitch gives chatters who never picked one, chosen the same way for the same name.
const DEFAULT_NAME_COLORS = [
  "#FF0000",
  "#0000FF",
  "#008000",
  "#B22222",
  "#FF7F50",
  "#9ACD32",
  "#FF4500",
  "#2E8B57",
  "#DAA520",
  "#D2691E",
  "#5F9EA0",
  "#1E90FF",
  "#FF69B4",
  "#8A2BE2",
  "#00FF7F",
];

export const defaultNameColor = (login: string) => {
  let hash = 0;
  for (const char of login) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return DEFAULT_NAME_COLORS[Math.abs(hash) % DEFAULT_NAME_COLORS.length];
};

/** Login names in a list typed as "nightbot, StreamElements" or one per line. */
export const parseHiddenUsers = (value: string | undefined) =>
  new Set(
    (value ?? "")
      .split(/[\s,;]+/)
      .map((name) => name.replace(/^@/, "").toLowerCase())
      .filter(Boolean)
  );

/** The Twitch login a chat's channel field names (a name, "@name" or a link); "" for none. */
export const chatChannelLogin = (value: string | undefined) => {
  const input = (value ?? "").trim();
  const link = input.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([^/?#\s]+)/i);
  const login = (link ? link[1] : input.replace(/^@/, "")).toLowerCase();
  return /^[a-z0-9_]{1,25}$/.test(login) ? login : "";
};

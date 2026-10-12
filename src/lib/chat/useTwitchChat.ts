import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { EMOTE_REFRESH_MS, loadEmotes, type EmoteMap } from "./emotes";
import { connectToChat, type ChatEvent, type ChatMessage } from "./irc";

// A chat badge as GET /api/public/overlays/:id/chat answers with it (services/chat.ts).
export interface ChatBadge {
  title: string;
  url: string;
  largeUrl: string;
}

interface ChatChannelInfo {
  channel: { id: string | null; login: string; displayName: string } | null;
  badges: Record<string, ChatBadge>;
}

// A message on screen. `leaving` ones are on their way out and gone once `onGone` is called.
export interface ChatEntry {
  message: ChatMessage;
  receivedAt: number;
  leaving: boolean;
}

// Messages already leaving are dropped outright past this many, should their animation never end
// (a tab in the background doesn't run them).
const LEAVING_LIMIT = 30;
// The channel a chat is set to may not be saved yet when it first asks for it.
const INFO_RETRIES = 5;
const INFO_RETRY_MS = 3000;

type Action =
  | { type: "add"; message: ChatMessage; max: number }
  | { type: "leave"; id: string }
  // Everything one chatter wrote (a timeout or ban), or everything (/clear) with no login.
  | { type: "clear"; login?: string }
  | { type: "expire"; olderThan: number }
  | { type: "gone"; id: string }
  | { type: "reset" };

// Starts the matching messages on their way out; the same list when none match.
const leave = (entries: ChatEntry[], matches: (entry: ChatEntry) => boolean) =>
  entries.some((entry) => !entry.leaving && matches(entry))
    ? entries.map((entry) => (!entry.leaving && matches(entry) ? { ...entry, leaving: true } : entry))
    : entries;

const reducer = (entries: ChatEntry[], action: Action): ChatEntry[] => {
  switch (action.type) {
    case "add": {
      const next = [...entries, { message: action.message, receivedAt: Date.now(), leaving: false }];
      // The oldest ones beyond the limit leave, so the count stays at it.
      let staying = next.filter((entry) => !entry.leaving).length;
      const trimmed = next.map((entry) => {
        if (staying <= action.max || entry.leaving) return entry;
        staying -= 1;
        return { ...entry, leaving: true };
      });
      const leaving = trimmed.filter((entry) => entry.leaving).length;
      if (leaving <= LEAVING_LIMIT) return trimmed;
      let drop = leaving - LEAVING_LIMIT;
      return trimmed.filter((entry) => !(entry.leaving && drop-- > 0));
    }
    case "leave":
      return leave(entries, (entry) => entry.message.id === action.id);
    case "clear":
      return leave(entries, (entry) => !action.login || entry.message.login === action.login);
    case "expire":
      return leave(entries, (entry) => entry.receivedAt <= action.olderThan);
    case "gone":
      return entries.filter((entry) => entry.message.id !== action.id);
    case "reset":
      return [];
  }
};

// `received` stays true once a message came in, even after they all left: until then the
// editor shows sample messages in their place.
interface ChatState {
  entries: ChatEntry[];
  received: boolean;
}

const chatReducer = (state: ChatState, action: Action): ChatState => {
  if (action.type === "reset") return { entries: [], received: false };
  const entries = reducer(state.entries, action);
  const received = state.received || action.type === "add";
  return entries === state.entries && received === state.received ? state : { entries, received };
};

export interface TwitchChatOptions {
  // Null for previews that aren't part of an overlay: they connect to nothing.
  overlayId: string | null;
  // The login a chat is set to; "" for the overlay owner's own channel.
  login: string;
  providers: ("7tv" | "bttv" | "ffz")[];
  maxMessages: number;
  // Milliseconds a message stays; null to keep it until it is pushed out.
  hideAfterMs: number | null;
  // Whether a message is left out (a bot, a command).
  isHidden: (message: ChatMessage) => boolean;
}

/**
 * The live chat of a channel: its messages (as they come in, leave and are deleted by
 * moderators), the badges and emotes to draw them with, and the channel being shown.
 */
export const useTwitchChat = ({
  overlayId,
  login,
  providers,
  maxMessages,
  hideAfterMs,
  isHidden,
}: TwitchChatOptions) => {
  const [{ entries, received }, dispatch] = useReducer(chatReducer, { entries: [], received: false });
  // Kept with what they were asked for, so a new channel never shows the last one's.
  const infoKey = `${overlayId}/${login}`;
  const [infoState, setInfo] = useState<{ key: string; info: ChatChannelInfo } | null>(null);
  const info = infoState?.key === infoKey ? infoState.info : null;
  const [roomState, setRoomId] = useState<{ login: string; roomId: string } | null>(null);
  const [emotes, setEmotes] = useState<EmoteMap>(new Map());

  // Read when a message comes in, so changing them doesn't reconnect.
  const settings = useRef({ maxMessages, isHidden });
  useEffect(() => {
    settings.current = { maxMessages, isHidden };
  });

  // Which channel, and its badges.
  useEffect(() => {
    if (!overlayId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = async (attempt: number) => {
      try {
        const query = login ? `?channel=${encodeURIComponent(login)}` : "";
        const response = await fetch(`/api/public/overlays/${overlayId}/chat${query}`);
        if (!response.ok) throw new Error(`Chat channel lookup failed (${response.status})`);
        const next = (await response.json()) as ChatChannelInfo;
        if (!cancelled) setInfo({ key: infoKey, info: next });
      } catch (error) {
        if (cancelled) return;
        if (attempt < INFO_RETRIES) {
          retryTimer = setTimeout(() => load(attempt + 1), INFO_RETRY_MS);
        } else {
          console.warn("[chat]", error);
          // The chat itself can still be read by name, only without badges.
          setInfo({
            key: infoKey,
            info: { channel: login ? { id: null, login, displayName: login } : null, badges: {} },
          });
        }
      }
    };
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [overlayId, login, infoKey]);

  const channelLogin = info?.channel?.login ?? null;
  const roomId = roomState && roomState.login === channelLogin ? roomState.roomId : null;

  // The messages.
  useEffect(() => {
    dispatch({ type: "reset" });
    if (!overlayId || !channelLogin) return;
    const onEvent = (event: ChatEvent) => {
      switch (event.type) {
        case "message":
          if (!settings.current.isHidden(event.message)) {
            dispatch({ type: "add", message: event.message, max: settings.current.maxMessages });
          }
          break;
        case "delete":
          dispatch({ type: "leave", id: event.messageId });
          break;
        case "clear-user":
          dispatch({ type: "clear", login: event.login });
          break;
        case "clear":
          dispatch({ type: "clear" });
          break;
        case "room":
          setRoomId({ login: channelLogin, roomId: event.roomId });
          break;
      }
    };
    return connectToChat(channelLogin, onEvent);
  }, [overlayId, channelLogin]);

  // Messages that have been shown long enough.
  useEffect(() => {
    if (hideAfterMs === null) return;
    const timer = setInterval(() => dispatch({ type: "expire", olderThan: Date.now() - hideAfterMs }), 250);
    return () => clearInterval(timer);
  }, [hideAfterMs]);

  // The emotes: global ones right away, the channel's once its id is known.
  const channelId = info?.channel?.id ?? roomId;
  const providerKey = [...providers].sort().join(",");
  useEffect(() => {
    let cancelled = false;
    const wanted = providerKey ? (providerKey.split(",") as TwitchChatOptions["providers"]) : [];
    const load = () =>
      loadEmotes(wanted, channelId).then((map) => {
        if (!cancelled) setEmotes(map);
      });
    load();
    const timer = setInterval(load, EMOTE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [providerKey, channelId]);

  const onGone = useCallback((id: string) => dispatch({ type: "gone", id }), []);

  return { entries, received, onGone, emotes, badges: info?.badges ?? {}, channel: info?.channel ?? null, loaded: info !== null };
};

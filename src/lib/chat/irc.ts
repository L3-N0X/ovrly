// Reads a channel's Twitch chat the way chat bots and OBS chat widgets do: over Twitch's IRC
// WebSocket, signed in anonymously (a "justinfan" name needs no token and can only read). Every
// browser showing a chat element opens its own connection, so the server has nothing to relay.

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
// Waits between reconnects grow up to this.
const MAX_RECONNECT_DELAY_MS = 30_000;

// A chat message, as the chat element shows it.
export interface ChatMessage {
  id: string;
  // Lower case; who it is from.
  login: string;
  displayName: string;
  // The color the chatter picked on Twitch; empty when they never did.
  color: string;
  // "<set>/<version>" ("subscriber/12"), in the order Twitch lists them.
  badges: string[];
  text: string;
  // Twitch emotes in `text`, by code point position (the "emotes" tag).
  emotes: TwitchEmoteRange[];
  // Sent with /me: Twitch shows it in the chatter's color.
  action: boolean;
  sentAt: number;
}

export interface TwitchEmoteRange {
  id: string;
  // Code point indices, both inclusive.
  start: number;
  end: number;
}

export type ChatEvent =
  | { type: "message"; message: ChatMessage }
  // A moderator removed one message, everything a chatter wrote (a timeout or ban), or
  // everything (/clear).
  | { type: "delete"; messageId: string }
  | { type: "clear-user"; login: string }
  | { type: "clear" }
  // The channel's id, which emote providers key their channel emotes by.
  | { type: "room"; roomId: string };

interface IrcLine {
  tags: Record<string, string>;
  prefix: string;
  command: string;
  params: string[];
}

const unescapeTag = (value: string) =>
  value.replace(/\\(.)/g, (_, char: string) =>
    char === "s" ? " " : char === ":" ? ";" : char === "r" ? "\r" : char === "n" ? "\n" : char
  );

export const parseIrcLine = (line: string): IrcLine | null => {
  let rest = line;
  const tags: Record<string, string> = {};
  if (rest.startsWith("@")) {
    const space = rest.indexOf(" ");
    for (const tag of rest.slice(1, space).split(";")) {
      const equals = tag.indexOf("=");
      if (equals === -1) tags[tag] = "";
      else tags[tag.slice(0, equals)] = unescapeTag(tag.slice(equals + 1));
    }
    rest = rest.slice(space + 1);
  }
  let prefix = "";
  if (rest.startsWith(":")) {
    const space = rest.indexOf(" ");
    prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }
  const trailingAt = rest.indexOf(" :");
  const head = trailingAt === -1 ? rest : rest.slice(0, trailingAt);
  const [command, ...params] = head.split(" ").filter(Boolean);
  if (!command) return null;
  if (trailingAt !== -1) params.push(rest.slice(trailingAt + 2));
  return { tags, prefix, command, params };
};

// "25:0-4,12-16/1902:6-10" into ranges.
const parseEmotes = (tag: string | undefined): TwitchEmoteRange[] =>
  (tag ?? "")
    .split("/")
    .filter(Boolean)
    .flatMap((entry) => {
      const [id, positions] = entry.split(":");
      return (positions ?? "").split(",").flatMap((range) => {
        const [start, end] = range.split("-").map(Number);
        return Number.isInteger(start) && Number.isInteger(end) ? [{ id, start, end }] : [];
      });
    });

const toMessage = (line: IrcLine): ChatMessage => {
  const login = line.prefix.split("!")[0] ?? "";
  let text = line.params[1] ?? "";
  // /me arrives as a CTCP ACTION: "\u0001ACTION waves\u0001".
  const action = text.startsWith("\u0001ACTION ") && text.endsWith("\u0001");
  if (action) text = text.slice(8, -1);
  const sentAt = Number(line.tags["tmi-sent-ts"]);
  return {
    id: line.tags.id || `${login}-${Date.now()}-${Math.random()}`,
    login,
    displayName: line.tags["display-name"] || login,
    color: line.tags.color ?? "",
    badges: (line.tags.badges ?? "").split(",").filter(Boolean),
    text,
    emotes: parseEmotes(line.tags.emotes),
    action,
    sentAt: Number.isFinite(sentAt) && sentAt > 0 ? sentAt : Date.now(),
  };
};

const eventOf = (line: IrcLine): ChatEvent | null => {
  switch (line.command) {
    case "PRIVMSG":
      return { type: "message", message: toMessage(line) };
    case "CLEARMSG":
      return line.tags["target-msg-id"] ? { type: "delete", messageId: line.tags["target-msg-id"] } : null;
    case "CLEARCHAT":
      return line.params[1] ? { type: "clear-user", login: line.params[1].toLowerCase() } : { type: "clear" };
    case "ROOMSTATE":
      return line.tags["room-id"] ? { type: "room", roomId: line.tags["room-id"] } : null;
    default:
      return null;
  }
};

/**
 * Joins the chat of `login` and calls `onEvent` with what happens in it until the returned
 * function is called. Reconnects by itself, waiting longer each time it fails.
 */
export const connectToChat = (login: string, onEvent: (event: ChatEvent) => void) => {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(open, delay);
  };

  function open() {
    if (closed) return;
    const current = new WebSocket(IRC_URL);
    socket = current;
    current.onopen = () => {
      current.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      current.send("PASS SCHMOOPIIE");
      current.send(`NICK justinfan${Math.floor(10000 + Math.random() * 89999)}`);
      current.send(`JOIN #${login}`);
    };
    current.onmessage = (event) => {
      for (const raw of String(event.data).split("\r\n")) {
        if (!raw) continue;
        const line = parseIrcLine(raw);
        if (!line) continue;
        if (line.command === "PING") {
          current.send(`PONG :${line.params[0] ?? "tmi.twitch.tv"}`);
        } else if (line.command === "RECONNECT") {
          // Twitch is about to restart this server; the close handler connects again.
          current.close();
        } else if (line.command === "JOIN") {
          attempt = 0;
        } else {
          const chatEvent = eventOf(line);
          if (chatEvent) onEvent(chatEvent);
        }
      }
    };
    current.onclose = () => {
      if (socket === current) socket = null;
      scheduleReconnect();
    };
    // Followed by a close, which reconnects.
    current.onerror = () => {};
  }

  open();
  return () => {
    closed = true;
    clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
  };
};

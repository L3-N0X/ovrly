import { prisma } from "../auth";
import { corsHeaders, json } from "../middleware/cors";
import { chatChannelInfo } from "../services/chat";
import { findOverlayWithElements } from "../services/overlay-query";
import { channelLoginFrom, isTwitchLogin } from "../services/twitch";

// The Twitch login a chat element shows; null for its owner's own channel.
const chatLoginOf = (style: unknown) => {
  const channel = (style as { channel?: unknown } | null)?.channel;
  const login = typeof channel === "string" ? channelLoginFrom(channel) : "";
  return isTwitchLogin(login) ? login : null;
};

export const handlePublicOverlaysRoutes = async (req: Request, path: string) => {
  // What the chats of an overlay need to show a channel: which one the owner's is, and its
  // badges (services/chat.ts). Public like the overlay, so only channels its chats show.
  const chatMatch = path.match(/^\/api\/public\/overlays\/([a-zA-Z0-9_-]+)\/chat$/);
  if (chatMatch && req.method === "GET") {
    const requested = channelLoginFrom(new URL(req.url).searchParams.get("channel") ?? "");
    const overlay = await prisma.overlay.findUnique({
      where: { id: chatMatch[1] },
      select: { userId: true, elements: { where: { type: "CHAT" }, select: { style: true } } },
    });
    if (!overlay) return json({ error: "Overlay not found" }, 404);
    const login = requested || null;
    if (!overlay.elements.some((element) => chatLoginOf(element.style) === login)) {
      return json({ error: "No chat of this overlay shows that channel" }, 404);
    }
    return json(await chatChannelInfo(overlay.userId, login));
  }

  const publicOverlayIdMatch = path.match(/^\/api\/public\/overlays\/([a-zA-Z0-9_-]+)$/);
  if (publicOverlayIdMatch) {
    const overlayId = publicOverlayIdMatch[1];
    const overlay = await findOverlayWithElements(overlayId);

    if (!overlay) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      return new Response(JSON.stringify(overlay), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  return null; // Return null if route doesn't match
};
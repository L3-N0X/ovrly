import { createContext, useContext } from "react";

// Provided by scaled down previews (the overlay cards on the home page): their chats show sample
// messages instead of each opening a connection to Twitch chat.
export const ChatPreviewContext = createContext(false);

export const useChatPreview = () => useContext(ChatPreviewContext);

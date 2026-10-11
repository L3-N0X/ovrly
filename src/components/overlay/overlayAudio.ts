import { createContext, useContext } from "react";

// Whether videos may play their sound. Only the public page (what OBS shows) turns it on, so the
// editor, the previews and the controls stay silent instead of playing it a second time.
export const OverlayAudioContext = createContext(false);

export const useOverlayAudio = () => useContext(OverlayAudioContext);

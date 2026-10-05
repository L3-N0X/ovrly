import { createContext, useContext } from "react";
import type { BingoDataUpdate } from "./bingo";

export type BingoDataChangeHandler = (elementId: string, data: BingoDataUpdate) => void;

/**
 * Lets the overlay canvas reach the page's bingo mutation handler.
 *
 * The canvas is rendered both by the editor (where mutating is allowed) and by
 * the public OBS page (where it is not), and it is a leaf component with no
 * access to `useOverlayData`. `BingoDataProvider` is mounted by the editor only,
 * so a `null` context is exactly the signal that the canvas is read only.
 */
export const BingoDataContext = createContext<BingoDataChangeHandler | null>(null);

export const useBingoDataChange = () => useContext(BingoDataContext);

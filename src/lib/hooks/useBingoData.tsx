import type { FC, ReactNode } from "react";
import { BingoDataContext, type BingoDataChangeHandler } from "@/lib/bingoDataContext";

export const BingoDataProvider: FC<{
  onBingoDataChange: BingoDataChangeHandler;
  children: ReactNode;
}> = ({ onBingoDataChange, children }) => (
  <BingoDataContext.Provider value={onBingoDataChange}>{children}</BingoDataContext.Provider>
);

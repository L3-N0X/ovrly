import React, { useEffect, useMemo, useState } from "react";
import { overlayVariablesApi, type VariablesResponse } from "@/lib/variables";
import { VariablesContext, type VariablesContextValue } from "@/lib/variablesContext";

interface VariablesProviderProps {
  overlayId: string;
  // Goes up whenever the owner's variables may have changed (useOverlayData).
  version: number;
  canControl: boolean;
  canEdit: boolean;
  onBind: VariablesContextValue["onBind"];
  showVariables?: () => void;
  children: React.ReactNode;
}

// Loads the variables of the overlay's owner and keeps them current: the server says when they
// change, on the overlay's WebSocket.
export const VariablesProvider: React.FC<VariablesProviderProps> = ({
  overlayId,
  version,
  canControl,
  canEdit,
  onBind,
  showVariables,
  children,
}) => {
  const api = useMemo(() => overlayVariablesApi(overlayId), [overlayId]);
  const [list, setList] = useState<VariablesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A slower, older answer must not replace a newer one.
    let current = true;
    api
      .list()
      .then((result) => {
        if (!current) return;
        setList(result);
        setError(null);
      })
      .catch((err: Error) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [api, version]);

  const value = useMemo<VariablesContextValue>(
    () => ({
      variables: list?.variables ?? null,
      sources: list?.sources ?? [],
      error,
      canControl,
      canEdit,
      api,
      setList,
      onBind,
      showVariables,
    }),
    [list, error, canControl, canEdit, api, onBind, showVariables]
  );

  return <VariablesContext.Provider value={value}>{children}</VariablesContext.Provider>;
};

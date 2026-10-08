import { createContext, useContext } from "react";
import type { PrismaElement } from "./types";
import type { overlayVariablesApi, Variable, VariableSource, VariablesResponse } from "./variables";

export type BindingTarget = { source: string; key: string };

/**
 * The variables of the open overlay's owner, for the variables tab and the variable pickers of
 * the fields that can be bound. Provided by `VariablesProvider` on the overlay page only, so a
 * field outside of it (or on the public page) is a plain field.
 */
export interface VariablesContextValue {
  // Null until loaded.
  variables: Variable[] | null;
  sources: VariableSource[];
  error: string | null;
  // Controllers change values and bind content; editors also create and delete variables, add
  // providers and bind style properties.
  canControl: boolean;
  canEdit: boolean;
  api: ReturnType<typeof overlayVariablesApi>;
  // Adopts a list a request returned.
  setList: (list: VariablesResponse) => void;
  // Binds a property of an element to a variable, or detaches it with null.
  onBind: (elementId: string, property: string, target: BindingTarget | null) => void;
  // Shows the variables tab, where variables are created.
  showVariables?: () => void;
}

export const VariablesContext = createContext<VariablesContextValue | null>(null);

export const useVariables = () => useContext(VariablesContext);

// The element whose fields are being edited, so the fields know what they bind.
export const BindingElementContext = createContext<PrismaElement | null>(null);

export const useBindingElement = () => useContext(BindingElementContext);

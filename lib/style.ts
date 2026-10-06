type StyleObject = Record<string, unknown>;

const isStyleObject = (value: unknown): value is StyleObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Applies a style patch: keys it contains replace the stored ones and `null` removes a key.
 * Clients send only the keys they changed, so two people changing different properties of
 * the same element (or overlay) at the same time both keep their change.
 */
export const mergeStyle = (existing: unknown, patch: StyleObject): StyleObject => {
  const merged: StyleObject = { ...(isStyleObject(existing) ? existing : {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return merged;
};

export { isStyleObject };

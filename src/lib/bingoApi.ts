import type { BingoDataUpdate } from "./bingo";

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json();
    if (body && typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Body was not JSON; fall through to the generic message.
  }
  return fallback;
};

const request = async (url: string, init: RequestInit, fallbackMessage: string) => {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", ...init });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackMessage));
  }

  return response;
};

export const patchElementData = async (elementId: string, data: BingoDataUpdate) => {
  const response = await request(
    `/api/elements/${elementId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    },
    "Failed to save the bingo card"
  );
  return response.json();
};

export const toggleBingoCell = async (elementId: string, index: number) => {
  const response = await request(
    `/api/bingo/${elementId}/toggle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    },
    "Failed to mark the bingo cell"
  );
  return response.json();
};

export const shuffleBingoCard = async (elementId: string) => {
  const response = await request(
    `/api/bingo/${elementId}/shuffle`,
    { method: "POST" },
    "Failed to shuffle the bingo card"
  );
  return response.json();
};

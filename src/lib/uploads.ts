/** Uploads an image to the user's files and returns its public URL. */
export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.url !== "string") {
    throw new Error(typeof body?.error === "string" ? body.error : "Failed to upload the image");
  }
  return body.url;
};

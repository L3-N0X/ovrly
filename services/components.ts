import { prisma } from "../auth";
import { OWN_TWITCH_SOURCE } from "../lib/bindings";
import { forEachComponentElement, type ComponentElement } from "../lib/components";
import { fileStorage, isValidStorageKey } from "./file-storage";

const UPLOADS_PREFIX = "/uploads/";

// The storage key of an image uploaded to ovrly, from its src: "/uploads/<key>", or the same
// with this server's address in front. Null for anything else.
const uploadKeyOf = (src: string) => {
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const path = src.startsWith(UPLOADS_PREFIX)
    ? src
    : base && src.startsWith(`${base}${UPLOADS_PREFIX}`)
      ? src.slice(base.length)
      : null;
  if (!path) return null;
  try {
    const key = decodeURIComponent(path.slice(UPLOADS_PREFIX.length));
    return isValidStorageKey(key) ? key : null;
  } catch {
    return null;
  }
};

const isWebLink = (src: string) => /^https?:\/\//i.test(src);

/**
 * Makes the images of a component the user's own, so they keep working whatever happens to
 * the ones they came from: uploads of someone else are copied into the user's files. Other
 * links are kept only with `keepLinks` (saving from an overlay the user edits); anything that
 * can't be copied is left out, for the user to add again. Answers with how many were left out.
 */
export const adoptComponentImages = async (
  elements: ComponentElement[],
  userId: string,
  { keepLinks }: { keepLinks: boolean }
) => {
  const images: { src: string }[] = [];
  forEachComponentElement(elements, (element) => {
    if (element.image?.src) images.push(element.image);
  });

  // The same picture used twice is copied once.
  const adopted = new Map<string, Promise<string | null>>();
  const adopt = async (src: string): Promise<string | null> => {
    const key = uploadKeyOf(src);
    if (!key) return keepLinks && isWebLink(src) ? src : null;
    const url = `${UPLOADS_PREFIX}${key}`;
    const own = await prisma.image.findFirst({ where: { userId, filename: key }, select: { id: true } });
    if (own) return url;
    try {
      const copy = await fileStorage.copy(key);
      try {
        await prisma.image.create({ data: { url: copy.url, filename: copy.filename, userId } });
      } catch (error) {
        await fileStorage.delete(copy.filename).catch(() => {});
        throw error;
      }
      return copy.url;
    } catch (error) {
      // Deleted in the meantime, from another server, or no storage: the image is left out.
      if ((error as { code?: string }).code !== "NoSuchKey") {
        console.error(`Could not copy the image ${key} of a component:`, error);
      }
      return null;
    }
  };

  let dropped = 0;
  for (const image of images) {
    if (!adopted.has(image.src)) adopted.set(image.src, adopt(image.src));
    const src = await adopted.get(image.src)!;
    if (!src) dropped++;
    image.src = src ?? "";
  }
  return dropped;
};

// The name of the source that shows the Twitch channel `userId` signed in with, if they added
// it ("twitch:<login>"). Read from the database only: nothing is looked up at Twitch.
const ownTwitchSourceName = async (userId: string) => {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "twitch" },
    select: { accountId: true },
  });
  if (!account) return null;
  const source = await prisma.variableSource.findFirst({
    where: { userId, provider: "TWITCH", externalId: account.accountId },
    select: { name: true },
  });
  return source?.name ?? null;
};

/**
 * Bindings to the own Twitch channel of the overlay's owner become bindings to OWN_TWITCH_SOURCE,
 * like in presets: wherever the component is added, it shows the channel of that overlay's owner.
 */
export const makeTwitchBindingsPortable = async (elements: ComponentElement[], ownerId: string) => {
  const own = await ownTwitchSourceName(ownerId);
  if (!own) return;
  forEachComponentElement(elements, (element) => {
    element.bindings = element.bindings?.map((binding) =>
      binding.source === own ? { ...binding, source: OWN_TWITCH_SOURCE } : binding
    );
  });
};

import { prisma } from '../auth';
import {
  fileStorage,
  contentTypeForKey,
  isValidStorageKey,
  StorageNotConfiguredError,
  UnsupportedFileError,
} from '../services/file-storage';
import { authenticate } from '../middleware/authMiddleware';
import { corsHeaders } from '../middleware/cors';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// The byte range a Range header asks for ("bytes=0-499", "bytes=500-", "bytes=-500"), with an
// exclusive end. Only single ranges are served; null for none (or several), which gets the whole
// file, and "unsatisfiable" for one that lies outside it.
const parseRange = (header: string | null, size: number) => {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const [start, end] = match[1]
    ? [Number(match[1]), match[2] ? Math.min(Number(match[2]) + 1, size) : size]
    : [Math.max(0, size - Number(match[2])), size];
  return start < end ? { start, end } : ('unsatisfiable' as const);
};

// Uploaded files are public by URL (OBS has no session), but the keys are random UUIDs.
// Object keys are immutable, so responses can be cached forever. The sandbox CSP keeps an
// uploaded SVG from running scripts if someone opens its URL directly. Ranges are served too,
// which browsers need to seek in videos (and to play them at all, in Safari).
export const handleUploadsRoutes = async (req: Request, path: string) => {
  const match = path.match(/^\/uploads\/(.+)$/);
  if (!match || (req.method !== 'GET' && req.method !== 'HEAD')) return null;

  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return new Response('Not Found', { status: 404 });
  }
  if (!isValidStorageKey(key)) return new Response('Not Found', { status: 404 });

  try {
    const file = fileStorage.get(key);
    const stat = await file.stat();
    const etag = `"${stat.etag.replace(/"/g, '')}"`;
    const headers = {
      'Content-Type': contentTypeForKey(key),
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
    };
    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    const range = parseRange(req.headers.get('range'), stat.size);
    if (range === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' },
      });
    }
    if (range) {
      return new Response(req.method === 'HEAD' ? null : file.slice(range.start, range.end).stream(), {
        status: 206,
        headers: {
          ...headers,
          'Content-Length': String(range.end - range.start),
          'Content-Range': `bytes ${range.start}-${range.end - 1}/${stat.size}`,
        },
      });
    }
    return new Response(req.method === 'HEAD' ? null : file.stream(), { headers });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      console.error(error.message);
      return new Response('Storage not configured', { status: 503 });
    }
    if ((error as { code?: string }).code === 'NoSuchKey') {
      return new Response('Not Found', { status: 404 });
    }
    console.error('Error serving upload:', error);
    return new Response('Failed to load file', { status: 502 });
  }
};

export const handleFilesRoutes = async (req: Request, path: string) => {
  // GET /api/files - Authenticated endpoint to list the current user's images
  if (path === '/api/files' && req.method === 'GET') {
    const session = await authenticate(req);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const params = new URL(req.url).searchParams;
      const requested = Number.parseInt(params.get('limit') ?? '', 10);
      const take = Math.min(Math.max(requested || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
      const cursor = params.get('cursor');

      const images = await prisma.image.findMany({
        where: { userId: session.user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      return new Response(JSON.stringify(images), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching images:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch images' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // POST /api/files/upload - Authenticated endpoint to upload a file
  if (path === '/api/files/upload' && req.method === 'POST') {
    const session = await authenticate(req);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const formData = await req.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'File not provided or is not a file' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { url, filename } = await fileStorage.save(file);

      let image;
      try {
        image = await prisma.image.create({
          data: {
            url,
            filename,
            userId: session.user.id,
          },
        });
      } catch (error) {
        // Don't leave an unreferenced object behind if the row could not be written.
        await fileStorage.delete(filename).catch(() => {});
        throw error;
      }

      return new Response(JSON.stringify(image), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof UnsupportedFileError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (error instanceof StorageNotConfiguredError) {
        console.error(error.message);
        return new Response(JSON.stringify({ error: 'File storage is not configured' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('File upload error:', error);
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // DELETE /api/files/:id - Authenticated endpoint to delete a file
  const deleteMatch = path.match(/^\/api\/files\/(.+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const session = await authenticate(req);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageId = deleteMatch[1];

    try {
      const image = await prisma.image.findUnique({
        where: { id: imageId },
      });

      if (!image) {
        return new Response(JSON.stringify({ error: 'Image not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (image.userId !== session.user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await fileStorage.delete(image.filename);
      await prisma.image.delete({ where: { id: imageId } });

      return new Response(null, { status: 204, headers: corsHeaders });
    } catch (error) {
      console.error('File deletion error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return null; // Return null if no route matches
};
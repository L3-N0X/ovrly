import { PrismaClient } from '@prisma/client';
import { auth } from '../auth';
import { fileStorage } from '../services/file-storage';
import { authenticate } from '../middleware/authMiddleware';
import { corsHeaders } from '../middleware/cors';

const prisma = new PrismaClient();

export const handleFilesRoutes = async (req: Request, path: string) => {
  // GET /api/files - Public endpoint to get all images
  if (path === '/api/files' && req.method === 'GET') {
    try {
      const images = await prisma.image.findMany();
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

      const image = await prisma.image.create({
        data: {
          url,
          filename,
          userId: session.user.id,
        },
      });

      return new Response(JSON.stringify(image), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
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
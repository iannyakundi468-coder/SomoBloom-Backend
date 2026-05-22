import { Hono } from 'hono';
import type { Bindings } from '../index';

export const mediaRouter = new Hono<{ Bindings: Bindings }>();

mediaRouter.post('/upload', async (c) => {
  if (!c.env.MEDIA_KV) {
    return c.json({ error: 'KV storage is currently unavailable' }, 500);
  }

  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 5MB limit' }, 400);
    }

    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Only image files are supported' }, 400);
    }

    const ext = file.name.split('.').pop() || 'png';
    const filename = `${crypto.randomUUID()}.${ext}`;

    await c.env.MEDIA_KV.put(filename, await file.arrayBuffer(), {
      metadata: {
        contentType: file.type,
      },
    });

    return c.json({
      message: 'File uploaded successfully',
      url: `/api/media/${filename}`
    }, 201);
  } catch (error: any) {
    console.error('Failed to upload file to KV:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

mediaRouter.get('/:key', async (c) => {
  const { key } = c.req.param();
  if (!c.env.MEDIA_KV) {
    return c.json({ error: 'KV storage is currently unavailable' }, 500);
  }

  try {
    const { value, metadata } = await c.env.MEDIA_KV.getWithMetadata<{contentType: string}>(key, 'arrayBuffer');
    if (!value) {
      return c.json({ error: 'File not found' }, 404);
    }

    const headers = new Headers();
    
    // Auto-detect standard content types
    const ext = key.split('.').pop()?.toLowerCase();
    if (metadata && metadata.contentType) {
      headers.set('Content-Type', metadata.contentType);
    } else if (ext === 'png') {
      headers.set('Content-Type', 'image/png');
    } else if (ext === 'jpg' || ext === 'jpeg') {
      headers.set('Content-Type', 'image/jpeg');
    } else if (ext === 'webp') {
      headers.set('Content-Type', 'image/webp');
    } else if (ext === 'gif') {
      headers.set('Content-Type', 'image/gif');
    }

    return new Response(value, {
      headers,
    });
  } catch (error: any) {
    console.error('Failed to retrieve file from KV:', error);
    return c.json({ error: 'Failed to retrieve file' }, 500);
  }
});

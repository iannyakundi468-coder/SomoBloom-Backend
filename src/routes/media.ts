import { Hono } from 'hono';
import type { Bindings } from '../index';

export const mediaRouter = new Hono<{ Bindings: Bindings }>();

mediaRouter.get('/:key', async (c) => {
  const { key } = c.req.param();
  if (!c.env.BUCKET) {
    return c.json({ error: 'R2 storage is currently unavailable' }, 500);
  }

  try {
    const object = await c.env.BUCKET.get(key);
    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // Auto-detect standard content types
    const ext = key.split('.').pop()?.toLowerCase();
    if (ext === 'png') {
      headers.set('Content-Type', 'image/png');
    } else if (ext === 'jpg' || ext === 'jpeg') {
      headers.set('Content-Type', 'image/jpeg');
    } else if (ext === 'webp') {
      headers.set('Content-Type', 'image/webp');
    } else if (ext === 'gif') {
      headers.set('Content-Type', 'image/gif');
    }

    return new Response(object.body, {
      headers,
    });
  } catch (error: any) {
    console.error('Failed to retrieve file from R2:', error);
    return c.json({ error: 'Failed to retrieve file' }, 500);
  }
});

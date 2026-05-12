import { Hono } from 'hono';
import type { Bindings } from '../../index';
import { generateText } from '../../ai';

export const studentRouter = new Hono<{ Bindings: Bindings }>();

studentRouter.get('/ping', (c) => c.json({ message: 'Student API operational' }));

// AI Text generation endpoint for students (e.g., homework helper)
studentRouter.post('/ask-tutor', async (c) => {
  const body = await c.req.json();
  const prompt = body.prompt;

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  try {
    const response = await generateText(c.env.AI, `You are a helpful and encouraging tutor for a student. Answer the following question:\n\n${prompt}`);
    return c.json({ response });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Add more student routes here
// e.g. viewing assignments, submitting homework

export async function generateText(ai: any, prompt: string): Promise<string> {
  // Using Llama 3 for text generation
  const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
    prompt,
  });

  return response.response;
}

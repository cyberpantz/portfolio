/**
 * AI assessment endpoint — upgrade path from pregenerated assessments.
 *
 * TO ACTIVATE:
 * 1. Add ANTHROPIC_API_KEY to Netlify environment variables
 * 2. Install the Netlify adapter:
 *      pnpm add @astrojs/netlify
 *    Then in astro.config.mjs:
 *      import netlify from '@astrojs/netlify';
 *      export default defineConfig({ output: 'hybrid', adapter: netlify(), ... })
 * 3. In Chooser.tsx, replace the ASSESSMENTS[key] lookup with:
 *      const res = await fetch('/.netlify/functions/assess', {
 *        method: 'POST',
 *        headers: { 'Content-Type': 'application/json' },
 *        body: JSON.stringify({ choices: choices.map(c => c.label) }),
 *      });
 *      const { assessment } = await res.json();
 *    Keep the existing lookup as a fallback for when the fetch fails.
 */

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { choices } = (await req.json()) as { choices: string[] };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `A person made these choices: ${choices.join(', ')}.
Write a single dry, sardonic 1–2 sentence personality assessment based on their choices.
Be specific to what they picked. No preamble, no labels, no quotation marks.`,
        },
      ],
    }),
  });

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : '';

  return new Response(JSON.stringify({ assessment: text }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/assess' };

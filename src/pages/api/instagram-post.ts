import type { APIRoute } from 'astro';
import { verifySession, SESSION_COOKIE } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(SESSION_COOKIE)?.value ?? '')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { imageUrl, caption } = (await request.json()) as {
    imageUrl: string;
    caption: string;
  };

  const igUserId = import.meta.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = import.meta.env.INSTAGRAM_ACCESS_TOKEN;

  if (!igUserId || !accessToken) {
    return new Response(JSON.stringify({ error: 'Instagram não configurado. Adicione INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID no .env' }), {
      status: 503,
    });
  }

  // Step 1: create media container
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  });
  const container = await containerRes.json() as { id?: string; error?: { message: string } };

  if (container.error || !container.id) {
    return new Response(
      JSON.stringify({ error: container.error?.message ?? 'Erro ao criar container' }),
      { status: 400 }
    );
  }

  // Step 2: publish
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  });
  const published = await publishRes.json() as { id?: string; error?: { message: string } };

  if (published.error) {
    return new Response(JSON.stringify({ error: published.error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ id: published.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

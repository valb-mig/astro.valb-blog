import { app } from '@/app';
import { json, route } from '@/app/http';

export const GET = route(async ({ url }) => json(await app.events.recent(url.searchParams.get('repo'))), true);

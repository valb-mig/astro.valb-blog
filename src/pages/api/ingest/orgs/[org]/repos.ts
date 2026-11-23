import { app } from '@/app';
import { json, route } from '@/app/http';

export const GET = route(async ({ params }) => json(await app.orgs.repos(params.org!)), true);

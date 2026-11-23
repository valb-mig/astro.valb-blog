import { app } from '@/app';
import { json, route } from '@/app/http';

export const GET = route(async () => json(await app.projects.repos()), true);

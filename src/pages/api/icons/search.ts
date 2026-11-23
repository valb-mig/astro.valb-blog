import { json, route } from '@/app/http';
import { search } from '@/infra/icons';

export const GET = route(({ url }) => json(search(url.searchParams.get('q') ?? '')), true);

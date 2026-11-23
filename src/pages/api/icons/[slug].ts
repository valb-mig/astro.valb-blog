import { json, route } from '@/app/http';
import { Fault } from '@/core/error';
import { svg } from '@/infra/icons';

export const GET = route(({ params }) => {
  const icon = svg(params.slug!);
  if (!icon) throw new Fault('missing', 'Not found');
  return json({ slug: params.slug, svg: icon });
}, true);

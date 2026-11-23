import { connect } from '@/infra/supabase/client';
import { env } from './env';

export const db = connect(env('SUPABASE_URL') as string, env('SUPABASE_SERVICE_ROLE_KEY') as string);

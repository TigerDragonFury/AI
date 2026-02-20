import { NextResponse } from 'next/server';
import { getSupabaseServerClient, isSupabaseConfigured } from './supabase-server';

export type AuthContext = {
  userId: string;
  email: string;
  isDevFallback: boolean;
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function requireRequestUser(request: Request): Promise<
  { ok: true; auth: AuthContext } | { ok: false; response: NextResponse }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      auth: { userId: 'dev-user', email: 'dev@localhost', isDevFallback: true }
    };
  }

  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return { ok: false, response: unauthorized('Missing bearer token.') };
  }

  const token = header.slice(7).trim();
  if (!token) {
    return { ok: false, response: unauthorized('Invalid bearer token.') };
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return { ok: false, response: unauthorized('Supabase is not configured.') };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: unauthorized('Authentication failed.') };
  }

  await client.from('users').upsert({
    id: data.user.id,
    email: data.user.email ?? `${data.user.id}@placeholder.local`
  });

  return {
    ok: true,
    auth: { userId: data.user.id, email: data.user.email ?? `${data.user.id}@placeholder.local`, isDevFallback: false }
  };
}

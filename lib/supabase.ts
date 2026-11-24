// Supabase（PostgREST）をサーバー側から fetch で呼び出す。キーはサーバーだけが持つ。
export function supabaseEnabled(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function sb(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // 旧形式(JWT)の service_role キー
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res;
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await sb(`/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

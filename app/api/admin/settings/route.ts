import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin.ts";
import { saveSettings, validateSettings } from "@/lib/settings.ts";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ログインし直してください" }, { status: 401 });
  const body = await req.json().catch(() => null);
  let s;
  try {
    s = validateSettings(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    await saveSettings(s);
    return NextResponse.json({ ok: true, settings: s });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "保存に失敗しました（データベースに接続できません）" }, { status: 502 });
  }
}

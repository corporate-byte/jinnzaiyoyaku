"use client";
import { useState } from "react";

export default function LineTestButton() {
  const [msg, setMsg] = useState("");
  return (
    <span>
      <button
        className="btn sm"
        onClick={async () => {
          setMsg("送信中…");
          const r = await fetch("/api/admin/line-test", { method: "POST" });
          const j = await r.json().catch(() => ({}));
          setMsg(r.ok ? `✅ ${j.sent}か所に送りました` : j.error || "送れませんでした");
        }}
      >
        LINEにテスト通知
      </button>
      {msg && <span className="small" style={{ marginLeft: 8 }}>{msg}</span>}
    </span>
  );
}

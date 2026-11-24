"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminCancelButton({ eventId, label }: { eventId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="link danger-text small"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`${label} の予約をキャンセルしますか？\nお客様にもGoogleからキャンセル通知が届きます。`)) return;
        setBusy(true);
        const r = await fetch("/api/admin/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) });
        setBusy(false);
        if (r.ok) router.refresh();
        else alert("キャンセルに失敗しました");
      }}
    >
      {busy ? "処理中…" : "キャンセル"}
    </button>
  );
}

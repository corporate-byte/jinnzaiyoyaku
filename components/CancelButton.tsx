"use client";
import { useState } from "react";

export default function CancelButton({ eventId, sig }: { eventId: string; sig: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <p className="ok">キャンセルしました。ご連絡ありがとうございました。</p>;
  return (
    <>
      <button
        className="btn danger"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const r = await fetch("/api/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, sig }) });
          setState(r.ok ? "done" : "error");
        }}
      >
        {state === "busy" ? "処理中…" : "この予約をキャンセルする"}
      </button>
      {state === "error" && <p className="err">キャンセルに失敗しました。</p>}
    </>
  );
}

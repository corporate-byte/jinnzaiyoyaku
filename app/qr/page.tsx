import QRCode from "qrcode";
import { config } from "@/config/booking.config.ts";
import { baseUrl } from "@/lib/baseUrl.ts";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const base = await baseUrl();
  const items = [
    { slug: "top", name: "メニュー一覧（トップ）", url: `${base}/` },
    ...config.eventTypes.map((e) => ({ slug: e.slug, name: e.name, url: `${base}/${e.slug}` })),
  ];
  const svgs = await Promise.all(items.map((i) => QRCode.toString(i.url, { type: "svg", margin: 2 })));
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  return (
    <main className="wrap wide">
      <h1>予約ページのQRコード</h1>
      {isLocal && (
        <p className="err">
          ※いまのURLは {base} です。このQRはこのパソコンでしか開けません。公開後のURLで APP_URL を設定するか、公開URLでこのページを開いてください。
        </p>
      )}
      <div className="qr-grid">
        {items.map((it, i) => (
          <div key={it.slug} className="card qr-card">
            <div className="qr" dangerouslySetInnerHTML={{ __html: svgs[i] }} />
            <p className="menu-name">{it.name}</p>
            <p className="small muted qr-url">{it.url}</p>
            <p className="small">
              <a href={`/api/qr/${it.slug}?format=png`} download={`qr-${it.slug}.png`}>PNGで保存</a>
              {" ・ "}
              <a href={`/api/qr/${it.slug}?format=svg`} download={`qr-${it.slug}.svg`}>SVG（印刷用）</a>
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}

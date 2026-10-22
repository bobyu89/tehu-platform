"use client";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Eraser, Signature } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { fmtDateTime } from "@/lib/digest";
import { sign } from "@/modules/documents";

// 電子簽章示範（規劃書 08 冊 §2）：
// 模板 →「同意以電子方式簽署」勾選（相對人同意要件）→ 手寫簽名 →
// SHA-256 雜湊＋時間戳＋載具資訊入庫存證。
// 正式版另有：OTP 身分連結、PDF 產出歸檔；憑證型數位簽章之效力差異見規劃書。

const TEMPLATES: { key: string; title: string; body: (name: string) => string }[] = [
  {
    key: "privacy",
    title: "個人資料暨特種個資蒐集處理利用同意書",
    body: (n) => `立同意書人（${n} 之家屬）同意特護機構（示範）於提供特別護理服務之目的範圍內，蒐集、處理及利用個案之個人資料與健康資料（個人資料保護法第 6 條特種個資）。保存期限、當事人權利與行使方式詳如隱私權政策。本同意得隨時以書面撤回。`,
  },
  {
    key: "service",
    title: "特別護理服務契約確認單",
    body: (n) => `茲確認 ${n} 之特別護理服務內容：12 小時制照護班次、照護紀錄與異常提醒服務。本平台為照護紀錄與提醒工具，不提供醫療診斷、不取代臨床專業判斷。收費與服務細項詳如契約附件。`,
  },
  {
    key: "event",
    title: "事件告知書",
    body: (n) => `本機構已就 ${n} 之照護事件內容、處理經過與後續觀察計畫，向家屬完成說明。家屬已知悉並收到本告知書副本。`,
  },
];

export default function SignPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [signer, setSigner] = useState("");
  const [consent, setConsent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [done, setDone] = useState<{ sha256: string; at: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const docs = useLiveQuery(() => db.signedDocs.orderBy("signedAt").reverse().limit(10).toArray(), []);
  const caseName = "王林秀英";

  // 簽名板：pointer 事件繪製，支援觸控與滑鼠
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    cv.width = rect.width * dpr;
    cv.height = rect.height * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#141c1b";
  }, [tpl, done]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    setHasInk(true);
  }
  function up() { drawing.current = false; }

  function clear() {
    const cv = canvasRef.current!;
    cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
    setHasInk(false);
  }

  async function complete() {
    const cv = canvasRef.current!;
    const sig = cv.toDataURL("image/png");
    setDone(await sign({
      kind: tpl.title, content: tpl.body(caseName), signerName: signer, caseId: "case-wang",
      consentElectronic: consent, signatureDataUrl: sig,
    }));
  }

  function reset() {
    setDone(null); setConsent(false); setSigner(""); setHasInk(false);
  }

  const canSign = consent && signer.trim() !== "" && hasInk;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[860px]">
      <header>
        <h1 className="t-head">電子簽章示範</h1>
        <p className="t-sub" style={{ maxWidth: "62ch" }}>
          流程：選擇文件、勾選「同意以電子方式簽署」（相對人同意要件）、手寫簽名，
          完成後以 SHA-256 雜湊＋時間戳＋載具資訊入庫存證。正式版另含 OTP 身分連結與 PDF 歸檔。
        </p>
      </header>

      {!done ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button key={t.key} className="opt" style={{ fontSize: 13, minHeight: 40 }}
                      data-on={tpl.key === t.key} onClick={() => { setTpl(t); clear(); }}>
                {t.title.slice(0, 10)}…
              </button>
            ))}
          </div>

          <section className="sheet" style={{ maxWidth: 640 }}>
            <div className="sheet-title"><span className="t-micro">{tpl.title}</span></div>
            <div className="px-4 py-3 t-sub" style={{ lineHeight: 1.9 }}>{tpl.body(caseName)}</div>

            <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <button className="flex items-center gap-2.5 w-full text-left" style={{ minHeight: 44, background: "none", border: "none", cursor: "pointer", color: "inherit", font: "inherit" }}
                      onClick={() => setConsent(!consent)}>
                <span className="flex items-center justify-center shrink-0"
                      style={{ width: 24, height: 24, borderRadius: 6,
                               border: consent ? "none" : "1.5px solid var(--line)",
                               background: consent ? "var(--a)" : "var(--surface)" }}>
                  {consent && <Check size={15} weight="bold" color="#fff" />}
                </span>
                <span className="t-label">我同意以電子方式簽署本文件，並知悉其法律效力</span>
              </button>
            </div>

            <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <input className="textfield" placeholder="簽署人姓名（例：王小明，關係：長子）"
                     value={signer} onChange={(e) => setSigner(e.target.value)} />
            </div>

            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--hairline)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="t-micro">請於下方框內簽名</span>
                <button className="btn btn-quiet" style={{ minHeight: 32, padding: "0 9px", fontSize: 12 }} onClick={clear}>
                  <Eraser size={13} /> 清除
                </button>
              </div>
              <canvas ref={canvasRef} className="w-full touch-none"
                      style={{ height: 140, border: "1.5px dashed var(--line)", borderRadius: "var(--r)", background: "var(--surface)" }}
                      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
            </div>

            <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <button className="btn btn-primary w-full" style={{ minHeight: 50 }} disabled={!canSign} onClick={complete}>
                <Signature size={18} weight="bold" /> 完成簽署並存證
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="sheet" style={{ maxWidth: 640 }}>
          <div className="row stripe stripe-ok">
            <Check size={20} weight="bold" color="var(--a)" />
            <span className="t-row">簽署完成，已入庫存證</span>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1.5 t-sub">
            <div><b>文件：</b>{tpl.title}</div>
            <div><b>簽署人：</b>{signer}</div>
            <div><b>時間戳：</b><span className="num">{fmtDateTime(done.at)}</span></div>
            <div className="break-all"><b>SHA-256：</b><span className="num" style={{ fontSize: 12 }}>{done.sha256}</span></div>
          </div>
          <div className="px-4 pb-3 t-micro" style={{ letterSpacing: 0, fontWeight: 400 }}>
            雜湊值涵蓋文件內容、簽名影像與時間戳——任何一項遭竄改都能被驗出。
            一般電子簽章有效但爭議時由使用方舉證；高價值文件日後評估自然人憑證（規劃書 08 冊）。
          </div>
          <div className="p-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
            <button className="btn btn-quiet w-full" onClick={reset}>再簽一份</button>
          </div>
        </section>
      )}

      {(docs ?? []).length > 0 && (
        <section className="sheet" style={{ maxWidth: 640 }}>
          <div className="sheet-title"><span className="t-micro">簽署紀錄</span></div>
          {(docs ?? []).map((d) => (
            <div key={d.id} className="row">
              <Signature size={16} color="var(--ink-3)" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="t-label truncate">{d.kind}</div>
                <div className="t-micro num" style={{ letterSpacing: 0, fontWeight: 400 }}>
                  {d.signerName}　{fmtDateTime(d.signedAt)}　{d.sha256.slice(0, 16)}…
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

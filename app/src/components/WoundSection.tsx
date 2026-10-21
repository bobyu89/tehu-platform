"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Plus, X } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { WOUND_STAGES, type Wound } from "@/lib/types";
import { addWound as createWound, assessWound } from "@/modules/care";
import { fmtDateTime } from "@/lib/digest";

// 傷口／壓傷紀錄（規格 02 冊 §1.3）：人形圖點選部位、拍照、分期、描述。
// 人形圖為背面視角：壓傷好發部位多在受壓的背側（薦尾、腳跟、後腦…）。
// 照片以 canvas 縮至長邊 1024px 後存本機；正式版上傳 Storage 並保留原檔。

const SITES: { code: string; label: string; cx: number; cy: number }[] = [
  { code: "occiput", label: "後腦杓", cx: 60, cy: 16 },
  { code: "scapula_l", label: "左肩胛", cx: 44, cy: 52 },
  { code: "scapula_r", label: "右肩胛", cx: 76, cy: 52 },
  { code: "elbow_l", label: "左手肘", cx: 26, cy: 88 },
  { code: "elbow_r", label: "右手肘", cx: 94, cy: 88 },
  { code: "sacrum", label: "薦尾", cx: 60, cy: 104 },
  { code: "buttock_l", label: "左臀", cx: 48, cy: 118 },
  { code: "buttock_r", label: "右臀", cx: 72, cy: 118 },
  { code: "heel_l", label: "左腳跟", cx: 50, cy: 218 },
  { code: "heel_r", label: "右腳跟", cx: 70, cy: 218 },
];

async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const max = 1024;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function WoundSection({ caseId }: { caseId: string }) {
  const db = getDb();
  const [picking, setPicking] = useState(false);
  const [assessFor, setAssessFor] = useState<Wound | null>(null);
  const [stage, setStage] = useState<(typeof WOUND_STAGES)[number] | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const wounds = useLiveQuery(
    () => db.wounds.where("caseId").equals(caseId).filter((w) => !w.healedOn).toArray(), [caseId]);
  const latest = useLiveQuery(async () => {
    const out: Record<string, { stage: string; at: string; photo?: string }> = {};
    for (const w of await db.wounds.where("caseId").equals(caseId).toArray()) {
      const rows = await db.woundAssessments.where("woundId").equals(w.id).toArray();
      const last = rows.reduce<typeof rows[number] | undefined>(
        (a, r) => (!a || r.at > a.at ? r : a), undefined);
      if (last) out[w.id] = { stage: last.stage, at: last.at, photo: last.photo };
    }
    return out;
  }, [caseId]);

  async function addWound(site: (typeof SITES)[number]) {
    const w = await createWound(caseId, site);
    setPicking(false);
    setAssessFor(w); // 建立後直接進第一次評估
  }

  async function saveAssessment() {
    if (!assessFor || !stage) return;
    await assessWound({
      woundId: assessFor.id, caseId, stage,
      note: note.trim() || undefined, photo: photo ?? undefined,
    });
    setAssessFor(null); setStage(null); setNote(""); setPhoto(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPhoto(await shrinkPhoto(f));
    e.target.value = "";
  }

  const taken = new Set((wounds ?? []).map((w) => w.site));

  return (
    <section className="sheet">
      <div className="sheet-title">
        <span className="t-micro">傷口／壓傷</span>
        <button className="btn btn-quiet" style={{ minHeight: 32, padding: "0 9px", fontSize: 12 }}
                onClick={() => setPicking(true)}>
          <Plus size={13} weight="bold" /> 新增部位
        </button>
      </div>

      {(wounds ?? []).length === 0 && <div className="empty">目前無追蹤中的傷口</div>}
      {(wounds ?? []).map((w) => {
        const l = latest?.[w.id];
        return (
          <button key={w.id} className="row row-tap w-full" onClick={() => setAssessFor(w)}>
            {l?.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={l.photo} alt="" className="h-10 w-10 rounded object-cover shrink-0" style={{ border: "1px solid var(--line)" }} />
              : <span className="flex h-10 w-10 items-center justify-center rounded shrink-0" style={{ background: "var(--sunken)" }}>
                  <Camera size={16} color="var(--ink-3)" />
                </span>}
            <div className="flex-1 min-w-0 text-left">
              <div className="t-label">{w.siteLabel}</div>
              <div className="t-micro num" style={{ fontWeight: 400, letterSpacing: 0 }}>
                {l ? `${l.stage}・${fmtDateTime(l.at)} 評估` : "尚未評估"}
              </div>
            </div>
            {l && <span className={`tag ${l.stage.startsWith("3") || l.stage.startsWith("4") ? "tag-critical" : "tag-caution"}`}>{l.stage}</span>}
          </button>
        );
      })}

      {/* 人形圖（背面）選部位 */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
             style={{ background: "rgba(20,28,27,.45)" }} onClick={() => setPicking(false)}>
          <div className="sheet enter w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">
              <span className="t-micro">點選部位（背面視角）</span>
              <button onClick={() => setPicking(false)} aria-label="關閉" className="btn btn-quiet" style={{ minHeight: 28, padding: "0 6px" }}>
                <X size={14} />
              </button>
            </div>
            <div className="flex justify-center py-3">
              <svg viewBox="0 0 120 236" width="190" role="img" aria-label="人形圖選擇傷口部位">
                {/* 簡化人形（背面） */}
                <g fill="var(--sunken)" stroke="var(--line)" strokeWidth="1.5">
                  <circle cx="60" cy="18" r="13" />
                  <rect x="42" y="34" width="36" height="62" rx="10" />
                  <rect x="24" y="38" width="12" height="56" rx="6" />
                  <rect x="84" y="38" width="12" height="56" rx="6" />
                  <rect x="44" y="98" width="32" height="28" rx="8" />
                  <rect x="46" y="128" width="12" height="82" rx="6" />
                  <rect x="62" y="128" width="12" height="82" rx="6" />
                  <ellipse cx="51" cy="218" rx="8" ry="7" />
                  <ellipse cx="70" cy="218" rx="8" ry="7" />
                </g>
                {SITES.map((s) => (
                  <g key={s.code} onClick={() => void addWound(s)} style={{ cursor: taken.has(s.code) ? "not-allowed" : "pointer" }}>
                    <circle cx={s.cx} cy={s.cy} r="9"
                            fill={taken.has(s.code) ? "var(--caution)" : "var(--a)"}
                            opacity={taken.has(s.code) ? 0.5 : 0.85} />
                    <title>{s.label}{taken.has(s.code) ? "（已在追蹤中）" : ""}</title>
                  </g>
                ))}
              </svg>
            </div>
            <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
              {SITES.map((s) => (
                <button key={s.code} className="opt" style={{ fontSize: 12, minHeight: 34, padding: "0 9px" }}
                        disabled={taken.has(s.code)} onClick={() => void addWound(s)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 評估表單 */}
      {assessFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
             style={{ background: "rgba(20,28,27,.45)" }} onClick={() => setAssessFor(null)}>
          <div className="sheet enter w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title"><span className="t-micro">{assessFor.siteLabel}・新增評估</span></div>
            <div className="p-3 flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {WOUND_STAGES.map((s) => (
                  <button key={s} className="opt" style={{ fontSize: 13, minHeight: 40 }}
                          data-on={stage === s} onClick={() => setStage(s)}>{s}</button>
                ))}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
              <div className="flex items-center gap-2">
                <button className="btn btn-quiet" onClick={() => fileRef.current?.click()}>
                  <Camera size={16} /> {photo ? "重拍" : "拍照"}
                </button>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="傷口照片預覽" className="h-14 w-14 rounded object-cover" style={{ border: "1px solid var(--line)" }} />
                )}
              </div>
              <textarea className="textfield" style={{ minHeight: 64 }} placeholder="描述（大小、滲液、氣味、週邊皮膚…）"
                        value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-quiet flex-1" onClick={() => setAssessFor(null)}>取消</button>
                <button className="btn btn-primary flex-1" disabled={!stage} onClick={saveAssessment}>儲存評估</button>
              </div>
              <p className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
                評估紀錄 append-only 保留完整軌跡；3 期以上與惡化趨勢建議同步通報護理長。
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

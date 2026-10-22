"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldCheck, Star } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { ratingOf, submitRequest, topTags } from "@/modules/customers";

// 客戶端「照護人員」：檔案、技術標籤、真實評價、可服務時段；可指定預約。
// 不顯示證照字號等內部識別資訊，只顯示「已驗證」。

export default function NursesPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);
  const profiles = useLiveQuery(() => db.nurseProfiles.toArray(), []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const [booking, setBooking] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [pref, setPref] = useState("白班");
  const [sentFor, setSentFor] = useState<string | null>(null);

  async function book(nurseId: string, name: string) {
    await submitRequest({
      customerName: "王志明", phone: "0912-345-678", relation: "長子", setting: "居家", area: "台北市",
      needs: nurses?.find((n) => n.id === nurseId)?.tags.slice(0, 2) ?? [],
      startDate: date, shiftPref: pref, note: `指定護理師：${name}`,
    });
    setSentFor(nurseId); setBooking(null);
  }

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1000px]">
      <header>
        <h1 className="t-head">照護人員</h1>
        <p className="t-sub" style={{ maxWidth: "60ch" }}>技術標籤由機構完訓考核授予，評價來自真實服務。平台以派單為主、指定為輔，指定人員將盡量安排。</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(nurses ?? []).map((n) => {
          const p = profiles?.find((x) => x.nurseId === n.id);
          const r = ratingOf(reviews ?? [], n.id);
          const tags = topTags((reviews ?? []).filter((x) => x.nurseId === n.id));
          const days = p ? Object.entries(p.availability).filter(([, v]) => v.length > 0).map(([d]) => d).join("") : "";
          return (
            <section key={n.id} className="sheet">
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full shrink-0 t-row" style={{ background: "var(--a-wash)", color: "var(--a-ink)" }}>{n.name.slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="t-row">{n.name}</span>
                    <span className="tag tag-accent"><ShieldCheck size={11} weight="fill" /> 執照已驗證</span>
                    {r && <span className="t-label" style={{ color: "var(--caution)" }}><Star size={12} weight="fill" style={{ display: "inline" }} /> {r.avg.toFixed(1)} <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>({r.n})</span></span>}
                  </div>
                  <div className="t-sub">{p ? `${p.yearsExp} 年經驗・${p.areas.join("、")}` : ""}</div>
                  {p?.bio && <div className="t-sub mt-1" style={{ fontSize: 13 }}>{p.bio}</div>}
                </div>
              </div>
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">{n.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
              {tags.length > 0 && <div className="px-4 pb-2 t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>家屬常提到：{tags.join("、")}</div>}
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: "1px solid var(--hairline)" }}>
                <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>可服務：週{days || "—"}</span>
                <span className="flex-1" />
                {sentFor === n.id
                  ? <span className="tag tag-accent">已送出指定預約</span>
                  : <button className="btn btn-quiet" style={{ minHeight: 36, padding: "0 12px", fontSize: 13 }} onClick={() => setBooking(booking === n.id ? null : n.id)}>指定預約</button>}
              </div>
              {booking === n.id && (
                <div className="p-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--hairline)", background: "var(--sunken)" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="textfield" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    <div className="flex gap-1.5">{["白班", "夜班"].map((s) => <button key={s} className="opt flex-1" style={{ minHeight: 40, fontSize: 13 }} data-on={pref === s} onClick={() => setPref(s)}>{s}</button>)}</div>
                  </div>
                  <button className="btn btn-primary" disabled={!date} onClick={() => void book(n.id, n.name)}>送出預約需求</button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

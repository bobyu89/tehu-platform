"use client";
import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useMounted } from "@/components/useMounted";
import { submitRequest } from "@/modules/customers";

// 客戶端「提出需求」：線上填單 → 公司端需求進線 → 聯繫、報價、成案。

const NEEDS = ["管灌", "血糖監測", "氧療照護", "抽痰", "傷口照護", "失智照護", "呼吸器", "安寧照護"];

export default function RequestPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Form />;
}

function Form() {
  const [f, setF] = useState({
    customerName: "", phone: "", relation: "", setting: "居家" as "居家" | "醫院",
    area: "", startDate: "", shiftPref: "白班", note: "",
  });
  const [needs, setNeeds] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const ok = f.customerName.trim() && f.phone.trim() && f.area.trim() && f.startDate && needs.length > 0;

  async function submit() {
    if (!ok) return;
    setDone(await submitRequest({ ...f, needs, note: f.note || undefined }));
  }

  if (done) {
    return (
      <div className="px-4 lg:px-6 py-5 max-w-[640px]">
        <div className="sheet">
          <div className="row stripe stripe-ok"><CheckCircle size={22} weight="fill" color="var(--a)" /><span className="t-row">需求已送出</span></div>
          <div className="px-4 py-3 t-sub" style={{ lineHeight: 1.9 }}>
            我們會在 <b>1 個工作天內</b>由護理長與您聯繫，安排評估訪視並提供報價。
            單號 <span className="num">{done}</span>。正式版會同步以 LINE 通知您進度。
          </div>
        </div>
      </div>
    );
  }

  const chip = (on: boolean, label: string, onClick: () => void, extra = "") => (
    <button key={label} className={`opt ${extra}`} style={{ minHeight: 40, fontSize: 13 }} data-on={on} onClick={onClick}>{label}</button>
  );

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[640px]">
      <header>
        <h1 className="t-head">提出照護需求</h1>
        <p className="t-sub">填好基本資訊，護理長會親自與您聯繫。所有欄位僅用於安排服務，依個資法保護。</p>
      </header>
      <section className="sheet">
        <div className="p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label><span className="t-micro">您的姓名</span><input className="textfield mt-1" value={f.customerName} onChange={(e) => set("customerName", e.target.value)} /></label>
            <label><span className="t-micro">聯絡電話</span><input className="textfield mt-1" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label><span className="t-micro">與被照護者關係</span><input className="textfield mt-1" placeholder="例：女兒" value={f.relation} onChange={(e) => set("relation", e.target.value)} /></label>
            <label><span className="t-micro">服務地區</span><input className="textfield mt-1" placeholder="例：台北市大安區" value={f.area} onChange={(e) => set("area", e.target.value)} /></label>
          </div>
          <div><span className="t-micro">照護地點</span>
            <div className="flex gap-1.5 mt-1">{(["居家", "醫院"] as const).map((s) => chip(f.setting === s, s, () => set("setting", s), "flex-1"))}</div>
          </div>
          <div><span className="t-micro">需要的照護技術（可複選）</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {NEEDS.map((n) => chip(needs.includes(n), n, () => setNeeds(needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n])))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="t-micro">希望開始日期</span><input className="textfield mt-1" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
            <div><span className="t-micro">時段</span>
              <div className="flex gap-1.5 mt-1">{["白班", "夜班", "全天"].map((s) => chip(f.shiftPref === s, s, () => set("shiftPref", s), "flex-1"))}</div>
            </div>
          </div>
          <label><span className="t-micro">情況說明（選填）</span>
            <textarea className="textfield mt-1" style={{ minHeight: 80 }} placeholder="診斷、目前狀況、特別需要注意的事…" value={f.note} onChange={(e) => set("note", e.target.value)} />
          </label>
          <button className="btn btn-primary" style={{ minHeight: 50 }} disabled={!ok} onClick={submit}>送出需求</button>
        </div>
      </section>
    </div>
  );
}

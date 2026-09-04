"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChatCircleDots, LinkSimple, Phone, Star } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { CASE_STATUS_LABEL } from "@/lib/types";

// 公司管理端「客戶管理」：客戶（付費家屬）與其個案、聯繫偏好、評價與客訴。

export default function CustomersPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const complaints = useLiveQuery(() => db.complaints.toArray(), []);

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1000px]">
      <header>
        <h1 className="t-head">客戶管理</h1>
        <p className="t-sub">客戶是付費與決策的家屬，與個案分開管理。LINE 綁定者可接收日報與通知。</p>
      </header>

      <section className="sheet">
        <div className="sheet-title"><span className="t-micro">客戶</span><span className="t-micro num">{customers?.length ?? 0} 位</span></div>
        {(customers ?? []).map((c) => {
          const myCases = (cases ?? []).filter((x) => c.caseIds.includes(x.id));
          const rv = (reviews ?? []).filter((r) => r.customerName === c.name);
          const cp = (complaints ?? []).filter((x) => x.customerName === c.name && x.status !== "resolved");
          return (
            <div key={c.id} className="px-3.5 py-3 flex flex-col gap-1.5" style={{ borderBottom: "1px solid var(--hairline)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="t-label">{c.name}</span>
                <span className="t-sub">{c.relation}</span>
                <span className="t-sub num flex items-center gap-1"><Phone size={12} /> {c.phone}</span>
                {c.lineBound
                  ? <span className="tag tag-accent"><LinkSimple size={11} /> LINE 已綁定</span>
                  : <span className="tag">未綁定 LINE</span>}
                {rv.length > 0 && <span className="tag"><Star size={11} weight="fill" /> {rv.length} 則評價</span>}
                {cp.length > 0 && <span className="tag tag-caution"><ChatCircleDots size={11} weight="fill" /> {cp.length} 件客訴處理中</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {myCases.map((x) => (
                  <span key={x.id} className="tag">{x.name}・{CASE_STATUS_LABEL[x.status ?? "active"]}</span>
                ))}
              </div>
              {c.note && <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>備註：{c.note}</div>}
            </div>
          );
        })}
      </section>
    </div>
  );
}

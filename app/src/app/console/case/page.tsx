"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, GearSix } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { useCaseId } from "@/components/useCaseId";
import type { ObsType } from "@/lib/types";
import { OBS_LABEL } from "@/lib/types";
import { computeNews2 } from "@/lib/news2";
import { VitalsForm } from "@/components/VitalsForm";
import { CareBoard } from "@/components/CareBoard";
import { TrendsPanel } from "@/components/TrendsPanel";
import { HandoffPanel } from "@/components/HandoffPanel";

// 個案照護工作區（桌面版）：量測、照護、趨勢並列一屏，交班在下方。
// 未帶 ?id= 時顯示個案選擇。行動版精修留待手機版階段。

const STRIP: ObsType[] = ["spo2", "bp", "hr", "bt"];

export default function CaseWorkspacePage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Workspace />;
}

function Workspace() {
  useEffect(() => { void ensureSeeded(); }, []);
  // 同一頁面同時服務公司端與人員端：連結前綴依當前端決定
  const base = usePathname().startsWith("/staff") ? "/staff" : "/console";
  const caseId = useCaseId();
  const db = getDb();
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const info = cases?.find((c) => c.id === caseId);

  const strip = useLiveQuery(async () => {
    if (!caseId) return {};
    const out: Partial<Record<ObsType, string>> = {};
    const obs = await db.observations.where("caseId").equals(caseId).toArray();
    for (const t of STRIP) {
      const o = obs.filter((x) => x.type === t && x.value.main != null)
        .reduce<typeof obs[number] | undefined>((a, r) => (!a || r.measuredAt > a.measuredAt ? r : a), undefined);
      if (o) out[t] = t === "bp" && o.value.dbp != null ? `${o.value.main}/${o.value.dbp}` : String(o.value.main);
    }
    return out;
  }, [caseId]);

  const news2 = useLiveQuery(async () => {
    if (!info) return null;
    const since = new Date(Date.now() - 12 * 3600_000).toISOString();
    const obs = await db.observations.where("caseId").equals(caseId)
      .filter((o) => o.measuredAt >= since).toArray();
    return computeNews2(info, obs);
  }, [caseId, info?.id]);

  // 未選個案：選擇畫面
  if (!caseId || !info) {
    return (
      <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[860px]">
        <header>
          <h1 className="t-head">個案照護</h1>
          <p className="t-sub">選擇要進入的個案工作區。</p>
        </header>
        <section className="sheet">
          {(cases ?? []).map((c) => (
            <Link key={c.id} href={`${base}/case?id=${c.id}`} className="row row-tap" style={{ display: "flex" }}>
              <div className="flex-1 min-w-0">
                <div className="t-row">{c.name}<span className="t-sub font-normal">　{c.age} 歲・{c.setting}</span></div>
                <div className="t-sub truncate">{c.dx}</div>
              </div>
              <CaretRight size={16} color="var(--ink-3)" />
            </Link>
          ))}
          {(cases ?? []).length === 0 && <div className="empty">尚無個案</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1500px]">
      {/* 個案頂欄 */}
      <header className="sheet px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="t-head">{info.name}</h1>
            <span className="t-sub">{info.age} 歲・{info.sex}</span>
            <span className="tag">{info.setting}</span>
            {news2 && (
              <span className={`tag num ${news2.complete && news2.band === "high" ? "tag-critical" : news2.complete && (news2.band === "medium" || news2.band === "low-medium") ? "tag-caution" : ""}`}>
                NEWS2 {news2.complete ? `${news2.total}・${news2.bandLabel}` : "資料不全"}
                {info.news2AlertsOff ? "（警報停用）" : ""}
              </span>
            )}
          </div>
          <div className="t-sub mt-0.5">{info.dx}
            <span className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
              過敏 {info.allergies}　管路 {info.tubes.join("、") || "無"}
            </span>
          </div>
          {info.overrideNote && (
            <div className="t-micro mt-1 flex items-center gap-1" style={{ color: "var(--caution)", letterSpacing: 0, fontWeight: 400 }}>
              <GearSix size={13} weight="fill" /> {info.overrideNote}
            </div>
          )}
        </div>
        <div className="ml-auto grid grid-cols-4 gap-px overflow-hidden shrink-0"
             style={{ background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
          {STRIP.map((t) => (
            <div key={t} className="px-2.5 py-1.5 text-center" style={{ background: "var(--surface)" }}>
              <div className="t-micro" style={{ letterSpacing: ".03em" }}>{OBS_LABEL[t]}</div>
              <div className="num" style={{ fontSize: 17, fontWeight: 700 }}>
                {strip?.[t] ?? <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 13 }}>尚無</span>}
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* 三欄工作區 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        <section className="flex flex-col gap-2">
          <h2 className="t-micro px-1">量測輸入</h2>
          <VitalsForm info={info} inline />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="t-micro px-1">照護紀錄</h2>
          <CareBoard caseId={caseId} />
        </section>
        <section className="flex flex-col gap-2 lg:col-span-2 xl:col-span-1">
          <h2 className="t-micro px-1">趨勢</h2>
          <TrendsPanel caseId={caseId} />
        </section>
      </div>

      {/* 交班（全寬） */}
      <section className="flex flex-col gap-2 max-w-[720px]">
        <h2 className="t-micro px-1">交班</h2>
        <HandoffPanel caseId={caseId} />
      </section>
    </div>
  );
}

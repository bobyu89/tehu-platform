"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { countByLayer, responseStats } from "@/modules/alerts";

// 報表分析（QI 品質指標，規劃書 07 冊 §3）：
// 警報響應、給藥準時、照護達成、量測密度。這些數據是第三階段
// 招募平台「品質徽章」的原料，從 MVP 第一天就開始累積。

function dstr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const today = dstr(new Date());

  const stats = useLiveQuery(async () => {
    const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const alerts = (await db.alerts.toArray()).filter((a) => a.triggeredAt >= since7d);
    const redResp = responseStats(alerts.filter((a) => a.level === "red"));
    const allResp = responseStats(alerts);
    const byLayer = countByLayer(alerts);

    const meds = await db.meds.toArray();
    const nowH = new Date().getHours();
    const medDue = meds.flatMap((m) => m.slots.filter((s) => s <= nowH)).length;
    const logs = (await db.medLogs.toArray()).filter((l) => l.date === today);
    const medGiven = logs.filter((l) => l.status === "given").length;
    const withheldReasons: Record<string, number> = {};
    for (const l of logs.filter((x) => x.status === "withheld")) {
      withheldReasons[l.reason ?? "其他"] = (withheldReasons[l.reason ?? "其他"] ?? 0) + 1;
    }

    const events = (await db.events.toArray()).filter((e) => e.occurredAt >= todayIso);
    const reposition = events.filter((e) => e.type === "reposition").length;
    const suction = events.filter((e) => e.type === "suction").length;
    const tubeChecks = events.filter((e) => e.type === "tube_check").length;

    const obs7d = (await db.observations.toArray()).filter((o) => o.measuredAt >= since7d && o.category === "vital");
    const sos = await db.sos.toArray();
    const handoffs = await db.handoffs.toArray();
    const pushes = await db.eduPushes.toArray();

    return {
      alerts7d: alerts.length,
      red7d: alerts.filter((a) => a.level === "red").length,
      redResp, allResp,
      byLayer,
      medDue, medGiven, withheldReasons,
      reposition, suction, tubeChecks,
      vitalsPerDay: Math.round(obs7d.length / 7),
      sosTotal: sos.length, sosOpen: sos.filter((s) => !s.resolvedAt).length,
      handoffReceived: handoffs.filter((h) => h.status === "received").length,
      handoffTotal: handoffs.length,
      eduPushes: pushes.length,
    };
  }, [today]);

  const s = stats;

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1100px]">
      <header>
        <h1 className="t-head">報表分析</h1>
        <p className="t-sub" style={{ maxWidth: "62ch" }}>
          品質指標（QI）從第一天開始累積：這些數據日後即是招募平台品質徽章與
          家屬信任的依據。以下統計來自本機示範資料。
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">紅色警報平均認領</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>
            {s?.redResp ? `${s.redResp.avg < 1 ? "<1" : Math.round(s.redResp.avg)} 分` : "近 7 日無紅色"}
          </div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
            出場判準 5 分內・紅色樣本 {s?.redResp?.n ?? 0}
            {s?.allResp ? `　全部警報 ${Math.round(s.allResp.avg)} 分` : ""}
          </div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">今日給藥準時率</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>
            {s && s.medDue > 0 ? `${Math.round((s.medGiven / s.medDue) * 100)}%` : "無到期"}
          </div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>
            {s?.medGiven ?? 0} / {s?.medDue ?? 0} 已給
          </div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">七日量測密度</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{s?.vitalsPerDay ?? 0} 筆/日</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>生命徵象類</div>
        </div>
        <div className="sheet stripe stripe-ok px-3.5 py-3">
          <div className="t-micro">交班簽收</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{s?.handoffReceived ?? 0} / {s?.handoffTotal ?? 0}</div>
          <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>已歸檔 / 總數</div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <section className="sheet">
          <div className="sheet-title">
            <span className="t-micro">近 7 日警報來源分層</span>
            <span className="t-micro num">共 {s?.alerts7d ?? 0} 件・紅 {s?.red7d ?? 0}</span>
          </div>
          {s && Object.keys(s.byLayer).length === 0 && <div className="empty">近 7 日無警報</div>}
          {s && Object.entries(s.byLayer).map(([layer, c]) => (
            <div key={layer} className="row">
              <span className="t-label flex-1">{layer}</span>
              <span className="flex gap-1.5">
                {c.red > 0 && <span className="tag tag-critical num">紅 {c.red}</span>}
                {c.yellow > 0 && <span className="tag tag-caution num">黃 {c.yellow}</span>}
              </span>
            </div>
          ))}
          <div className="px-3.5 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", fontWeight: 400, letterSpacing: 0 }}>
            分層統計可檢視警報疲勞來源：黃色過多時優先校準 C 層 σ 上下限與 A 層個案覆寫。
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-title"><span className="t-micro">今日照護達成</span></div>
          <div className="row">
            <span className="t-label flex-1">翻身擺位</span>
            <span className="num t-label">{s?.reposition ?? 0} 次<span className="t-micro" style={{ fontWeight: 400 }}>（目標 Q2H）</span></span>
          </div>
          <div className="row">
            <span className="t-label flex-1">抽痰</span>
            <span className="num t-label">{s?.suction ?? 0} 次</span>
          </div>
          <div className="row">
            <span className="t-label flex-1">管路勾檢</span>
            <span className="num t-label">{s?.tubeChecks ?? 0} 次</span>
          </div>
          {s && Object.keys(s.withheldReasons).length > 0 && (
            <div className="px-3.5 py-2.5" style={{ borderTop: "1px solid var(--hairline)" }}>
              <div className="t-micro mb-1">未給藥原因</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(s.withheldReasons).map(([r, n]) => (
                  <span key={r} className="tag tag-caution">{r} {n}</span>
                ))}
              </div>
            </div>
          )}
          <div className="row" style={{ borderTop: "1px solid var(--hairline)" }}>
            <span className="t-label flex-1">SOS 事件</span>
            <span className="num t-label">{s?.sosTotal ?? 0} 件{(s?.sosOpen ?? 0) > 0 ? `・未結 ${s?.sosOpen}` : ""}</span>
          </div>
          <div className="row">
            <span className="t-label flex-1">衛教推送</span>
            <span className="num t-label">{s?.eduPushes ?? 0} 次</span>
          </div>
        </section>
      </div>
    </div>
  );
}

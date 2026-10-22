"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, DownloadSimple, MapPin, Warning, X } from "@phosphor-icons/react";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { useMounted } from "@/components/useMounted";
import { hoursOf, isAnomaly, review, rollupByNurse } from "@/modules/shifts";
import { fmtTime } from "@/lib/digest";

// 出勤與工時（規格 04 冊 §1）：
// 圈外/無定位打卡不硬擋、標記異常進審核流；出勤逐分鐘記錄、保存 5 年（勞基法 §30）；
// 近 30 日工時統計與 CSV 匯出備勞檢。

export default function AttendancePage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <Content />;
}

function Content() {
  useEffect(() => { void ensureSeeded(); }, []);
  const db = getDb();
  const shifts = useLiveQuery(() => db.shifts.orderBy("date").reverse().limit(60).toArray(), []);
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const nurses = useLiveQuery(() => db.nurses.toArray(), []);

  const caseName = (id: string) => cases?.find((c) => c.id === id)?.name ?? "";
  const nurseName = (id?: string) => nurses?.find((n) => n.id === id)?.name ?? "未指派";

  const clocked = (shifts ?? []).filter((s) => s.clockInAt);
  const pending = clocked.filter((s) => isAnomaly(s) && !s.reviewStatus);

  const byNurse = rollupByNurse(clocked);

  function exportCsv() {
    const rows = [
      ["日期", "護理師", "個案", "班別", "上班", "下班", "時數", "定位", "審核"],
      ...clocked.map((s) => [
        s.date, nurseName(s.nurseId), caseName(s.caseId),
        `${String(s.startHH).padStart(2, "0")}:00-${String(s.endHH).padStart(2, "0")}:00`,
        s.clockInAt ? fmtTime(s.clockInAt) : "",
        s.clockOutAt ? fmtTime(s.clockOutAt) : "",
        hoursOf(s)?.toFixed(2) ?? "",
        s.clockInGeo ? `±${Math.round(s.clockInGeo.acc)}m` : "無定位",
        isAnomaly(s) ? (s.reviewStatus === "approved" ? "已核可" : s.reviewStatus === "rejected" ? "已退回" : "待審核") : "正常",
      ]),
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `出勤紀錄_近30日.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-4 lg:px-6 py-5 flex flex-col gap-4 max-w-[1100px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-head">出勤與工時</h1>
          <p className="t-sub" style={{ maxWidth: "60ch" }}>
            出勤逐分鐘記錄、保存五年備勞檢。圈外或無定位打卡不硬擋，
            標記異常由主管審核，避免逼出場外補打的作弊文化。
          </p>
        </div>
        <button className="btn btn-quiet" onClick={exportCsv}>
          <DownloadSimple size={16} /> 匯出 CSV 備勞檢
        </button>
      </header>

      {pending.length > 0 && (
        <section className="sheet">
          <div className="sheet-title">
            <span className="t-micro" style={{ color: "var(--caution)" }}>待審核異常打卡</span>
            <span className="t-micro num">{pending.length} 筆</span>
          </div>
          {pending.map((s) => (
            <div key={s.id} className="row stripe stripe-caution">
              <Warning size={17} weight="fill" color="var(--caution)" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="t-label truncate">
                  {nurseName(s.nurseId)}　{caseName(s.caseId)}
                  <span className="t-sub font-normal num">　{s.date.slice(5).replace("-", "/")} {s.clockInAt ? fmtTime(s.clockInAt) : ""}</span>
                </div>
                <div className="t-micro" style={{ fontWeight: 400, letterSpacing: 0 }}>無定位訊號打卡（GPS 拒絕或收不到）</div>
              </div>
              <button className="btn btn-primary shrink-0" style={{ minHeight: 36, padding: "0 11px", fontSize: 13 }}
                      onClick={() => void review(s.id, true)}>
                <Check size={14} weight="bold" /> 核可
              </button>
              <button className="btn btn-quiet shrink-0" style={{ minHeight: 36, padding: "0 11px", fontSize: 13 }}
                      onClick={() => void review(s.id, false)}>
                <X size={14} /> 退回
              </button>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
        <section className="sheet">
          <div className="sheet-title">
            <span className="t-micro">出勤紀錄</span>
            <span className="t-micro num">{clocked.length} 筆</span>
          </div>
          {clocked.length === 0 && <div className="empty">尚無打卡紀錄。護理師於今日班次定位打卡後出現於此。</div>}
          {clocked.map((s) => (
            <div key={s.id} className="row">
              <MapPin size={16} color={s.clockInGeo ? "var(--a)" : "var(--caution)"} weight="fill" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="t-label truncate">
                  {nurseName(s.nurseId)}　{caseName(s.caseId)}
                  <span className="t-sub font-normal num">　{s.date.slice(5).replace("-", "/")}</span>
                </div>
                <div className="t-micro num" style={{ fontWeight: 400, letterSpacing: 0 }}>
                  上班 {s.clockInAt ? fmtTime(s.clockInAt) : ""}
                  {s.clockOutAt && `　下班 ${fmtTime(s.clockOutAt)}`}
                  {hoursOf(s) != null && `　${hoursOf(s)!.toFixed(1)} 小時`}
                  {s.clockInGeo ? `　±${Math.round(s.clockInGeo.acc)}m` : ""}
                </div>
              </div>
              {isAnomaly(s) && (
                s.reviewStatus === "approved" ? <span className="tag tag-accent">異常已核可</span>
                : s.reviewStatus === "rejected" ? <span className="tag tag-critical">已退回</span>
                : <span className="tag tag-caution">待審核</span>
              )}
            </div>
          ))}
        </section>

        <section className="sheet">
          <div className="sheet-title"><span className="t-micro">近 30 日工時</span></div>
          {Object.keys(byNurse).length === 0 && <div className="empty">近 30 日尚無完成打卡的班次</div>}
          {Object.entries(byNurse).map(([id, v]) => (
            <div key={id} className="row">
              <span className="t-label flex-1">{nurseName(id)}</span>
              <span className="num t-label">{v.shifts} 班・{v.hours.toFixed(1)} 小時</span>
            </div>
          ))}
          <div className="px-3.5 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", fontWeight: 400, letterSpacing: 0 }}>
            正式版依僱傭／承攬分流報表；受僱者依勞基法檢核單日上限、輪班間隔與月加班額度。
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { Star } from "@phosphor-icons/react";
import { addReview } from "@/modules/customers";

// 客戶端評價表單：星等＋標籤＋留言。送出即成為護理師的品質紀錄。

const TAGS = ["準時", "細心", "專業", "溝通清楚", "主動回報", "溫柔", "尊重"];

export function ReviewForm({
  caseId, nurseId, customerName, given,
}: { caseId: string; nurseId?: string; customerName: string; given: number }) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!nurseId || rating === 0) return;
    await addReview({ caseId, nurseId, customerName, rating, tags, comment: comment || undefined });
    setSent(true);
  }

  return (
    <section className="sheet">
      <div className="sheet-title"><span className="t-micro">給照護人員的評價</span></div>
      {sent ? (
        <div className="empty" style={{ color: "var(--a-ink)" }}>謝謝您的回饋，這會成為護理師的品質紀錄。</div>
      ) : (
        <div className="p-3 flex flex-col gap-2.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} 星`}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <Star size={28} weight={n <= rating ? "fill" : "regular"} color={n <= rating ? "var(--caution)" : "var(--ink-3)"} />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button key={t} className="opt" style={{ fontSize: 12, minHeight: 34, padding: "0 10px" }}
                      data-on={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>
            ))}
          </div>
          <textarea className="textfield" style={{ minHeight: 56 }} placeholder="想說的話（選填）" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-primary" disabled={rating === 0 || !nurseId} onClick={submit}>送出評價</button>
        </div>
      )}
      {given > 0 && (
        <div className="px-3.5 py-2.5 t-micro" style={{ borderTop: "1px solid var(--hairline)", fontWeight: 400, letterSpacing: 0 }}>
          您已給過 {given} 則評價
        </div>
      )}
    </section>
  );
}

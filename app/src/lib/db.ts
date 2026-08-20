import Dexie, { type EntityTable } from "dexie";
import type { Observation, AlertRow, CaseInfo, Shift, Handoff, SosIncident, CareEvent, Nurse, Med, MedLog, SignedDoc } from "./types";

// 離線優先（02 冊 UX 原則）：本地 IndexedDB 為寫入第一站。
// 接上 Supabase 後，此層即成為同步佇列（queue → server 權威判定）。
class TehuDB extends Dexie {
  cases!: EntityTable<CaseInfo, "id">;
  shifts!: EntityTable<Shift, "id">;
  observations!: EntityTable<Observation, "id">;
  alerts!: EntityTable<AlertRow, "id">;
  handoffs!: EntityTable<Handoff, "id">;
  sos!: EntityTable<SosIncident, "id">;
  events!: EntityTable<CareEvent, "id">;
  nurses!: EntityTable<Nurse, "id">;
  meds!: EntityTable<Med, "id">;
  medLogs!: EntityTable<MedLog, "id">;
  signedDocs!: EntityTable<SignedDoc, "id">;
  meta!: EntityTable<{ id: string; value: string }, "id">;

  constructor() {
    super("tehu");
    this.version(1).stores({
      cases: "id",
      shifts: "id, caseId, date",
      observations: "id, caseId, [caseId+type], measuredAt",
      alerts: "id, caseId, status, triggeredAt",
      handoffs: "id, caseId, shiftId",
      sos: "id, triggeredAt",
      meta: "id",
    });
    this.version(2).stores({
      events: "id, caseId, occurredAt",
    });
    this.version(3).stores({
      nurses: "id",
      meds: "id, caseId",
      medLogs: "id, caseId",
    });
    this.version(4).stores({
      signedDocs: "id, signedAt",
    });
  }
}

let _db: TehuDB | null = null;

export function getDb(): TehuDB {
  if (!_db) _db = new TehuDB();
  return _db;
}

export function uid(): string {
  return crypto.randomUUID();
}

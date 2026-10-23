import Dexie, { type EntityTable } from "dexie";
import type {
  Observation, AlertRow, CaseInfo, Shift, Handoff, SosIncident, CareEvent, Nurse, Med, MedLog,
  SignedDoc, EduUnit, EduPush, Wound, WoundAssessment,
  Customer, ServiceRequest, Review, Complaint, NurseProfile,
} from "./types";
import type { OutboxItem } from "./sync/mappers";

// 離線優先（02 冊 UX 原則）：本地 IndexedDB 為寫入第一站。
// 床邊紀錄寫入時同一交易排入 outbox（modules/sync），上線後依序送往伺服器、由伺服器權威判定。
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
  eduUnits!: EntityTable<EduUnit, "id">;
  eduPushes!: EntityTable<EduPush, "id">;
  wounds!: EntityTable<Wound, "id">;
  woundAssessments!: EntityTable<WoundAssessment, "id">;
  customers!: EntityTable<Customer, "id">;
  requests!: EntityTable<ServiceRequest, "id">;
  reviews!: EntityTable<Review, "id">;
  complaints!: EntityTable<Complaint, "id">;
  nurseProfiles!: EntityTable<NurseProfile, "nurseId">;
  outbox!: EntityTable<OutboxItem, "seq">;
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
    this.version(5).stores({
      eduUnits: "id",
      eduPushes: "id, caseId, at",
    });
    this.version(6).stores({
      wounds: "id, caseId",
      woundAssessments: "id, woundId, caseId, at",
    });
    this.version(7).stores({
      customers: "id",
      requests: "id, status, createdAt",
      reviews: "id, caseId, nurseId, at",
      complaints: "id, status, at",
      nurseProfiles: "nurseId",
    });
    // 同步佇列（10 技術文件待辦 7）：床邊紀錄寫入本機時一併排入，上線後批次送出
    this.version(8).stores({
      outbox: "++seq, status, [entity+key]",
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

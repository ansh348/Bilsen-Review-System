import fs from "fs";
import path from "path";
import {
  AiFinalReportRecord,
  AnnotationRecord,
  ComplianceCheckRecord,
  NotificationRecord,
  PaperRecord,
  PaperVersionRecord,
  ReviewAssignmentRecord,
  ReviewerRatingRecord,
  ReviewRecord,
  ReviewRoundRecord,
  UserRecord,
  VenueRecord,
} from "@/lib/review-types";

const DATA_DIR = path.join(process.cwd(), "data");
const MOCK_DIR = path.join(DATA_DIR, "mock");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

interface AppSettings {
  mockMode: boolean;
}

function readSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      return JSON.parse(raw) as AppSettings;
    }
  } catch {
    // fall through
  }
  return { mockMode: false };
}

function writeSettings(settings: AppSettings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export function isMockMode(): boolean {
  return readSettings().mockMode;
}

export function setMockMode(enabled: boolean) {
  const settings = readSettings();
  settings.mockMode = enabled;
  writeSettings(settings);
}

type CollectionMap = {
  users: UserRecord[];
  venues: VenueRecord[];
  papers: PaperRecord[];
  rounds: ReviewRoundRecord[];
  assignments: ReviewAssignmentRecord[];
  reviews: ReviewRecord[];
  ratings: ReviewerRatingRecord[];
  complianceChecks: ComplianceCheckRecord[];
  notifications: NotificationRecord[];
  aiReports: AiFinalReportRecord[];
  annotations: AnnotationRecord[];
  paperVersions: PaperVersionRecord[];
};

const FILES: Record<keyof CollectionMap, string> = {
  users: "users.json",
  venues: "venues.json",
  papers: "papers.json",
  rounds: "rounds.json",
  assignments: "assignments.json",
  reviews: "reviews.json",
  ratings: "ratings.json",
  complianceChecks: "compliance_checks.json",
  notifications: "notifications.json",
  aiReports: "ai_reports.json",
  annotations: "annotations.json",
  paperVersions: "paper_versions.json",
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureCollection<K extends keyof CollectionMap>(collection: K) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, FILES[collection]);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
  return filePath;
}

function parseJson<T>(raw: string): T {
  if (!raw.trim()) {
    return [] as T;
  }
  return JSON.parse(raw) as T;
}

export function readCollection<K extends keyof CollectionMap>(
  collection: K
): CollectionMap[K] {
  if (isMockMode()) {
    const mockPath = path.join(MOCK_DIR, FILES[collection]);
    if (fs.existsSync(mockPath)) {
      const raw = fs.readFileSync(mockPath, "utf-8");
      return parseJson<CollectionMap[K]>(raw);
    }
    return [] as unknown as CollectionMap[K];
  }
  const filePath = ensureCollection(collection);
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseJson<CollectionMap[K]>(raw);
}

export function writeCollection<K extends keyof CollectionMap>(
  collection: K,
  data: CollectionMap[K]
) {
  if (isMockMode()) return;
  const filePath = ensureCollection(collection);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

export function upsertCollection<K extends keyof CollectionMap>(
  collection: K,
  transform: (records: CollectionMap[K]) => CollectionMap[K]
): CollectionMap[K] {
  const current = readCollection(collection);
  const next = transform(current);
  if (!isMockMode()) {
    writeCollection(collection, next);
  }
  return next;
}

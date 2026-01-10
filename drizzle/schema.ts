import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Concordia Shrine - セッションテーブル
 * 対話セッションのメタデータと分析結果を保存
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** セッションの一意識別子 */
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  /** セッションを作成したユーザー（nullの場合は匿名） */
  userId: int("userId").references(() => users.id),
  /** セッション開始時刻（Unix timestamp in ms） */
  startTime: bigint("startTime", { mode: "number" }).notNull(),
  /** セッション終了時刻（Unix timestamp in ms） */
  endTime: bigint("endTime", { mode: "number" }),
  /** セッションの総時間（ms） */
  duration: bigint("duration", { mode: "number" }),
  /** セキュリティスコア（0-100） */
  securityScore: int("securityScore"),
  /** シーン分布（JSON形式） */
  sceneDistribution: json("sceneDistribution").$type<Record<string, number>>(),
  /** イベントカウント（JSON形式） */
  eventCounts: json("eventCounts").$type<Record<string, number>>(),
  /** 分析インサイト（JSON形式） */
  insights: json("insights").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Concordia Shrine - ログエントリテーブル
 * セッション内の個別イベントを記録
 */
export const logEntries = mysqlTable("logEntries", {
  id: int("id").autoincrement().primaryKey(),
  /** 所属するセッションID */
  sessionId: int("sessionId").references(() => sessions.id).notNull(),
  /** イベントタイプ */
  type: mysqlEnum("type", ["scene_change", "speech", "event", "intervention"]).notNull(),
  /** タイムスタンプ（Unix timestamp in ms） */
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  /** イベントの内容 */
  content: text("content"),
  /** メタデータ（JSON形式） */
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LogEntry = typeof logEntries.$inferSelect;
export type InsertLogEntry = typeof logEntries.$inferInsert;

/**
 * Concordia Shrine - 介入設定テーブル
 * ユーザーごとの介入機能の設定
 */
export const interventionSettings = mysqlTable("interventionSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull().unique(),
  /** 介入機能の有効/無効 */
  enabled: int("enabled").default(1).notNull(),
  /** 一方的状態の閾値（秒） */
  monologueThreshold: int("monologueThreshold").default(30).notNull(),
  /** 沈黙状態の閾値（秒） */
  silenceThreshold: int("silenceThreshold").default(15).notNull(),
  /** 通知音の有効/無効 */
  soundEnabled: int("soundEnabled").default(1).notNull(),
  /** 視覚的ヒントの有効/無効 */
  visualHintEnabled: int("visualHintEnabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InterventionSettings = typeof interventionSettings.$inferSelect;
export type InsertInterventionSettings = typeof interventionSettings.$inferInsert;

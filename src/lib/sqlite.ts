import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { blankStorySeed } from "@/data/sample-story";
import { createProjectSeed } from "@/lib/project-utils";
import type { PlaythroughState, ProjectSummary, StoryGame } from "@/lib/story-engine";

type SqliteGlobal = typeof globalThis & {
  __interactiveFilmDb__?: DatabaseSync;
};

type LegacyGameRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  promo_video_url: string;
  promo_poster_url: string;
  promo_text: string;
  start_node_code: string;
  variables_json: string;
};

type LegacyNodeRow = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  video_url: string;
  node_type: "video" | "ending";
  auto_next_node_code: string | null;
  is_ending: number;
  ending_tone: StoryGame["nodes"][number]["endingTone"] | null;
  timeline_events_json: string;
};

type LegacyChoiceRow = {
  node_code: string;
  code: string;
  label: string;
  hint: string;
  target_node_code: string;
};

type DbProjectRow = {
  slug: string;
  game_json: string;
  updated_at: string;
};

type DbPlaythroughRow = {
  id: string;
  game_slug: string;
  current_node_code: string;
  status: "in_progress" | "completed";
  started_at: string;
  finished_at: string | null;
  history_json: string;
  variables_json: string;
  triggered_event_ids_json: string;
};

const DB_PATH = join(process.cwd(), "data", "app.db");

function ensureParentDir(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function getDb() {
  const globalDb = globalThis as SqliteGlobal;

  if (!globalDb.__interactiveFilmDb__) {
    ensureParentDir(DB_PATH);
    globalDb.__interactiveFilmDb__ = new DatabaseSync(DB_PATH);
  }

  initializeDb(globalDb.__interactiveFilmDb__);
  return globalDb.__interactiveFilmDb__;
}

function nowIso() {
  return new Date().toISOString();
}

function parseProjectRow(row: DbProjectRow): StoryGame {
  return JSON.parse(row.game_json) as StoryGame;
}

function toProjectSummary(row: DbProjectRow): ProjectSummary {
  const game = parseProjectRow(row);
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    tagline: game.tagline,
    listedOnHome: game.listedOnHome,
    sortOrder: game.sortOrder,
    promoVideoUrl: game.promoVideoUrl,
    promoPosterUrl: game.promoPosterUrl,
    updatedAt: row.updated_at,
  };
}

function readLegacyGame(db: DatabaseSync): StoryGame | null {
  const hasLegacyGameTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'game'")
    .get() as { name?: string } | undefined;

  if (!hasLegacyGameTable?.name) {
    return null;
  }

  const gameRow = db.prepare(`
    SELECT id, slug, title, tagline, intro, promo_video_url, promo_poster_url, promo_text, start_node_code, variables_json
    FROM game
    LIMIT 1
  `).get() as LegacyGameRow | undefined;

  if (!gameRow) {
    return null;
  }

  const choiceRows = db.prepare(`
    SELECT node_code, code, label, hint, target_node_code
    FROM story_choices
    ORDER BY node_code, code
  `).all() as LegacyChoiceRow[];

  const choiceMap = new Map<string, LegacyChoiceRow[]>();
  for (const row of choiceRows) {
    const items = choiceMap.get(row.node_code) ?? [];
    items.push(row);
    choiceMap.set(row.node_code, items);
  }

  const nodeRows = db.prepare(`
    SELECT code, title, description, transcript, video_url, node_type, auto_next_node_code, is_ending, ending_tone, timeline_events_json
    FROM story_nodes
    ORDER BY code
  `).all() as LegacyNodeRow[];

  return {
    id: gameRow.id,
    slug: gameRow.slug,
    title: gameRow.title,
    tagline: gameRow.tagline,
    listedOnHome: true,
    sortOrder: 0,
    intro: gameRow.intro,
    promoVideoUrl: gameRow.promo_video_url,
    promoPosterUrl: gameRow.promo_poster_url,
    promoText: gameRow.promo_text,
    startNodeCode: gameRow.start_node_code,
    variables: JSON.parse(gameRow.variables_json || "[]"),
    nodes: nodeRows.map((row) => ({
      code: row.code,
      title: row.title,
      description: row.description,
      transcript: row.transcript,
      videoUrl: row.video_url,
      nodeType: row.node_type,
      autoNextNodeCode: row.auto_next_node_code ?? undefined,
      isEnding: Boolean(row.is_ending),
      endingTone: row.ending_tone ?? undefined,
      timelineEvents: JSON.parse(row.timeline_events_json || "[]"),
      choices: (choiceMap.get(row.code) ?? []).map((choice) => ({
        code: choice.code,
        label: choice.label,
        hint: choice.hint,
        targetNodeCode: choice.target_node_code,
      })),
    })),
  };
}

function initializeDb(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      slug TEXT PRIMARY KEY,
      game_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playthroughs (
      id TEXT PRIMARY KEY,
      game_slug TEXT NOT NULL,
      current_node_code TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      history_json TEXT NOT NULL DEFAULT '[]',
      variables_json TEXT NOT NULL DEFAULT '{}',
      triggered_event_ids_json TEXT NOT NULL DEFAULT '[]'
    );
  `);

  const playthroughColumns = db.prepare("PRAGMA table_info(playthroughs)").all() as Array<{ name: string }>;
  const playthroughColumnNames = new Set(playthroughColumns.map((column) => column.name));

  if (!playthroughColumnNames.has("history_json")) {
    db.exec("ALTER TABLE playthroughs ADD COLUMN history_json TEXT NOT NULL DEFAULT '[]'");
  }

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number };

  if (!countRow.count) {
    const legacyGame = readLegacyGame(db);
    const seed = legacyGame ?? createProjectSeed(blankStorySeed);
    db.prepare(`
      INSERT INTO projects (slug, game_json, updated_at)
      VALUES (?, ?, ?)
    `).run(seed.slug, JSON.stringify(seed), nowIso());
  }
}

export function listProjectsFromDb(): ProjectSummary[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT slug, game_json, updated_at
    FROM projects
    ORDER BY updated_at DESC, slug ASC
  `).all() as DbProjectRow[];

  return rows.map(toProjectSummary);
}

export function loadProjectFromDb(slug?: string): StoryGame {
  const db = getDb();

  const row = slug?.trim()
    ? (db.prepare(`
        SELECT slug, game_json, updated_at
        FROM projects
        WHERE slug = ?
        LIMIT 1
      `).get(slug.trim()) as DbProjectRow | undefined)
    : (db.prepare(`
        SELECT slug, game_json, updated_at
        FROM projects
        ORDER BY updated_at DESC, slug ASC
        LIMIT 1
      `).get() as DbProjectRow | undefined);

  if (!row) {
    throw new Error("Project not found");
  }

  return parseProjectRow(row);
}

export function saveProjectToDb(game: StoryGame) {
  const db = getDb();

  db.prepare(`
    INSERT INTO projects (slug, game_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      game_json = excluded.game_json,
      updated_at = excluded.updated_at
  `).run(game.slug, JSON.stringify(game), nowIso());
}

export function deleteProjectFromDb(slug: string) {
  const db = getDb();

  db.prepare("DELETE FROM projects WHERE slug = ?").run(slug);
  db.prepare("DELETE FROM playthroughs WHERE game_slug = ?").run(slug);
}

export function upsertPlaythrough(session: PlaythroughState) {
  const db = getDb();

  db.prepare(`
    INSERT INTO playthroughs (
      id, game_slug, current_node_code, status, started_at, finished_at, history_json, variables_json, triggered_event_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      game_slug = excluded.game_slug,
      current_node_code = excluded.current_node_code,
      status = excluded.status,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at,
      history_json = excluded.history_json,
      variables_json = excluded.variables_json,
      triggered_event_ids_json = excluded.triggered_event_ids_json
  `).run(
    session.id,
    session.gameSlug,
    session.currentNodeCode,
    session.status,
    session.startedAt,
    session.finishedAt ?? null,
    JSON.stringify(session.history ?? []),
    JSON.stringify(session.variables ?? {}),
    JSON.stringify(session.triggeredEventIds ?? []),
  );
}

export function loadPlaythrough(playthroughId: string): PlaythroughState | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, game_slug, current_node_code, status, started_at, finished_at, history_json, variables_json, triggered_event_ids_json
    FROM playthroughs
    WHERE id = ?
  `).get(playthroughId) as DbPlaythroughRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    gameSlug: row.game_slug,
    currentNodeCode: row.current_node_code,
    status: row.status,
    history: JSON.parse(row.history_json || "[]"),
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    variables: JSON.parse(row.variables_json || "{}"),
    triggeredEventIds: JSON.parse(row.triggered_event_ids_json || "[]"),
  };
}

export function getDbFilePath() {
  return DB_PATH;
}

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { blankStorySeed } from "@/data/sample-story";
import type {
  EndingTone,
  PlaythroughState,
  StoryChoice,
  StoryGame,
  StoryNode,
  TimelineEvent,
  VariableDefinition,
} from "@/lib/story-engine";

type SqliteGlobal = typeof globalThis & {
  __interactiveFilmDb__?: DatabaseSync;
};

type DbGameRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  promo_video_url: string;
  promo_poster_url: string;
  promo_title: string;
  promo_text: string;
  start_node_code: string;
  variables_json: string;
};

type DbNodeRow = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  video_url: string;
  node_type: "video" | "ending";
  auto_next_node_code: string | null;
  is_ending: number;
  ending_tone: EndingTone | null;
  timeline_events_json: string;
};

type DbChoiceRow = {
  node_code: string;
  code: string;
  label: string;
  hint: string;
  target_node_code: string;
};

type DbPlaythroughRow = {
  id: string;
  game_slug: string;
  current_node_code: string;
  status: "in_progress" | "completed";
  started_at: string;
  finished_at: string | null;
  variables_json: string;
  triggered_event_ids_json: string;
};

type DbChoiceLogRow = {
  playthrough_id: string;
  node_code: string;
  choice_code: string;
  choice_label: string;
  target_node_code: string;
  chosen_at: string;
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

function initializeDb(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS game (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      tagline TEXT NOT NULL,
      intro TEXT NOT NULL,
      promo_video_url TEXT NOT NULL DEFAULT '',
      promo_poster_url TEXT NOT NULL DEFAULT '',
      promo_title TEXT NOT NULL DEFAULT '',
      promo_text TEXT NOT NULL DEFAULT '',
      start_node_code TEXT NOT NULL,
      variables_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS story_nodes (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      transcript TEXT NOT NULL,
      video_url TEXT NOT NULL,
      node_type TEXT NOT NULL,
      auto_next_node_code TEXT,
      is_ending INTEGER NOT NULL DEFAULT 0,
      ending_tone TEXT,
      timeline_events_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS story_choices (
      node_code TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      hint TEXT NOT NULL,
      target_node_code TEXT NOT NULL,
      PRIMARY KEY (node_code, code),
      FOREIGN KEY (node_code) REFERENCES story_nodes(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playthroughs (
      id TEXT PRIMARY KEY,
      game_slug TEXT NOT NULL,
      current_node_code TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      variables_json TEXT NOT NULL DEFAULT '{}',
      triggered_event_ids_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS choice_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playthrough_id TEXT NOT NULL,
      node_code TEXT NOT NULL,
      choice_code TEXT NOT NULL,
      choice_label TEXT NOT NULL,
      target_node_code TEXT NOT NULL,
      chosen_at TEXT NOT NULL,
      FOREIGN KEY (playthrough_id) REFERENCES playthroughs(id) ON DELETE CASCADE
    );
  `);

  const hasGame = db.prepare("SELECT COUNT(*) AS count FROM game").get() as {
    count: number;
  };

  const columns = db.prepare("PRAGMA table_info(game)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("promo_video_url")) {
    db.exec("ALTER TABLE game ADD COLUMN promo_video_url TEXT NOT NULL DEFAULT ''");
  }

  if (!columnNames.has("promo_poster_url")) {
    db.exec("ALTER TABLE game ADD COLUMN promo_poster_url TEXT NOT NULL DEFAULT ''");
  }

  if (!columnNames.has("promo_title")) {
    db.exec("ALTER TABLE game ADD COLUMN promo_title TEXT NOT NULL DEFAULT ''");
  }

  if (!columnNames.has("promo_text")) {
    db.exec("ALTER TABLE game ADD COLUMN promo_text TEXT NOT NULL DEFAULT ''");
  }

  if (!columnNames.has("variables_json")) {
    db.exec("ALTER TABLE game ADD COLUMN variables_json TEXT NOT NULL DEFAULT '[]'");
  }

  const nodeColumns = db.prepare("PRAGMA table_info(story_nodes)").all() as Array<{ name: string }>;
  const nodeColumnNames = new Set(nodeColumns.map((column) => column.name));

  if (!nodeColumnNames.has("timeline_events_json")) {
    db.exec("ALTER TABLE story_nodes ADD COLUMN timeline_events_json TEXT NOT NULL DEFAULT '[]'");
  }

  const playthroughColumns = db.prepare("PRAGMA table_info(playthroughs)").all() as Array<{ name: string }>;
  const playthroughColumnNames = new Set(playthroughColumns.map((column) => column.name));

  if (!playthroughColumnNames.has("variables_json")) {
    db.exec("ALTER TABLE playthroughs ADD COLUMN variables_json TEXT NOT NULL DEFAULT '{}'");
  }

  if (!playthroughColumnNames.has("triggered_event_ids_json")) {
    db.exec("ALTER TABLE playthroughs ADD COLUMN triggered_event_ids_json TEXT NOT NULL DEFAULT '[]'");
  }

  if (!hasGame.count) {
    seedDatabase(db);
  }
}

function seedDatabase(db: DatabaseSync) {
  const insertGame = db.prepare(`
    INSERT INTO game (
      id, slug, title, tagline, intro,
      promo_video_url, promo_poster_url, promo_title, promo_text,
      variables_json,
      start_node_code
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNode = db.prepare(`
    INSERT INTO story_nodes (
      code, title, description, transcript, video_url, node_type,
      auto_next_node_code, is_ending, ending_tone, timeline_events_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChoice = db.prepare(`
    INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");

  try {
    insertGame.run(
      blankStorySeed.id,
      blankStorySeed.slug,
      blankStorySeed.title,
      blankStorySeed.tagline,
      blankStorySeed.intro,
      blankStorySeed.promoVideoUrl,
      blankStorySeed.promoPosterUrl,
      "",
      blankStorySeed.promoText,
      JSON.stringify(blankStorySeed.variables ?? []),
      blankStorySeed.startNodeCode,
    );

    for (const node of blankStorySeed.nodes) {
      insertNode.run(
        node.code,
        node.title,
        node.description,
        node.transcript,
        node.videoUrl,
        node.nodeType,
        node.autoNextNodeCode ?? null,
        node.isEnding ? 1 : 0,
        node.endingTone ?? null,
        JSON.stringify(node.timelineEvents ?? []),
      );

      for (const choice of node.choices ?? []) {
        insertChoice.run(
          node.code,
          choice.code,
          choice.label,
          choice.hint,
          choice.targetNodeCode,
        );
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function mapChoiceRow(row: DbChoiceRow): StoryChoice {
  return {
    code: row.code,
    label: row.label,
    hint: row.hint,
    targetNodeCode: row.target_node_code,
  };
}

function mapNodeRow(row: DbNodeRow, choices: StoryChoice[]): StoryNode {
  return {
    code: row.code,
    title: row.title,
    description: row.description,
    transcript: row.transcript,
    videoUrl: row.video_url,
    nodeType: row.node_type,
    autoNextNodeCode: row.auto_next_node_code ?? undefined,
    isEnding: Boolean(row.is_ending),
    endingTone: row.ending_tone ?? undefined,
    choices,
    timelineEvents: JSON.parse(row.timeline_events_json || "[]") as TimelineEvent[],
  };
}

function getChoicesByNodeCode(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT node_code, code, label, hint, target_node_code
    FROM story_choices
    ORDER BY node_code, code
  `).all() as DbChoiceRow[];
  const byNode = new Map<string, StoryChoice[]>();

  for (const row of rows) {
    const existing = byNode.get(row.node_code) ?? [];
    existing.push(mapChoiceRow(row));
    byNode.set(row.node_code, existing);
  }

  return byNode;
}

export function loadGameFromDb(): StoryGame {
  const db = getDb();
  const gameRow = db.prepare(`
    SELECT id, slug, title, tagline, intro,
           promo_video_url, promo_poster_url, promo_title, promo_text,
           variables_json,
           start_node_code
    FROM game
    LIMIT 1
  `).get() as DbGameRow | undefined;

  if (!gameRow) {
    throw new Error("Game configuration not found");
  }

  const choiceMap = getChoicesByNodeCode(db);
  const nodeRows = db.prepare(`
    SELECT code, title, description, transcript, video_url, node_type,
           auto_next_node_code, is_ending, ending_tone, timeline_events_json
    FROM story_nodes
    ORDER BY code
  `).all() as DbNodeRow[];

  return {
    id: gameRow.id,
    slug: gameRow.slug,
    title: gameRow.title,
    tagline: gameRow.tagline,
    intro: gameRow.intro,
    promoVideoUrl: gameRow.promo_video_url,
    promoPosterUrl: gameRow.promo_poster_url,
    promoText: gameRow.promo_text,
    startNodeCode: gameRow.start_node_code,
    variables: JSON.parse(gameRow.variables_json || "[]") as VariableDefinition[],
    nodes: nodeRows.map((row) => mapNodeRow(row, choiceMap.get(row.code) ?? [])),
  };
}

export function persistGameMeta(input: {
  title?: string;
  tagline?: string;
  intro?: string;
  promoVideoUrl?: string;
  promoPosterUrl?: string;
  promoText?: string;
  startNodeCode?: string;
  variables?: VariableDefinition[];
}) {
  const db = getDb();
  const current = loadGameFromDb();

  db.prepare(`
    UPDATE game
    SET title = ?, tagline = ?, intro = ?,
        promo_video_url = ?, promo_poster_url = ?, promo_title = ?, promo_text = ?,
        variables_json = ?,
        start_node_code = ?
    WHERE id = ?
  `).run(
    input.title ?? current.title,
    input.tagline ?? current.tagline,
    input.intro ?? current.intro,
    input.promoVideoUrl ?? current.promoVideoUrl,
    input.promoPosterUrl ?? current.promoPosterUrl,
    "",
    input.promoText ?? current.promoText,
    JSON.stringify(input.variables ?? current.variables ?? []),
    input.startNodeCode ?? current.startNodeCode,
    current.id,
  );
}

export function insertNodeRecord(node: StoryNode) {
  const db = getDb();

  db.prepare(`
    INSERT INTO story_nodes (
      code, title, description, transcript, video_url, node_type,
      auto_next_node_code, is_ending, ending_tone, timeline_events_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    node.code,
    node.title,
    node.description,
    node.transcript,
    node.videoUrl,
    node.nodeType,
    node.autoNextNodeCode ?? null,
    node.isEnding ? 1 : 0,
    node.endingTone ?? null,
    JSON.stringify(node.timelineEvents ?? []),
  );
}

export function updateNodeRecord(node: StoryNode) {
  const db = getDb();

  db.exec("BEGIN");

  try {
    db.prepare(`
      UPDATE story_nodes
      SET title = ?, description = ?, transcript = ?, video_url = ?,
          node_type = ?, auto_next_node_code = ?, is_ending = ?, ending_tone = ?, timeline_events_json = ?
      WHERE code = ?
    `).run(
      node.title,
      node.description,
      node.transcript,
      node.videoUrl,
      node.nodeType,
      node.autoNextNodeCode ?? null,
      node.isEnding ? 1 : 0,
      node.endingTone ?? null,
      JSON.stringify(node.timelineEvents ?? []),
      node.code,
    );

    db.prepare("DELETE FROM story_choices WHERE node_code = ?").run(node.code);

    const insertChoice = db.prepare(`
      INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const choice of node.choices ?? []) {
      insertChoice.run(
        node.code,
        choice.code,
        choice.label,
        choice.hint,
        choice.targetNodeCode,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function insertChoiceRecord(nodeCode: string, choice: StoryChoice) {
  const db = getDb();

  db.prepare(`
    INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
    VALUES (?, ?, ?, ?, ?)
  `).run(nodeCode, choice.code, choice.label, choice.hint, choice.targetNodeCode);
}

export function createPlaythroughRecord(input: {
  id: string;
  gameSlug: string;
  currentNodeCode: string;
  status: "in_progress" | "completed";
  startedAt: string;
  finishedAt?: string;
  variables?: PlaythroughState["variables"];
  triggeredEventIds?: string[];
}) {
  const db = getDb();

  db.prepare(`
    INSERT INTO playthroughs (
      id, game_slug, current_node_code, status, started_at, finished_at, variables_json, triggered_event_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.gameSlug,
    input.currentNodeCode,
    input.status,
    input.startedAt,
    input.finishedAt ?? null,
    JSON.stringify(input.variables ?? {}),
    JSON.stringify(input.triggeredEventIds ?? []),
  );
}

export function updatePlaythroughRecord(session: PlaythroughState) {
  const db = getDb();

  db.prepare(`
    UPDATE playthroughs
    SET current_node_code = ?, status = ?, started_at = ?, finished_at = ?, variables_json = ?, triggered_event_ids_json = ?
    WHERE id = ?
  `).run(
    session.currentNodeCode,
    session.status,
    session.startedAt,
    session.finishedAt ?? null,
    JSON.stringify(session.variables ?? {}),
    JSON.stringify(session.triggeredEventIds ?? []),
    session.id,
  );
}

export function replaceChoiceLogs(
  playthroughId: string,
  history: PlaythroughState["history"],
) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO choice_logs (
      playthrough_id, node_code, choice_code, choice_label, target_node_code, chosen_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");

  try {
    db.prepare("DELETE FROM choice_logs WHERE playthrough_id = ?").run(playthroughId);

    for (const entry of history) {
      insert.run(
        playthroughId,
        entry.nodeCode,
        entry.choiceCode,
        entry.choiceLabel,
        entry.targetNodeCode,
        entry.chosenAt,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function loadPlaythrough(playthroughId: string): PlaythroughState | null {
  const db = getDb();
  const sessionRow = db.prepare(`
    SELECT id, game_slug, current_node_code, status, started_at, finished_at, variables_json, triggered_event_ids_json
    FROM playthroughs
    WHERE id = ?
  `).get(playthroughId) as DbPlaythroughRow | undefined;

  if (!sessionRow) {
    return null;
  }

  const historyRows = db.prepare(`
    SELECT playthrough_id, node_code, choice_code, choice_label, target_node_code, chosen_at
    FROM choice_logs
    WHERE playthrough_id = ?
    ORDER BY id
  `).all(playthroughId) as DbChoiceLogRow[];

  return {
    id: sessionRow.id,
    gameSlug: sessionRow.game_slug,
    currentNodeCode: sessionRow.current_node_code,
    status: sessionRow.status,
    startedAt: sessionRow.started_at,
    finishedAt: sessionRow.finished_at ?? undefined,
    variables: JSON.parse(sessionRow.variables_json || "{}") as PlaythroughState["variables"],
    triggeredEventIds: JSON.parse(sessionRow.triggered_event_ids_json || "[]") as string[],
    history: historyRows.map((row) => ({
      nodeCode: row.node_code,
      choiceCode: row.choice_code,
      choiceLabel: row.choice_label,
      targetNodeCode: row.target_node_code,
      chosenAt: row.chosen_at,
    })),
  };
}

export function getDbFilePath() {
  return DB_PATH;
}

export function resetDatabaseToSeed(game: StoryGame) {
  const db = getDb();
  const insertGame = db.prepare(`
    INSERT INTO game (
      id, slug, title, tagline, intro,
      promo_video_url, promo_poster_url, promo_title, promo_text,
      variables_json,
      start_node_code
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNode = db.prepare(`
    INSERT INTO story_nodes (
      code, title, description, transcript, video_url, node_type,
      auto_next_node_code, is_ending, ending_tone, timeline_events_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChoice = db.prepare(`
    INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");

  try {
    db.exec("DELETE FROM choice_logs");
    db.exec("DELETE FROM playthroughs");
    db.exec("DELETE FROM story_choices");
    db.exec("DELETE FROM story_nodes");
    db.exec("DELETE FROM game");

    insertGame.run(
      game.id,
      game.slug,
      game.title,
      game.tagline,
      game.intro,
      game.promoVideoUrl,
      game.promoPosterUrl,
      "",
      game.promoText,
      JSON.stringify(game.variables ?? []),
      game.startNodeCode,
    );

    for (const node of game.nodes) {
      insertNode.run(
        node.code,
        node.title,
        node.description,
        node.transcript,
        node.videoUrl,
        node.nodeType,
        node.autoNextNodeCode ?? null,
        node.isEnding ? 1 : 0,
        node.endingTone ?? null,
        JSON.stringify(node.timelineEvents ?? []),
      );

      for (const choice of node.choices ?? []) {
        insertChoice.run(
          node.code,
          choice.code,
          choice.label,
          choice.hint,
          choice.targetNodeCode,
        );
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

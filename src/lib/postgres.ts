import { Pool, type PoolClient } from "pg";
import { blankStorySeed } from "@/data/sample-story";
import { createProjectSeed } from "@/lib/project-utils";
import type { PlaythroughState, ProjectSummary, StoryGame } from "@/lib/story-engine";

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
  is_ending: boolean;
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

type PostgresGlobal = typeof globalThis & {
  __interactiveFilmPgPool__?: Pool;
  __interactiveFilmPgInitPromise__?: Promise<void>;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return databaseUrl;
}

function getSslConfig() {
  const sslValue = process.env.PGSSL?.trim().toLowerCase();

  if (!sslValue || sslValue === "false" || sslValue === "0" || sslValue === "disable") {
    return false;
  }

  return {
    rejectUnauthorized: false,
  };
}

function getPool() {
  const globalPg = globalThis as PostgresGlobal;

  if (!globalPg.__interactiveFilmPgPool__) {
    globalPg.__interactiveFilmPgPool__ = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: getSslConfig(),
    });
  }

  return globalPg.__interactiveFilmPgPool__;
}

async function withClient<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    return await run(client);
  } finally {
    client.release();
  }
}

async function runTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  return withClient(async (client) => {
    await client.query("BEGIN");

    try {
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
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

async function readLegacyGame(client: PoolClient): Promise<StoryGame | null> {
  const gameExists = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'game'
    ) AS exists
  `);

  if (!gameExists.rows[0]?.exists) {
    return null;
  }

  const gameResult = await client.query<LegacyGameRow>(`
    SELECT id, slug, title, tagline, intro, promo_video_url, promo_poster_url, promo_text, start_node_code, variables_json
    FROM game
    LIMIT 1
  `);
  const gameRow = gameResult.rows[0];

  if (!gameRow) {
    return null;
  }

  const choiceRows = await client.query<LegacyChoiceRow>(`
    SELECT node_code, code, label, hint, target_node_code
    FROM story_choices
    ORDER BY node_code, code
  `);
  const choiceMap = new Map<string, LegacyChoiceRow[]>();
  for (const row of choiceRows.rows) {
    const items = choiceMap.get(row.node_code) ?? [];
    items.push(row);
    choiceMap.set(row.node_code, items);
  }

  const nodeRows = await client.query<LegacyNodeRow>(`
    SELECT code, title, description, transcript, video_url, node_type, auto_next_node_code, is_ending, ending_tone, timeline_events_json
    FROM story_nodes
    ORDER BY code
  `);

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
    nodes: nodeRows.rows.map((row) => ({
      code: row.code,
      title: row.title,
      description: row.description,
      transcript: row.transcript,
      videoUrl: row.video_url,
      nodeType: row.node_type,
      autoNextNodeCode: row.auto_next_node_code ?? undefined,
      isEnding: row.is_ending,
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

export async function initializePostgres() {
  const globalPg = globalThis as PostgresGlobal;

  if (!globalPg.__interactiveFilmPgInitPromise__) {
    globalPg.__interactiveFilmPgInitPromise__ = runTransaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          slug TEXT PRIMARY KEY,
          game_json JSONB NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS playthroughs (
          id TEXT PRIMARY KEY,
          game_slug TEXT NOT NULL,
          current_node_code TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          variables_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          triggered_event_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb
        )
      `);

      await client.query(`
        ALTER TABLE playthroughs
        ADD COLUMN IF NOT EXISTS history_json JSONB NOT NULL DEFAULT '[]'::jsonb
      `);

      const countResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM projects");

      if (Number(countResult.rows[0]?.count ?? "0") === 0) {
        const legacyGame = await readLegacyGame(client);
        const seed = legacyGame ?? createProjectSeed(blankStorySeed);

        await client.query(
          `
            INSERT INTO projects (slug, game_json, updated_at)
            VALUES ($1, $2::jsonb, $3)
          `,
          [seed.slug, JSON.stringify(seed), nowIso()],
        );
      }
    });
  }

  await globalPg.__interactiveFilmPgInitPromise__;
}

export async function listProjectsFromPostgres(): Promise<ProjectSummary[]> {
  await initializePostgres();

  return withClient(async (client) => {
    const result = await client.query<DbProjectRow>(`
      SELECT slug, game_json::text AS game_json, updated_at
      FROM projects
      ORDER BY updated_at DESC, slug ASC
    `);

    return result.rows.map(toProjectSummary);
  });
}

export async function loadProjectFromPostgres(slug?: string): Promise<StoryGame> {
  await initializePostgres();

  return withClient(async (client) => {
    const result = slug?.trim()
      ? await client.query<DbProjectRow>(
          `
            SELECT slug, game_json::text AS game_json, updated_at
            FROM projects
            WHERE slug = $1
            LIMIT 1
          `,
          [slug.trim()],
        )
      : await client.query<DbProjectRow>(`
          SELECT slug, game_json::text AS game_json, updated_at
          FROM projects
          ORDER BY updated_at DESC, slug ASC
          LIMIT 1
        `);

    const row = result.rows[0];

    if (!row) {
      throw new Error("Project not found");
    }

    return parseProjectRow(row);
  });
}

export async function saveProjectToPostgres(game: StoryGame) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO projects (slug, game_json, updated_at)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(slug) DO UPDATE SET
          game_json = excluded.game_json,
          updated_at = excluded.updated_at
      `,
      [game.slug, JSON.stringify(game), nowIso()],
    );
  });
}

export async function deleteProjectFromPostgres(slug: string) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query("DELETE FROM projects WHERE slug = $1", [slug]);
    await client.query("DELETE FROM playthroughs WHERE game_slug = $1", [slug]);
  });
}

export async function upsertPlaythroughInPostgres(session: PlaythroughState) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO playthroughs (
          id, game_slug, current_node_code, status, started_at, finished_at, history_json, variables_json, triggered_event_ids_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
        ON CONFLICT(id) DO UPDATE SET
          game_slug = excluded.game_slug,
          current_node_code = excluded.current_node_code,
          status = excluded.status,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          history_json = excluded.history_json,
          variables_json = excluded.variables_json,
          triggered_event_ids_json = excluded.triggered_event_ids_json
      `,
      [
        session.id,
        session.gameSlug,
        session.currentNodeCode,
        session.status,
        session.startedAt,
        session.finishedAt ?? null,
        JSON.stringify(session.history ?? []),
        JSON.stringify(session.variables ?? {}),
        JSON.stringify(session.triggeredEventIds ?? []),
      ],
    );
  });
}

export async function loadPlaythroughFromPostgres(playthroughId: string): Promise<PlaythroughState | null> {
  await initializePostgres();

  return withClient(async (client) => {
    const result = await client.query<DbPlaythroughRow>(
      `
        SELECT id, game_slug, current_node_code, status, started_at, finished_at,
               history_json::text AS history_json,
               variables_json::text AS variables_json,
               triggered_event_ids_json::text AS triggered_event_ids_json
        FROM playthroughs
        WHERE id = $1
      `,
      [playthroughId],
    );

    const row = result.rows[0];

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
  });
}

export function getPostgresConnectionLabel() {
  return "postgres";
}

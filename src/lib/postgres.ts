import { Pool, type PoolClient } from "pg";
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
  is_ending: boolean;
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
    isEnding: row.is_ending,
    endingTone: row.ending_tone ?? undefined,
    choices,
    timelineEvents: JSON.parse(row.timeline_events_json || "[]") as TimelineEvent[],
  };
}

async function getChoicesByNodeCode(client: PoolClient) {
  const result = await client.query<DbChoiceRow>(`
    SELECT node_code, code, label, hint, target_node_code
    FROM story_choices
    ORDER BY node_code, code
  `);
  const byNode = new Map<string, StoryChoice[]>();

  for (const row of result.rows) {
    const existing = byNode.get(row.node_code) ?? [];
    existing.push(mapChoiceRow(row));
    byNode.set(row.node_code, existing);
  }

  return byNode;
}

async function seedPostgres(client: PoolClient, game: StoryGame) {
  await client.query(
    `
      INSERT INTO game (
        id, slug, title, tagline, intro,
        promo_video_url, promo_poster_url, promo_title, promo_text,
        variables_json,
        start_node_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
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
    ],
  );

  for (const node of game.nodes) {
    await client.query(
      `
        INSERT INTO story_nodes (
          code, title, description, transcript, video_url, node_type,
          auto_next_node_code, is_ending, ending_tone, timeline_events_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        node.code,
        node.title,
        node.description,
        node.transcript,
        node.videoUrl,
        node.nodeType,
        node.autoNextNodeCode ?? null,
        Boolean(node.isEnding),
        node.endingTone ?? null,
        JSON.stringify(node.timelineEvents ?? []),
      ],
    );

    for (const choice of node.choices ?? []) {
      await client.query(
        `
          INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          node.code,
          choice.code,
          choice.label,
          choice.hint,
          choice.targetNodeCode,
        ],
      );
    }
  }
}

export async function initializePostgres() {
  const globalPg = globalThis as PostgresGlobal;

  if (!globalPg.__interactiveFilmPgInitPromise__) {
    globalPg.__interactiveFilmPgInitPromise__ = runTransaction(async (client) => {
      await client.query(`
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
        )
      `);

      await client.query(`
        ALTER TABLE game
        ADD COLUMN IF NOT EXISTS promo_video_url TEXT NOT NULL DEFAULT ''
      `);
      await client.query(`
        ALTER TABLE game
        ADD COLUMN IF NOT EXISTS promo_poster_url TEXT NOT NULL DEFAULT ''
      `);
      await client.query(`
        ALTER TABLE game
        ADD COLUMN IF NOT EXISTS promo_title TEXT NOT NULL DEFAULT ''
      `);
      await client.query(`
        ALTER TABLE game
        ADD COLUMN IF NOT EXISTS promo_text TEXT NOT NULL DEFAULT ''
      `);
      await client.query(`
        ALTER TABLE game
        ADD COLUMN IF NOT EXISTS variables_json TEXT NOT NULL DEFAULT '[]'
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS story_nodes (
          code TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          transcript TEXT NOT NULL,
          video_url TEXT NOT NULL,
          node_type TEXT NOT NULL,
          auto_next_node_code TEXT,
          is_ending BOOLEAN NOT NULL DEFAULT FALSE,
          ending_tone TEXT,
          timeline_events_json TEXT NOT NULL DEFAULT '[]'
        )
      `);

      await client.query(`
        ALTER TABLE story_nodes
        ADD COLUMN IF NOT EXISTS timeline_events_json TEXT NOT NULL DEFAULT '[]'
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS story_choices (
          node_code TEXT NOT NULL REFERENCES story_nodes(code) ON DELETE CASCADE,
          code TEXT NOT NULL,
          label TEXT NOT NULL,
          hint TEXT NOT NULL,
          target_node_code TEXT NOT NULL,
          PRIMARY KEY (node_code, code)
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
          variables_json TEXT NOT NULL DEFAULT '{}',
          triggered_event_ids_json TEXT NOT NULL DEFAULT '[]'
        )
      `);

      await client.query(`
        ALTER TABLE playthroughs
        ADD COLUMN IF NOT EXISTS variables_json TEXT NOT NULL DEFAULT '{}'
      `);
      await client.query(`
        ALTER TABLE playthroughs
        ADD COLUMN IF NOT EXISTS triggered_event_ids_json TEXT NOT NULL DEFAULT '[]'
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS choice_logs (
          id BIGSERIAL PRIMARY KEY,
          playthrough_id TEXT NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
          node_code TEXT NOT NULL,
          choice_code TEXT NOT NULL,
          choice_label TEXT NOT NULL,
          target_node_code TEXT NOT NULL,
          chosen_at TEXT NOT NULL
        )
      `);

      const gameCount = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM game");

      if (Number(gameCount.rows[0]?.count ?? "0") === 0) {
        await seedPostgres(client, blankStorySeed);
      }
    });
  }

  await globalPg.__interactiveFilmPgInitPromise__;
}

export async function loadGameFromPostgres(): Promise<StoryGame> {
  await initializePostgres();

  return withClient(async (client) => {
    const gameResult = await client.query<DbGameRow>(`
      SELECT id, slug, title, tagline, intro,
             promo_video_url, promo_poster_url, promo_title, promo_text,
             variables_json,
             start_node_code
      FROM game
      LIMIT 1
    `);
    const gameRow = gameResult.rows[0];

    if (!gameRow) {
      throw new Error("Game configuration not found");
    }

    const choiceMap = await getChoicesByNodeCode(client);
    const nodeResult = await client.query<DbNodeRow>(`
      SELECT code, title, description, transcript, video_url, node_type,
             auto_next_node_code, is_ending, ending_tone, timeline_events_json
      FROM story_nodes
      ORDER BY code
    `);

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
      nodes: nodeResult.rows.map((row) => mapNodeRow(row, choiceMap.get(row.code) ?? [])),
    };
  });
}

export async function persistGameMetaInPostgres(input: {
  title?: string;
  tagline?: string;
  intro?: string;
  promoVideoUrl?: string;
  promoPosterUrl?: string;
  promoText?: string;
  startNodeCode?: string;
  variables?: VariableDefinition[];
}) {
  await initializePostgres();
  const current = await loadGameFromPostgres();

  await withClient(async (client) => {
    await client.query(
      `
        UPDATE game
        SET title = $1, tagline = $2, intro = $3,
            promo_video_url = $4, promo_poster_url = $5, promo_title = $6, promo_text = $7,
            variables_json = $8, start_node_code = $9
        WHERE id = $10
      `,
      [
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
      ],
    );
  });
}

export async function insertNodeRecordInPostgres(node: StoryNode) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO story_nodes (
          code, title, description, transcript, video_url, node_type,
          auto_next_node_code, is_ending, ending_tone, timeline_events_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        node.code,
        node.title,
        node.description,
        node.transcript,
        node.videoUrl,
        node.nodeType,
        node.autoNextNodeCode ?? null,
        Boolean(node.isEnding),
        node.endingTone ?? null,
        JSON.stringify(node.timelineEvents ?? []),
      ],
    );
  });
}

export async function updateNodeRecordInPostgres(node: StoryNode) {
  await initializePostgres();

  await runTransaction(async (client) => {
    await client.query(
      `
        UPDATE story_nodes
        SET title = $1, description = $2, transcript = $3, video_url = $4,
            node_type = $5, auto_next_node_code = $6, is_ending = $7, ending_tone = $8,
            timeline_events_json = $9
        WHERE code = $10
      `,
      [
        node.title,
        node.description,
        node.transcript,
        node.videoUrl,
        node.nodeType,
        node.autoNextNodeCode ?? null,
        Boolean(node.isEnding),
        node.endingTone ?? null,
        JSON.stringify(node.timelineEvents ?? []),
        node.code,
      ],
    );

    await client.query("DELETE FROM story_choices WHERE node_code = $1", [node.code]);

    for (const choice of node.choices ?? []) {
      await client.query(
        `
          INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [node.code, choice.code, choice.label, choice.hint, choice.targetNodeCode],
      );
    }
  });
}

export async function insertChoiceRecordInPostgres(nodeCode: string, choice: StoryChoice) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO story_choices (node_code, code, label, hint, target_node_code)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [nodeCode, choice.code, choice.label, choice.hint, choice.targetNodeCode],
    );
  });
}

export async function createPlaythroughRecordInPostgres(input: {
  id: string;
  gameSlug: string;
  currentNodeCode: string;
  status: "in_progress" | "completed";
  startedAt: string;
  finishedAt?: string;
  variables?: PlaythroughState["variables"];
  triggeredEventIds?: string[];
}) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query(
      `
        INSERT INTO playthroughs (
          id, game_slug, current_node_code, status, started_at, finished_at, variables_json, triggered_event_ids_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        input.id,
        input.gameSlug,
        input.currentNodeCode,
        input.status,
        input.startedAt,
        input.finishedAt ?? null,
        JSON.stringify(input.variables ?? {}),
        JSON.stringify(input.triggeredEventIds ?? []),
      ],
    );
  });
}

export async function updatePlaythroughRecordInPostgres(session: PlaythroughState) {
  await initializePostgres();

  await withClient(async (client) => {
    await client.query(
      `
        UPDATE playthroughs
        SET current_node_code = $1, status = $2, started_at = $3, finished_at = $4,
            variables_json = $5, triggered_event_ids_json = $6
        WHERE id = $7
      `,
      [
        session.currentNodeCode,
        session.status,
        session.startedAt,
        session.finishedAt ?? null,
        JSON.stringify(session.variables ?? {}),
        JSON.stringify(session.triggeredEventIds ?? []),
        session.id,
      ],
    );
  });
}

export async function replaceChoiceLogsInPostgres(
  playthroughId: string,
  history: PlaythroughState["history"],
) {
  await initializePostgres();

  await runTransaction(async (client) => {
    await client.query("DELETE FROM choice_logs WHERE playthrough_id = $1", [playthroughId]);

    for (const entry of history) {
      await client.query(
        `
          INSERT INTO choice_logs (
            playthrough_id, node_code, choice_code, choice_label, target_node_code, chosen_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          playthroughId,
          entry.nodeCode,
          entry.choiceCode,
          entry.choiceLabel,
          entry.targetNodeCode,
          entry.chosenAt,
        ],
      );
    }
  });
}

export async function loadPlaythroughFromPostgres(playthroughId: string): Promise<PlaythroughState | null> {
  await initializePostgres();

  return withClient(async (client) => {
    const sessionResult = await client.query<DbPlaythroughRow>(
      `
        SELECT id, game_slug, current_node_code, status, started_at, finished_at, variables_json, triggered_event_ids_json
        FROM playthroughs
        WHERE id = $1
      `,
      [playthroughId],
    );
    const sessionRow = sessionResult.rows[0];

    if (!sessionRow) {
      return null;
    }

    const historyResult = await client.query<DbChoiceLogRow>(
      `
        SELECT playthrough_id, node_code, choice_code, choice_label, target_node_code, chosen_at
        FROM choice_logs
        WHERE playthrough_id = $1
        ORDER BY id
      `,
      [playthroughId],
    );

    return {
      id: sessionRow.id,
      gameSlug: sessionRow.game_slug,
      currentNodeCode: sessionRow.current_node_code,
      status: sessionRow.status,
      startedAt: sessionRow.started_at,
      finishedAt: sessionRow.finished_at ?? undefined,
      variables: JSON.parse(sessionRow.variables_json || "{}") as PlaythroughState["variables"],
      triggeredEventIds: JSON.parse(sessionRow.triggered_event_ids_json || "[]") as string[],
      history: historyResult.rows.map((row) => ({
        nodeCode: row.node_code,
        choiceCode: row.choice_code,
        choiceLabel: row.choice_label,
        targetNodeCode: row.target_node_code,
        chosenAt: row.chosen_at,
      })),
    };
  });
}

export async function resetPostgresToSeed(game: StoryGame) {
  await initializePostgres();

  await runTransaction(async (client) => {
    await client.query("DELETE FROM choice_logs");
    await client.query("DELETE FROM playthroughs");
    await client.query("DELETE FROM story_choices");
    await client.query("DELETE FROM story_nodes");
    await client.query("DELETE FROM game");
    await seedPostgres(client, game);
  });
}

export function getPostgresConnectionLabel() {
  return "postgres";
}

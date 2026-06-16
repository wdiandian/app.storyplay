import type {
  PlaythroughState,
  StoryChoice,
  StoryGame,
  StoryNode,
  VariableDefinition,
} from "@/lib/story-engine";
import {
  createPlaythroughRecordInPostgres,
  getPostgresConnectionLabel,
  insertChoiceRecordInPostgres,
  insertNodeRecordInPostgres,
  loadGameFromPostgres,
  loadPlaythroughFromPostgres,
  persistGameMetaInPostgres,
  replaceChoiceLogsInPostgres,
  resetPostgresToSeed,
  updateNodeRecordInPostgres,
  updatePlaythroughRecordInPostgres,
} from "@/lib/postgres";
import {
  createPlaythroughRecord,
  getDbFilePath,
  insertChoiceRecord,
  insertNodeRecord,
  loadGameFromDb,
  loadPlaythrough,
  persistGameMeta,
  replaceChoiceLogs,
  resetDatabaseToSeed,
  updateNodeRecord,
  updatePlaythroughRecord,
} from "@/lib/sqlite";

function shouldUsePostgres() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function loadGame(): Promise<StoryGame> {
  return shouldUsePostgres() ? loadGameFromPostgres() : loadGameFromDb();
}

export async function replaceGame(game: StoryGame) {
  if (shouldUsePostgres()) {
    await resetPostgresToSeed(game);
    return;
  }

  resetDatabaseToSeed(game);
}

export async function persistGame(input: {
  title?: string;
  tagline?: string;
  intro?: string;
  promoVideoUrl?: string;
  promoPosterUrl?: string;
  promoText?: string;
  startNodeCode?: string;
  variables?: VariableDefinition[];
}) {
  if (shouldUsePostgres()) {
    await persistGameMetaInPostgres(input);
    return;
  }

  persistGameMeta(input);
}

export async function insertNode(node: StoryNode) {
  if (shouldUsePostgres()) {
    await insertNodeRecordInPostgres(node);
    return;
  }

  insertNodeRecord(node);
}

export async function updateNode(node: StoryNode) {
  if (shouldUsePostgres()) {
    await updateNodeRecordInPostgres(node);
    return;
  }

  updateNodeRecord(node);
}

export async function insertChoice(nodeCode: string, choice: StoryChoice) {
  if (shouldUsePostgres()) {
    await insertChoiceRecordInPostgres(nodeCode, choice);
    return;
  }

  insertChoiceRecord(nodeCode, choice);
}

export async function createPlaythroughRecordForStorage(input: {
  id: string;
  gameSlug: string;
  currentNodeCode: string;
  status: "in_progress" | "completed";
  startedAt: string;
  finishedAt?: string;
  variables?: PlaythroughState["variables"];
  triggeredEventIds?: string[];
}) {
  if (shouldUsePostgres()) {
    await createPlaythroughRecordInPostgres(input);
    return;
  }

  createPlaythroughRecord(input);
}

export async function updatePlaythroughRecordForStorage(session: PlaythroughState) {
  if (shouldUsePostgres()) {
    await updatePlaythroughRecordInPostgres(session);
    return;
  }

  updatePlaythroughRecord(session);
}

export async function replaceChoiceLogsForStorage(
  playthroughId: string,
  history: PlaythroughState["history"],
) {
  if (shouldUsePostgres()) {
    await replaceChoiceLogsInPostgres(playthroughId, history);
    return;
  }

  replaceChoiceLogs(playthroughId, history);
}

export async function loadPlaythroughFromStorage(playthroughId: string) {
  return shouldUsePostgres() ? loadPlaythroughFromPostgres(playthroughId) : loadPlaythrough(playthroughId);
}

export async function resetStorageToSeed(game: StoryGame) {
  if (shouldUsePostgres()) {
    await resetPostgresToSeed(game);
    return;
  }

  resetDatabaseToSeed(game);
}

export function getStorageLabel() {
  return shouldUsePostgres() ? getPostgresConnectionLabel() : getDbFilePath();
}

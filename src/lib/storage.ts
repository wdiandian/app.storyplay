import type { PlaythroughState, ProjectSummary, StoryGame } from "@/lib/story-engine";
import {
  createProjectSeed,
  summarizeProject,
} from "@/lib/project-utils";
import {
  getPostgresConnectionLabel,
  initializePostgres,
  loadPlaythroughFromPostgres,
  upsertPlaythroughInPostgres,
  listProjectsFromPostgres,
  loadProjectFromPostgres,
  saveProjectToPostgres,
  deleteProjectFromPostgres,
} from "@/lib/postgres";
import {
  getDbFilePath,
  loadPlaythrough,
  upsertPlaythrough,
  listProjectsFromDb,
  loadProjectFromDb,
  saveProjectToDb,
  deleteProjectFromDb,
} from "@/lib/sqlite";

function shouldUsePostgres() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (shouldUsePostgres()) {
    await initializePostgres();
    return listProjectsFromPostgres();
  }

  return listProjectsFromDb();
}

export async function loadProject(slug?: string): Promise<StoryGame> {
  if (shouldUsePostgres()) {
    await initializePostgres();
    return loadProjectFromPostgres(slug);
  }

  return loadProjectFromDb(slug);
}

export async function createProject(input?: Partial<StoryGame>) {
  const project = createProjectSeed(input);

  if (shouldUsePostgres()) {
    await initializePostgres();
    await saveProjectToPostgres(project);
  } else {
    saveProjectToDb(project);
  }

  return project;
}

export async function saveProject(game: StoryGame) {
  if (shouldUsePostgres()) {
    await initializePostgres();
    await saveProjectToPostgres(game);
    return;
  }

  saveProjectToDb(game);
}

export async function removeProject(slug: string) {
  if (shouldUsePostgres()) {
    await initializePostgres();
    await deleteProjectFromPostgres(slug);
    return;
  }

  deleteProjectFromDb(slug);
}

export async function ensureProject(slug?: string) {
  const projects = await listProjects();

  if (!projects.length) {
    const created = await createProject();
    return created;
  }

  return loadProject(slug ?? projects[0]?.slug);
}

export async function upsertPlaythroughForStorage(session: PlaythroughState) {
  if (shouldUsePostgres()) {
    await initializePostgres();
    await upsertPlaythroughInPostgres(session);
    return;
  }

  upsertPlaythrough(session);
}

export async function loadPlaythroughFromStorage(playthroughId: string) {
  return shouldUsePostgres() ? loadPlaythroughFromPostgres(playthroughId) : loadPlaythrough(playthroughId);
}

export function getStorageLabel() {
  return shouldUsePostgres() ? getPostgresConnectionLabel() : getDbFilePath();
}

export function toProjectSummary(game: StoryGame, updatedAt: string) {
  return summarizeProject(game, updatedAt);
}

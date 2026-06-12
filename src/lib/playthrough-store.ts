import { getGame } from "@/lib/game-store";
import {
  createPlaythroughRecord,
  loadPlaythrough,
  replaceChoiceLogs,
  updatePlaythroughRecord,
} from "@/lib/sqlite";
import {
  getNodeByCode,
  type ChoiceLog,
  type PlaythroughState,
  type StoryChoice,
  type StoryNode,
} from "@/lib/story-engine";

function buildChoiceLog(node: StoryNode, choice: StoryChoice): ChoiceLog {
  return {
    nodeCode: node.code,
    choiceCode: choice.code,
    choiceLabel: choice.label,
    targetNodeCode: choice.targetNodeCode,
    chosenAt: new Date().toISOString(),
  };
}

function getPlaythroughOrThrow(playthroughId: string) {
  const session = loadPlaythrough(playthroughId);

  if (!session) {
    throw new Error("Playthrough not found");
  }

  return session;
}

function markCompletionIfNeeded(session: PlaythroughState, nodeCode: string) {
  const node = getNodeByCode(getGame(), nodeCode);

  if (node.isEnding) {
    session.status = "completed";
    session.finishedAt = new Date().toISOString();
  }
}

export function createPlaythrough() {
  const game = getGame();

  if (!game.startNodeCode) {
    throw new Error("Project has no start node");
  }

  const id = crypto.randomUUID();
  const session: PlaythroughState = {
    id,
    gameSlug: game.slug,
    currentNodeCode: game.startNodeCode,
    status: "in_progress",
    history: [],
    startedAt: new Date().toISOString(),
  };

  markCompletionIfNeeded(session, session.currentNodeCode);
  createPlaythroughRecord(session);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export function getCurrentNode(playthroughId: string) {
  const game = getGame();
  const session = getPlaythroughOrThrow(playthroughId);
  const node = getNodeByCode(game, session.currentNodeCode);

  return {
    session,
    node,
  };
}

export function chooseBranch(playthroughId: string, choiceCode: string) {
  const game = getGame();
  const session = getPlaythroughOrThrow(playthroughId);
  const currentNode = getNodeByCode(game, session.currentNodeCode);
  const choices = currentNode.choices ?? [];
  const selectedChoice = choices.find((choice) => choice.code === choiceCode);

  if (!selectedChoice) {
    throw new Error("Choice not found on current node");
  }

  session.history.push(buildChoiceLog(currentNode, selectedChoice));
  session.currentNodeCode = selectedChoice.targetNodeCode;
  markCompletionIfNeeded(session, session.currentNodeCode);
  updatePlaythroughRecord(session);
  replaceChoiceLogs(session.id, session.history);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export function advancePlaythrough(playthroughId: string) {
  const game = getGame();
  const session = getPlaythroughOrThrow(playthroughId);
  const currentNode = getNodeByCode(game, session.currentNodeCode);

  if (!currentNode.autoNextNodeCode) {
    throw new Error("Current node has no automatic transition");
  }

  session.currentNodeCode = currentNode.autoNextNodeCode;
  markCompletionIfNeeded(session, session.currentNodeCode);
  updatePlaythroughRecord(session);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export function restartPlaythrough(playthroughId: string) {
  const game = getGame();
  const session = getPlaythroughOrThrow(playthroughId);

  if (!game.startNodeCode) {
    throw new Error("Project has no start node");
  }

  session.currentNodeCode = game.startNodeCode;
  session.status = "in_progress";
  session.history = [];
  session.startedAt = new Date().toISOString();
  session.finishedAt = undefined;
  updatePlaythroughRecord(session);
  replaceChoiceLogs(session.id, session.history);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

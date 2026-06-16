import { getGame } from "@/lib/game-store";
import {
  applyActions,
  buildInitialVariableState,
  clonePlaythroughState,
  matchesConditions,
} from "@/lib/story-rules";
import {
  createPlaythroughRecordForStorage,
  loadPlaythroughFromStorage,
  replaceChoiceLogsForStorage,
  updatePlaythroughRecordForStorage,
} from "@/lib/storage";
import {
  getNodeByCode,
  type ChoiceLog,
  type PlaythroughState,
  type StoryChoice,
  type StoryNode,
  type TimelineEvent,
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

async function getPlaythroughOrThrow(playthroughId: string) {
  const session = await loadPlaythroughFromStorage(playthroughId);

  if (!session) {
    throw new Error("Playthrough not found");
  }

  return session;
}

async function markCompletionIfNeeded(session: PlaythroughState, nodeCode: string) {
  const node = getNodeByCode(await getGame(), nodeCode);

  if (node.isEnding) {
    session.status = "completed";
    session.finishedAt = new Date().toISOString();
  }
}

function normalizeTriggeredEvents(
  session: PlaythroughState,
  nextNodeCode?: string,
) {
  if (nextNodeCode && session.currentNodeCode !== nextNodeCode) {
    session.triggeredEventIds = [];
  }
}

function applyChoiceRuntimeEffects(
  session: PlaythroughState,
  choice: StoryChoice,
  sourceNode: StoryNode,
) {
  if (!matchesConditions(choice.conditions, session.variables)) {
    throw new Error(`Choice conditions are not satisfied: ${choice.code}`);
  }

  session.variables = applyActions(session.variables, choice.actions);

  session.history.push(buildChoiceLog(sourceNode, choice));
}

export async function triggerTimelineEvent(
  playthroughId: string,
  event: TimelineEvent,
) {
  const game = await getGame();
  const session = clonePlaythroughState(await getPlaythroughOrThrow(playthroughId));

  if (session.triggeredEventIds.includes(event.id)) {
    return {
      session,
      node: getNodeByCode(game, session.currentNodeCode),
    };
  }

  if (!matchesConditions(event.conditions, session.variables)) {
    throw new Error(`Event conditions are not satisfied: ${event.id}`);
  }

  session.variables = applyActions(session.variables, event.actions);
  session.triggeredEventIds.push(event.id);
  await updatePlaythroughRecordForStorage(session);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export async function createPlaythrough() {
  const game = await getGame();

  if (!game.startNodeCode) {
    throw new Error("Project has no start node");
  }

  return createPlaythroughFromNode(game.startNodeCode);
}

export async function createPlaythroughFromNode(startNodeCode: string) {
  const game = await getGame();
  const normalizedStartNodeCode = startNodeCode.trim();

  if (!normalizedStartNodeCode) {
    throw new Error("Start node code is required");
  }

  getNodeByCode(game, normalizedStartNodeCode);

  const id = crypto.randomUUID();
  const session: PlaythroughState = {
    id,
    gameSlug: game.slug,
    currentNodeCode: normalizedStartNodeCode,
    status: "in_progress",
    history: [],
    startedAt: new Date().toISOString(),
    variables: buildInitialVariableState(game),
    triggeredEventIds: [],
  };

  await markCompletionIfNeeded(session, session.currentNodeCode);
  await createPlaythroughRecordForStorage(session);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export async function getCurrentNode(playthroughId: string) {
  const game = await getGame();
  const session = await getPlaythroughOrThrow(playthroughId);
  const node = getNodeByCode(game, session.currentNodeCode);

  return {
    session,
    node,
  };
}

export async function chooseBranch(playthroughId: string, choiceCode: string) {
  const game = await getGame();
  const session = clonePlaythroughState(await getPlaythroughOrThrow(playthroughId));
  const currentNode = getNodeByCode(game, session.currentNodeCode);
  const choices = currentNode.choices ?? [];
  const selectedChoice = choices.find((choice) => choice.code === choiceCode);

  if (!selectedChoice) {
    throw new Error("Choice not found on current node");
  }

  applyChoiceRuntimeEffects(session, selectedChoice, currentNode);
  normalizeTriggeredEvents(session, selectedChoice.targetNodeCode);
  session.currentNodeCode = selectedChoice.targetNodeCode;
  await markCompletionIfNeeded(session, session.currentNodeCode);
  await updatePlaythroughRecordForStorage(session);
  await replaceChoiceLogsForStorage(session.id, session.history);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export async function chooseTimelineBranch(
  playthroughId: string,
  choice: StoryChoice,
  sourceNodeCode?: string,
) {
  const game = await getGame();
  const session = clonePlaythroughState(await getPlaythroughOrThrow(playthroughId));
  const currentNode = getNodeByCode(game, session.currentNodeCode);
  const logNode = sourceNodeCode ? getNodeByCode(game, sourceNodeCode) : currentNode;

  if (!choice.code || !choice.label || !choice.targetNodeCode) {
    throw new Error("Timeline choice is incomplete");
  }

  getNodeByCode(game, choice.targetNodeCode);

  applyChoiceRuntimeEffects(session, choice, logNode);
  normalizeTriggeredEvents(session, choice.targetNodeCode);
  session.currentNodeCode = choice.targetNodeCode;
  await markCompletionIfNeeded(session, session.currentNodeCode);
  await updatePlaythroughRecordForStorage(session);
  await replaceChoiceLogsForStorage(session.id, session.history);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export async function advancePlaythrough(playthroughId: string) {
  const game = await getGame();
  const session = clonePlaythroughState(await getPlaythroughOrThrow(playthroughId));
  const currentNode = getNodeByCode(game, session.currentNodeCode);

  if (!currentNode.autoNextNodeCode) {
    throw new Error("Current node has no automatic transition");
  }

  normalizeTriggeredEvents(session, currentNode.autoNextNodeCode);
  session.currentNodeCode = currentNode.autoNextNodeCode;
  await markCompletionIfNeeded(session, session.currentNodeCode);
  await updatePlaythroughRecordForStorage(session);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

export async function restartPlaythrough(playthroughId: string) {
  const game = await getGame();

  if (!game.startNodeCode) {
    throw new Error("Project has no start node");
  }

  return restartPlaythroughFromNode(playthroughId, game.startNodeCode);
}

export async function restartPlaythroughFromNode(playthroughId: string, startNodeCode: string) {
  const game = await getGame();
  const session = clonePlaythroughState(await getPlaythroughOrThrow(playthroughId));
  const normalizedStartNodeCode = startNodeCode.trim();

  if (!normalizedStartNodeCode) {
    throw new Error("Start node code is required");
  }

  getNodeByCode(game, normalizedStartNodeCode);

  session.currentNodeCode = normalizedStartNodeCode;
  session.status = "in_progress";
  session.history = [];
  session.startedAt = new Date().toISOString();
  session.finishedAt = undefined;
  session.variables = buildInitialVariableState(game);
  session.triggeredEventIds = [];
  await updatePlaythroughRecordForStorage(session);
  await replaceChoiceLogsForStorage(session.id, session.history);

  return {
    session,
    node: getNodeByCode(game, session.currentNodeCode),
  };
}

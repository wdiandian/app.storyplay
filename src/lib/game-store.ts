import { blankStorySeed } from "@/data/sample-story";
import {
  getNodeByCode,
  type ConditionRule,
  type EndingTone,
  type StoryChoice,
  type StoryGame,
  type StoryNode,
  type TimelineEvent,
  type VariableAction,
  type VariableDefinition,
} from "@/lib/story-engine";
import {
  insertChoice,
  insertNode,
  loadGame,
  persistGame,
  replaceGame,
  resetStorageToSeed,
  updateNode,
} from "@/lib/storage";

type GameSettingsInput = {
  title?: string;
  tagline?: string;
  intro?: string;
  promoVideoUrl?: string;
  promoPosterUrl?: string;
  promoText?: string;
  startNodeCode?: string;
  variables?: VariableDefinition[];
};

type NodeInput = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  videoUrl: string;
  nodeType: "video" | "ending";
  autoNextNodeCode?: string | null;
  endingTone?: EndingTone | null;
};

type NodeUpdateInput = {
  title?: string;
  description?: string;
  transcript?: string;
  videoUrl?: string;
  nodeType?: "video" | "ending";
  autoNextNodeCode?: string | null;
  endingTone?: EndingTone | null;
  choices?: StoryChoice[];
  timelineEvents?: TimelineEvent[];
};

type ChoiceInput = {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
};

function assertNodeExists(game: StoryGame, nodeCode: string) {
  getNodeByCode(game, nodeCode);
}

function normalizeOptionalNodeCode(value?: string | null) {
  return value ? value.trim() : "";
}

function sanitizeChoice(choice: ChoiceInput): StoryChoice {
  return {
    code: choice.code.trim(),
    label: choice.label.trim(),
    hint: choice.hint.trim(),
    targetNodeCode: choice.targetNodeCode.trim(),
    conditions: [],
    actions: [],
  };
}

function sanitizeConditions(conditions: ConditionRule[] | undefined) {
  return (conditions ?? []).map((condition, index) => ({
    id: condition.id?.trim() || `condition_${index + 1}`,
    variableKey: condition.variableKey.trim(),
    operator: condition.operator,
    value: condition.value,
  }));
}

function sanitizeActions(actions: VariableAction[] | undefined) {
  return (actions ?? []).map((action, index) => ({
    id: action.id?.trim() || `action_${index + 1}`,
    variableKey: action.variableKey.trim(),
    type: action.type,
    value: action.value,
  }));
}

function sanitizeNode(input: NodeInput): StoryNode {
  const isEnding = input.nodeType === "ending";
  const autoNextNodeCode = normalizeOptionalNodeCode(input.autoNextNodeCode);

  return {
    code: input.code.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    transcript: input.transcript.trim(),
    videoUrl: input.videoUrl.trim(),
    nodeType: input.nodeType,
    autoNextNodeCode:
      !isEnding && autoNextNodeCode ? autoNextNodeCode : undefined,
    isEnding,
    endingTone: isEnding ? input.endingTone ?? "truth" : undefined,
    choices: [],
  };
}

export async function getGame() {
  return loadGame();
}

export async function updateGameSettings(input: GameSettingsInput) {
  const game = await getGame();

  if (typeof input.startNodeCode === "string") {
    const normalizedStartNodeCode = input.startNodeCode.trim();

    if (normalizedStartNodeCode) {
      assertNodeExists(game, normalizedStartNodeCode);
    }

    game.startNodeCode = normalizedStartNodeCode;
  }

  if (typeof input.title === "string") {
    game.title = input.title.trim();
  }

  if (typeof input.tagline === "string") {
    game.tagline = input.tagline.trim();
  }

  if (typeof input.intro === "string") {
    game.intro = input.intro.trim();
  }

  if (typeof input.promoVideoUrl === "string") {
    game.promoVideoUrl = input.promoVideoUrl.trim();
  }

  if (typeof input.promoPosterUrl === "string") {
    game.promoPosterUrl = input.promoPosterUrl.trim();
  }

  if (typeof input.promoText === "string") {
    game.promoText = input.promoText.trim();
  }

  if (input.variables) {
    game.variables = input.variables.map((variable) => ({
      key: variable.key.trim(),
      label: variable.label.trim(),
      type: variable.type,
      initialValue: variable.initialValue,
      options: variable.options?.map((option) => option.trim()).filter(Boolean),
    }));
  }

  await persistGame({
    title: game.title,
    tagline: game.tagline,
    intro: game.intro,
    promoVideoUrl: game.promoVideoUrl,
    promoPosterUrl: game.promoPosterUrl,
    promoText: game.promoText,
    startNodeCode: game.startNodeCode,
    variables: game.variables,
  });

  return game;
}

export async function createNode(input: NodeInput) {
  const game = await getGame();
  const node = sanitizeNode(input);

  if (!node.code) {
    throw new Error("Node code is required");
  }

  if (game.nodes.some((entry) => entry.code === node.code)) {
    throw new Error("Node code already exists");
  }

  if (!node.title) {
    throw new Error("Node title is required");
  }

  if (!node.videoUrl) {
    throw new Error("Video URL is required");
  }

  if (node.autoNextNodeCode) {
    assertNodeExists(game, node.autoNextNodeCode);
  }

  await insertNode(node);

  if (!game.startNodeCode) {
    game.startNodeCode = node.code;
    await persistGame({
      startNodeCode: node.code,
    });
  }

  return node;
}

export async function updateNodeDetails(nodeCode: string, input: NodeUpdateInput) {
  const game = await getGame();
  const node = getNodeByCode(game, nodeCode);
  const nextNodeType = input.nodeType ?? node.nodeType;
  const nextAutoNextCode = normalizeOptionalNodeCode(
    input.autoNextNodeCode ?? node.autoNextNodeCode,
  );

  if (typeof input.title === "string") {
    node.title = input.title.trim();
  }

  if (typeof input.description === "string") {
    node.description = input.description.trim();
  }

  if (typeof input.transcript === "string") {
    node.transcript = input.transcript.trim();
  }

  if (typeof input.videoUrl === "string") {
    node.videoUrl = input.videoUrl.trim();
  }

  node.nodeType = nextNodeType;
  node.isEnding = nextNodeType === "ending";
  node.endingTone = node.isEnding ? input.endingTone ?? node.endingTone ?? "truth" : undefined;
  node.autoNextNodeCode =
    !node.isEnding && nextAutoNextCode ? nextAutoNextCode : undefined;

  if (node.autoNextNodeCode) {
    assertNodeExists(game, node.autoNextNodeCode);
  }

  if (input.choices) {
    const seenCodes = new Set<string>();

    node.choices = input.choices.map((choice) => {
      const normalized = sanitizeChoice(choice);

      if (!normalized.code) {
        throw new Error("Choice code is required");
      }

      if (seenCodes.has(normalized.code)) {
        throw new Error(`Duplicate choice code: ${normalized.code}`);
      }

      assertNodeExists(game, normalized.targetNodeCode);
      normalized.conditions = sanitizeConditions(choice.conditions);
      normalized.actions = sanitizeActions(choice.actions);
      seenCodes.add(normalized.code);
      return normalized;
    });
  }

  if (input.timelineEvents) {
    const seenEventIds = new Set<string>();

    node.timelineEvents = input.timelineEvents.map((event) => {
      const normalizedId = event.id.trim();

      if (!normalizedId) {
        throw new Error("Timeline event id is required");
      }

      if (seenEventIds.has(normalizedId)) {
        throw new Error(`Duplicate timeline event id: ${normalizedId}`);
      }

      if (!Number.isFinite(event.atMs) || event.atMs < 0) {
        throw new Error(`Invalid timeline event time: ${normalizedId}`);
      }

      seenEventIds.add(normalizedId);

      return {
        id: normalizedId,
        atMs: event.atMs,
        type: event.type,
        payload: event.payload ?? {},
        conditions: sanitizeConditions(event.conditions),
        actions: sanitizeActions(event.actions),
      };
    });
  }

  await updateNode(node);
  return node;
}

function removeNodeReferences(node: StoryNode, nodeCode: string) {
  const nextChoices = (node.choices ?? []).filter((choice) => choice.targetNodeCode !== nodeCode);
  const nextTimelineEvents = (node.timelineEvents ?? []).flatMap((event) => {
    if (event.type === "jump") {
      const targetNodeCode =
        typeof event.payload?.targetNodeCode === "string" ? event.payload.targetNodeCode.trim() : "";

      if (targetNodeCode === nodeCode) {
        return [];
      }
    }

    if (event.type === "show_choice") {
      const payloadChoices = Array.isArray(event.payload?.choices) ? event.payload.choices : null;

      if (!payloadChoices) {
        return [event];
      }

      const nextPayloadChoices = payloadChoices.filter((choice) => {
        if (!choice || typeof choice !== "object") {
          return true;
        }

        const targetNodeCode =
          typeof (choice as { targetNodeCode?: unknown }).targetNodeCode === "string"
            ? (choice as { targetNodeCode: string }).targetNodeCode.trim()
            : "";

        return targetNodeCode !== nodeCode;
      });

      return [
        {
          ...event,
          payload: {
            ...event.payload,
            choices: nextPayloadChoices,
          },
        },
      ];
    }

    return [event];
  });

  return {
    ...node,
    autoNextNodeCode: node.autoNextNodeCode === nodeCode ? undefined : node.autoNextNodeCode,
    choices: nextChoices,
    timelineEvents: nextTimelineEvents,
  };
}

export async function deleteNodeByCode(nodeCode: string) {
  const game = await getGame();
  const normalizedNodeCode = nodeCode.trim();

  if (!normalizedNodeCode) {
    throw new Error("Node code is required");
  }

  if (game.nodes.length <= 1) {
    throw new Error("At least one node must remain in the project");
  }

  getNodeByCode(game, normalizedNodeCode);

  const remainingNodes = game.nodes
    .filter((node) => node.code !== normalizedNodeCode)
    .map((node) => removeNodeReferences(structuredClone(node), normalizedNodeCode));

  const nextStartNodeCode =
    game.startNodeCode === normalizedNodeCode
      ? remainingNodes[0]?.code ?? ""
      : game.startNodeCode;

  const nextGame: StoryGame = {
    ...game,
    startNodeCode: nextStartNodeCode,
    nodes: remainingNodes,
  };

  await replaceGame(nextGame);
  return getGame();
}

export async function addChoice(nodeCode: string, input: ChoiceInput) {
  const game = await getGame();
  const node = getNodeByCode(game, nodeCode);
  const choice = sanitizeChoice(input);

  if (!choice.code) {
    throw new Error("Choice code is required");
  }

  if (!choice.label) {
    throw new Error("Choice label is required");
  }

  assertNodeExists(game, choice.targetNodeCode);

  const existingChoices = node.choices ?? [];

  if (existingChoices.some((entry) => entry.code === choice.code)) {
    throw new Error("Choice code already exists on this node");
  }

  node.choices = [...existingChoices, choice];
  await insertChoice(nodeCode, choice);
  return choice;
}

export async function resetGameToBlankProject() {
  await resetStorageToSeed(blankStorySeed);
  return getGame();
}

function sanitizeImportedChoice(choice: StoryChoice): StoryChoice {
  return {
    code: choice.code.trim(),
    label: choice.label.trim(),
    hint: choice.hint.trim(),
    targetNodeCode: choice.targetNodeCode.trim(),
    conditions: sanitizeConditions(choice.conditions),
    actions: sanitizeActions(choice.actions),
  };
}

function sanitizeImportedGame(input: StoryGame): StoryGame {
  const nodes = input.nodes.map((node) => {
    const normalizedChoices = (node.choices ?? []).map(sanitizeImportedChoice);
    const nodeType: StoryNode["nodeType"] = node.nodeType === "ending" ? "ending" : "video";
    const isEnding = nodeType === "ending";

    return {
      code: node.code.trim(),
      title: node.title.trim(),
      description: node.description.trim(),
      transcript: node.transcript.trim(),
      videoUrl: node.videoUrl.trim(),
      nodeType,
      autoNextNodeCode:
        !isEnding && node.autoNextNodeCode?.trim() ? node.autoNextNodeCode.trim() : undefined,
      isEnding,
      endingTone: isEnding ? node.endingTone ?? "truth" : undefined,
      choices: normalizedChoices,
      timelineEvents: (node.timelineEvents ?? []).map((event) => ({
        id: event.id.trim(),
        atMs: event.atMs,
        type: event.type,
        payload: event.payload ?? {},
        conditions: sanitizeConditions(event.conditions),
        actions: sanitizeActions(event.actions),
      })),
    };
  });

  return {
    id: input.id.trim(),
    slug: input.slug.trim(),
    title: input.title.trim(),
    tagline: input.tagline.trim(),
    intro: input.intro.trim(),
    promoVideoUrl: input.promoVideoUrl.trim(),
    promoPosterUrl: input.promoPosterUrl.trim(),
    promoText: input.promoText.trim(),
    startNodeCode: input.startNodeCode.trim(),
    variables: (input.variables ?? []).map((variable) => ({
      key: variable.key.trim(),
      label: variable.label.trim(),
      type: variable.type,
      initialValue: variable.initialValue,
      options: variable.options?.map((option) => option.trim()).filter(Boolean),
    })),
    nodes,
  };
}

function validateImportedGame(game: StoryGame) {
  if (!game.id) {
    throw new Error("Game id is required");
  }

  if (!game.slug) {
    throw new Error("Game slug is required");
  }

  if (!game.title) {
    throw new Error("Game title is required");
  }

  if (!game.startNodeCode) {
    throw new Error("Start node code is required");
  }

  if (!game.nodes.length) {
    throw new Error("Imported project must include at least one node");
  }

  const seenVariableKeys = new Set<string>();

  for (const variable of game.variables ?? []) {
    if (!variable.key) {
      throw new Error("Variable key is required");
    }

    if (seenVariableKeys.has(variable.key)) {
      throw new Error(`Duplicate variable key: ${variable.key}`);
    }

    seenVariableKeys.add(variable.key);
  }

  const nodeCodes = new Set<string>();

  for (const node of game.nodes) {
    if (!node.code) {
      throw new Error("Each node must have a code");
    }

    if (nodeCodes.has(node.code)) {
      throw new Error(`Duplicate node code: ${node.code}`);
    }

    nodeCodes.add(node.code);
  }

  if (!nodeCodes.has(game.startNodeCode)) {
    throw new Error(`Start node not found: ${game.startNodeCode}`);
  }

  for (const node of game.nodes) {
    if (!node.title) {
      throw new Error(`Node title is required: ${node.code}`);
    }

    if (!node.videoUrl) {
      throw new Error(`Node video URL is required: ${node.code}`);
    }

    if (node.autoNextNodeCode && !nodeCodes.has(node.autoNextNodeCode)) {
      throw new Error(`Auto next node not found: ${node.code} -> ${node.autoNextNodeCode}`);
    }

    const seenEventIds = new Set<string>();

    for (const event of node.timelineEvents ?? []) {
      if (!event.id) {
        throw new Error(`Timeline event id is required on node: ${node.code}`);
      }

      if (seenEventIds.has(event.id)) {
        throw new Error(`Duplicate timeline event id on node ${node.code}: ${event.id}`);
      }

      if (!Number.isFinite(event.atMs) || event.atMs < 0) {
        throw new Error(`Invalid timeline event time on node ${node.code}: ${event.id}`);
      }

      for (const condition of event.conditions ?? []) {
        if (!condition.variableKey) {
          throw new Error(`Timeline event condition variable is required: ${node.code}/${event.id}`);
        }
      }

      for (const action of event.actions ?? []) {
        if (!action.variableKey) {
          throw new Error(`Timeline event action variable is required: ${node.code}/${event.id}`);
        }
      }

      seenEventIds.add(event.id);
    }

    const seenChoiceCodes = new Set<string>();

    for (const choice of node.choices ?? []) {
      if (!choice.code) {
        throw new Error(`Choice code is required on node: ${node.code}`);
      }

      if (seenChoiceCodes.has(choice.code)) {
        throw new Error(`Duplicate choice code on node ${node.code}: ${choice.code}`);
      }

      if (!nodeCodes.has(choice.targetNodeCode)) {
        throw new Error(`Choice target not found: ${node.code} -> ${choice.targetNodeCode}`);
      }

      for (const condition of choice.conditions ?? []) {
        if (!condition.variableKey) {
          throw new Error(`Choice condition variable is required: ${node.code}/${choice.code}`);
        }
      }

      for (const action of choice.actions ?? []) {
        if (!action.variableKey) {
          throw new Error(`Choice action variable is required: ${node.code}/${choice.code}`);
        }
      }

      seenChoiceCodes.add(choice.code);
    }
  }
}

export async function exportGameData() {
  return getGame();
}

export async function importGameData(input: StoryGame) {
  const game = sanitizeImportedGame(input);
  validateImportedGame(game);
  await replaceGame(game);
  return getGame();
}

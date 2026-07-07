import { createProjectSeed } from "@/lib/project-utils";
import {
  getNodeByCode,
  type ConditionRule,
  type EndingTone,
  type ProjectSummary,
  type StoryChoice,
  type StoryGame,
  type StoryNode,
  type TimelineEvent,
  type VariableAction,
  type VariableDefinition,
} from "@/lib/story-engine";
import {
  createProject,
  ensureProject,
  listProjects,
  loadProject,
  removeProject,
  saveProject,
} from "@/lib/storage";

type GameSettingsInput = {
  title?: string;
  slug?: string;
  tagline?: string;
  listedOnHome?: boolean;
  sortOrder?: number;
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
    autoNextNodeCode: !isEnding && autoNextNodeCode ? autoNextNodeCode : undefined,
    isEnding,
    endingTone: isEnding ? input.endingTone ?? "truth" : undefined,
    choices: [],
  };
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  return listProjects();
}

export async function getGame(projectSlug?: string) {
  return ensureProject(projectSlug);
}

export async function getProject(projectSlug: string) {
  return loadProject(projectSlug);
}

export async function createBlankProject(input?: Partial<StoryGame>) {
  const project = createProjectSeed(input);
  await createProject(project);
  return project;
}

export async function updateGameSettings(projectSlug: string, input: GameSettingsInput) {
  const game = await getGame(projectSlug);

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

  if (typeof input.slug === "string" && input.slug.trim()) {
    game.slug = input.slug.trim();
  }

  if (typeof input.tagline === "string") {
    game.tagline = input.tagline.trim();
  }

  if (typeof input.listedOnHome === "boolean") {
    game.listedOnHome = input.listedOnHome;
  }

  if (typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)) {
    game.sortOrder = input.sortOrder;
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

  await saveProject(game);
  return game;
}

export async function createNode(projectSlug: string, input: NodeInput) {
  const game = await getGame(projectSlug);
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

  if (node.autoNextNodeCode) {
    assertNodeExists(game, node.autoNextNodeCode);
  }

  game.nodes.push(node);

  if (!game.startNodeCode) {
    game.startNodeCode = node.code;
  }

  await saveProject(game);
  return node;
}

export async function updateNodeDetails(projectSlug: string, nodeCode: string, input: NodeUpdateInput) {
  const game = await getGame(projectSlug);
  const node = getNodeByCode(game, nodeCode);
  const nextNodeType = input.nodeType ?? node.nodeType;
  const nextAutoNextCode = normalizeOptionalNodeCode(input.autoNextNodeCode ?? node.autoNextNodeCode);

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
  node.autoNextNodeCode = !node.isEnding && nextAutoNextCode ? nextAutoNextCode : undefined;

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

  await saveProject(game);
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

export async function deleteNodeByCode(projectSlug: string, nodeCode: string) {
  const game = await getGame(projectSlug);
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

  game.nodes = remainingNodes;
  game.startNodeCode =
    game.startNodeCode === normalizedNodeCode ? remainingNodes[0]?.code ?? "" : game.startNodeCode;

  await saveProject(game);
  return game;
}

export async function addChoice(projectSlug: string, nodeCode: string, input: ChoiceInput) {
  const game = await getGame(projectSlug);
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
  await saveProject(game);
  return choice;
}

export async function resetGameToBlankProject(projectSlug: string) {
  const current = await getGame(projectSlug);
  const next = createProjectSeed({
    id: current.id,
    slug: current.slug,
    title: current.title,
  });

  await saveProject(next);
  return next;
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
    listedOnHome: input.listedOnHome ?? true,
    sortOrder: input.sortOrder ?? 0,
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

  if (game.startNodeCode && !game.nodes.find((node) => node.code === game.startNodeCode)) {
    throw new Error(`Start node not found: ${game.startNodeCode}`);
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

  for (const node of game.nodes) {
    if (!node.title) {
      throw new Error(`Node title is required: ${node.code}`);
    }

    if (node.autoNextNodeCode && !nodeCodes.has(node.autoNextNodeCode)) {
      throw new Error(`Auto next node not found: ${node.code} -> ${node.autoNextNodeCode}`);
    }
  }
}

export async function exportGameData(projectSlug: string) {
  return getGame(projectSlug);
}

export async function importGameData(projectSlug: string, input: StoryGame) {
  const current = await getGame(projectSlug);
  const game = sanitizeImportedGame(input);
  validateImportedGame(game);
  game.id = current.id;
  game.slug = current.slug;
  await saveProject(game);
  return game;
}

export async function deleteProjectBySlug(projectSlug: string) {
  const projects = await listProjects();

  if (projects.length <= 1) {
    throw new Error("At least one project must remain");
  }

  await removeProject(projectSlug);
  const remaining = await listProjects();
  return remaining;
}

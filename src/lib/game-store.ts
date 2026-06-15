import { blankStorySeed } from "@/data/sample-story";
import {
  getNodeByCode,
  type EndingTone,
  type StoryChoice,
  type StoryGame,
  type StoryNode,
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
  promoTitle?: string;
  promoText?: string;
  startNodeCode?: string;
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
  };
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

  if (typeof input.promoTitle === "string") {
    game.promoTitle = input.promoTitle.trim();
  }

  if (typeof input.promoText === "string") {
    game.promoText = input.promoText.trim();
  }

  await persistGame({
    title: game.title,
    tagline: game.tagline,
    intro: game.intro,
    promoVideoUrl: game.promoVideoUrl,
    promoPosterUrl: game.promoPosterUrl,
    promoTitle: game.promoTitle,
    promoText: game.promoText,
    startNodeCode: game.startNodeCode,
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
      seenCodes.add(normalized.code);
      return normalized;
    });
  }

  await updateNode(node);
  return node;
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
    promoTitle: input.promoTitle.trim(),
    promoText: input.promoText.trim(),
    startNodeCode: input.startNodeCode.trim(),
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

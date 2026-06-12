export type NodeType = "video" | "ending";
export type EndingTone = "truth" | "survival" | "tragedy";

export type ChoiceEffect = {
  clue?: string;
  affinity?: number;
};

export type StoryChoice = {
  code: string;
  label: string;
  targetNodeCode: string;
  hint: string;
  effect?: ChoiceEffect;
};

export type StoryNode = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  videoUrl: string;
  posterUrl?: string;
  nodeType: NodeType;
  autoNextNodeCode?: string;
  isEnding?: boolean;
  endingTone?: EndingTone;
  choices?: StoryChoice[];
};

export type StoryGame = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  promoVideoUrl: string;
  promoPosterUrl: string;
  promoTitle: string;
  promoText: string;
  startNodeCode: string;
  nodes: StoryNode[];
};

export type ChoiceLog = {
  nodeCode: string;
  choiceCode: string;
  choiceLabel: string;
  targetNodeCode: string;
  chosenAt: string;
};

export type PlaythroughStatus = "in_progress" | "completed";

export type PlaythroughState = {
  id: string;
  gameSlug: string;
  currentNodeCode: string;
  status: PlaythroughStatus;
  history: ChoiceLog[];
  startedAt: string;
  finishedAt?: string;
};

export function indexNodes(game: StoryGame) {
  return new Map(game.nodes.map((node) => [node.code, node]));
}

export function getNodeByCode(game: StoryGame, nodeCode: string) {
  const node = game.nodes.find((entry) => entry.code === nodeCode);

  if (!node) {
    throw new Error(`Unknown node code: ${nodeCode}`);
  }

  return node;
}

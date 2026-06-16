import type {
  ConditionRule,
  ConditionOperator,
  PlaythroughState,
  StoryChoice,
  StoryGame,
  TimelineEvent,
  VariableAction,
  VariableDefinition,
  VariableRuntimeValue,
  VariableState,
} from "@/lib/story-engine";

function coerceInitialValue(definition: VariableDefinition): VariableRuntimeValue {
  return definition.initialValue;
}

export function buildInitialVariableState(game: StoryGame): VariableState {
  const nextState: VariableState = {};

  for (const variable of game.variables ?? []) {
    nextState[variable.key] = coerceInitialValue(variable);
  }

  return nextState;
}

function compareNumber(
  current: number,
  target: number,
  operator: Extract<ConditionOperator, "gt" | "gte" | "lt" | "lte">,
) {
  if (operator === "gt") {
    return current > target;
  }

  if (operator === "gte") {
    return current >= target;
  }

  if (operator === "lt") {
    return current < target;
  }

  return current <= target;
}

export function evaluateCondition(rule: ConditionRule, state: VariableState) {
  const current = state[rule.variableKey];

  if (rule.operator === "eq") {
    return current === rule.value;
  }

  if (rule.operator === "neq") {
    return current !== rule.value;
  }

  if (rule.operator === "includes" || rule.operator === "not_includes") {
    const currentText = typeof current === "string" ? current : "";
    const targetText = typeof rule.value === "string" ? rule.value : String(rule.value);
    const matched = currentText
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .includes(targetText);

    return rule.operator === "includes" ? matched : !matched;
  }

  if (typeof current !== "number" || typeof rule.value !== "number") {
    return false;
  }

  return compareNumber(current, rule.value, rule.operator);
}

export function matchesConditions(conditions: ConditionRule[] | undefined, state: VariableState) {
  if (!conditions?.length) {
    return true;
  }

  return conditions.every((rule) => evaluateCondition(rule, state));
}

function appendTag(current: VariableRuntimeValue, rawValue: VariableRuntimeValue | undefined) {
  const nextValue = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!nextValue) {
    return typeof current === "string" ? current : "";
  }

  const tokens = (typeof current === "string" ? current : "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!tokens.includes(nextValue)) {
    tokens.push(nextValue);
  }

  return tokens.join(", ");
}

export function applyAction(state: VariableState, action: VariableAction) {
  const current = state[action.variableKey];

  if (action.type === "set") {
    state[action.variableKey] = action.value ?? "";
    return;
  }

  if (action.type === "increment") {
    const base = typeof current === "number" ? current : 0;
    const delta = typeof action.value === "number" ? action.value : 1;
    state[action.variableKey] = base + delta;
    return;
  }

  if (action.type === "toggle") {
    const base = typeof current === "boolean" ? current : false;
    state[action.variableKey] = !base;
    return;
  }

  state[action.variableKey] = appendTag(current, action.value);
}

export function applyActions(state: VariableState, actions: VariableAction[] | undefined) {
  if (!actions?.length) {
    return state;
  }

  const nextState = { ...state };

  for (const action of actions) {
    applyAction(nextState, action);
  }

  return nextState;
}

export function getAvailableChoices(choices: StoryChoice[] | undefined, state: VariableState) {
  return (choices ?? []).filter((choice) => matchesConditions(choice.conditions, state));
}

export function getAvailableTimelineEvents(
  events: TimelineEvent[] | undefined,
  state: VariableState,
  triggeredEventIds: string[],
) {
  const triggered = new Set(triggeredEventIds);

  return (events ?? []).filter((event) => {
    if (triggered.has(event.id)) {
      return false;
    }

    return matchesConditions(event.conditions, state);
  });
}

export function clonePlaythroughState(session: PlaythroughState) {
  return {
    ...session,
    history: [...session.history],
    variables: { ...session.variables },
    triggeredEventIds: [...session.triggeredEventIds],
  };
}

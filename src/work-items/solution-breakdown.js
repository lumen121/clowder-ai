"use strict";

const { transition, transitionWorkItem } = require("./state-machine");
const { createA2AEvent } = require("../a2a/orchestrator");

const AGENT_ALIASES = Object.freeze({
  codex: "Codex",
  claude: "Claude",
  minimax: "MiniMax",
});

const PRE_DEVELOPMENT_STATUSES = Object.freeze([
  "needs_clarification",
  "solution_review",
  "ready_for_development",
]);

function normalizeAgentName(value, fieldName) {
  const raw = normalizeText(value);
  if (!raw) {
    throw new Error(`${fieldName} is required.`);
  }
  const canonical = AGENT_ALIASES[raw.toLowerCase()];
  if (!canonical) {
    throw new Error(`${fieldName} must be one of: Codex, Claude, MiniMax.`);
  }
  return canonical;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value, fieldName) {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function requireArray(value, fieldName, options = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }
  if (options.nonEmpty && value.length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }
  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${fieldName} must contain only strings.`);
    }
    const normalized = item.trim();
    if (!normalized) {
      throw new Error(`${fieldName} must not contain empty strings.`);
    }
    return normalized;
  });
}

function normalizeSolution(solution) {
  if (!solution || typeof solution !== "object" || Array.isArray(solution)) {
    throw new Error("solution must be an object.");
  }

  return {
    summary: requireText(solution.summary, "solution.summary"),
    approach: requireText(solution.approach, "solution.approach"),
    assumptions: Array.isArray(solution.assumptions)
      ? requireArray(solution.assumptions, "solution.assumptions")
      : [],
    risks: Array.isArray(solution.risks)
      ? requireArray(solution.risks, "solution.risks")
      : [],
  };
}

function normalizeTask(input, index) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`tasks[${index}] must be an object.`);
  }

  const ownerAgent = normalizeAgentName(input.owner_agent, `tasks[${index}].owner_agent`);
  const reviewerAgent = normalizeAgentName(
    input.reviewer_agent,
    `tasks[${index}].reviewer_agent`
  );
  if (ownerAgent === reviewerAgent) {
    throw new Error(`tasks[${index}] reviewer_agent must be a non-author agent.`);
  }

  return {
    id: normalizeText(input.id || input.task_id) || null,
    task_key: normalizeText(input.task_key || input.key) || `task-${index + 1}`,
    title: normalizeText(input.title),
    owner_agent: ownerAgent,
    collaborators: Array.isArray(input.collaborators)
      ? requireArray(input.collaborators, `tasks[${index}].collaborators`).map((agent) =>
          normalizeAgentName(agent, `tasks[${index}].collaborators`)
        )
      : [],
    boundary: requireText(input.boundary, `tasks[${index}].boundary`),
    dependencies: requireArray(input.dependencies, `tasks[${index}].dependencies`),
    expected_artifacts: requireArray(
      input.expected_artifacts,
      `tasks[${index}].expected_artifacts`,
      { nonEmpty: true }
    ),
    reviewer_agent: reviewerAgent,
    acceptance_criteria: requireArray(
      input.acceptance_criteria,
      `tasks[${index}].acceptance_criteria`,
      { nonEmpty: true }
    ),
    parallelizable: Boolean(input.parallelizable),
  };
}

function normalizeBreakdownInput(input = {}) {
  const tasksInput = input.tasks || input.task_breakdown;
  if (!Array.isArray(tasksInput) || tasksInput.length === 0) {
    throw new Error("tasks must be a non-empty array.");
  }

  const tasks = tasksInput.map((task, index) => normalizeTask(task, index));
  const duplicateKeys = findDuplicates(tasks.map((task) => task.task_key));
  if (duplicateKeys.length > 0) {
    throw new Error(`Duplicate task_key values: ${duplicateKeys.join(", ")}`);
  }
  const duplicateIds = findDuplicates(
    tasks.map((task) => task.id).filter(Boolean)
  );
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate task id values: ${duplicateIds.join(", ")}`);
  }

  return {
    solution: normalizeSolution(input.solution),
    tasks,
  };
}

function findDuplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return Array.from(dupes);
}

function validateDependencyGraph(tasks, existingTaskIds, satisfiedDependencyIds) {
  const localNodes = new Map();
  const allowedExternal = new Set([...existingTaskIds, ...satisfiedDependencyIds]);
  const graph = new Map();

  for (const task of tasks) {
    const nodeKey = task.id || task.task_key;
    if (graph.has(nodeKey)) {
      throw new Error(`Duplicate task identity in breakdown: ${nodeKey}`);
    }
    graph.set(nodeKey, []);

    for (const alias of [task.task_key, task.id].filter(Boolean)) {
      const existing = localNodes.get(alias);
      if (existing && existing !== nodeKey) {
        throw new Error(`Task identity collision detected: ${alias}`);
      }
      localNodes.set(alias, nodeKey);
    }
  }

  for (const task of tasks) {
    const nodeKey = localNodes.get(task.task_key) || task.id || task.task_key;
    for (const dependency of task.dependencies) {
      if (dependency === task.task_key || dependency === task.id) {
        throw new Error(`Task "${task.task_key}" cannot depend on itself.`);
      }
      const localDependency = localNodes.get(dependency);
      if (localDependency) {
        graph.get(nodeKey).push(localDependency);
        continue;
      }
      if (!allowedExternal.has(dependency)) {
        throw new Error(
          `Task "${task.task_key}" has unsatisfied dependency: ${dependency}`
        );
      }
    }
  }

  assertAcyclic(graph);
}

function assertAcyclic(graph) {
  const visiting = new Set();
  const visited = new Set();

  function visit(node, path) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      throw new Error(`Task dependency cycle detected: ${[...path, node].join(" -> ")}`);
    }

    visiting.add(node);
    for (const next of graph.get(node) || []) {
      visit(next, [...path, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    visit(node, []);
  }
}

function rollbackTaskChanges(persistence, rollbackState = {}) {
  const createdTaskIds = Array.isArray(rollbackState.createdTaskIds)
    ? [...rollbackState.createdTaskIds].reverse()
    : [];
  const updatedTaskSnapshots = rollbackState.updatedTaskSnapshots instanceof Map
    ? rollbackState.updatedTaskSnapshots
    : new Map();

  for (const taskId of createdTaskIds) {
    persistence.taskStore.delete(taskId);
  }

  for (const [taskId, snapshot] of [...updatedTaskSnapshots.entries()].reverse()) {
    if (snapshot) {
      persistence.taskStore.update(taskId, snapshot);
    }
  }
}

function validateWorkItemForBreakdown(persistence, workItemId) {
  const workItem = persistence.workItemStore.read(workItemId);
  if (!workItem) {
    throw new Error(`WorkItem not found: ${workItemId}`);
  }
  if (!PRE_DEVELOPMENT_STATUSES.includes(workItem.status)) {
    throw new Error(
      `WorkItem "${workItemId}" is not in a pre-development status: ${workItem.status}`
    );
  }

  // Validate the full status path before any Store writes. T7 can only move
  // work items through the solution gate, while T8 will later enforce this
  // as a broader Harness guard.
  if (workItem.status === "needs_clarification") {
    transition("needs_clarification", "solution_review");
    transition("solution_review", "ready_for_development");
  } else if (workItem.status === "solution_review") {
    transition("solution_review", "ready_for_development");
  }

  return workItem;
}

function validateSolutionBreakdown(persistence, workItemId, input = {}, options = {}) {
  const workItem = validateWorkItemForBreakdown(persistence, workItemId);
  const normalized = normalizeBreakdownInput(input);
  const existingTaskIds = new Set(
    persistence.taskStore
      .list((task) => task.work_item_id === workItemId)
      .map((task) => task.id)
  );
  const satisfiedDependencyIds = new Set(options.satisfiedDependencyIds || []);

  for (const task of normalized.tasks) {
    if (task.id && !existingTaskIds.has(task.id)) {
      throw new Error(`Task "${task.task_key}" references unknown task id: ${task.id}`);
    }
  }

  validateDependencyGraph(normalized.tasks, existingTaskIds, satisfiedDependencyIds);

  return {
    workItem,
    solution: normalized.solution,
    tasks: normalized.tasks,
  };
}

function upsertTasks(persistence, workItemId, tasks, rollbackState = {}) {
  const taskRecords = [];
  const keyToId = new Map();
  const createdTaskIds = rollbackState.createdTaskIds || [];
  const updatedTaskSnapshots = rollbackState.updatedTaskSnapshots || new Map();

  try {
    for (const task of tasks) {
      const existingTask = task.id ? persistence.taskStore.read(task.id) : null;
      if (task.id && !updatedTaskSnapshots.has(task.id)) {
        updatedTaskSnapshots.set(task.id, existingTask);
      }

      const input = {
        work_item_id: workItemId,
        owner_agent: task.owner_agent,
        collaborators: task.collaborators,
        boundary: task.boundary,
        dependencies: task.dependencies,
        expected_artifacts: task.expected_artifacts,
        reviewer_agent: task.reviewer_agent,
        acceptance_criteria: task.acceptance_criteria,
        parallelizable: task.parallelizable,
        metadata: {
          ...(existingTask && existingTask.metadata ? existingTask.metadata : {}),
          task_key: task.task_key,
          title: task.title || task.task_key,
        },
      };

      const record = task.id
        ? persistence.taskStore.update(task.id, input)
        : persistence.createTask(input);

      if (!record) {
        throw new Error(`Task update failed: ${task.id || task.task_key}`);
      }

      if (!task.id) {
        createdTaskIds.push(record.id);
      }

      taskRecords.push(record);
      keyToId.set(task.task_key, record.id);
    }

    const resolvedRecords = [];
    for (const record of taskRecords) {
      const resolvedDependencies = record.dependencies.map((dependency) =>
        keyToId.get(dependency) || dependency
      );
      const updated = persistence.taskStore.update(record.id, {
        dependencies: resolvedDependencies,
      });
      if (!updated) {
        throw new Error(`Task dependency update failed: ${record.id}`);
      }
      resolvedRecords.push(updated);
    }

    return resolvedRecords;
  } catch (error) {
    rollbackTaskChanges(persistence, rollbackState);
    throw error;
  }
}

function resolveReviewAgent(options = {}) {
  return options.reviewAgent
    ? normalizeAgentName(options.reviewAgent, "reviewAgent")
    : "Claude";
}

function buildSolutionPatch(workItem, solution, taskRecords, options = {}) {
  const reviewAgent = resolveReviewAgent(options);
  return {
    solution: {
      ...solution,
      evaluated_by: reviewAgent,
      recorded_at: new Date().toISOString(),
    },
    tasks: taskRecords.map((task) => task.id),
    metadata: {
      ...(workItem.metadata || {}),
      solution_breakdown: {
        task_count: taskRecords.length,
        task_ids: taskRecords.map((task) => task.id),
        review_agent: reviewAgent,
        ready_for_development: true,
      },
    },
  };
}

function advanceToReadyForDevelopment(persistence, workItem) {
  const transitions = [];
  if (workItem.status === "needs_clarification") {
    transitions.push(transitionWorkItem(persistence, workItem.id, "solution_review"));
    transitions.push(transitionWorkItem(persistence, workItem.id, "ready_for_development"));
  } else if (workItem.status === "solution_review") {
    transitions.push(transitionWorkItem(persistence, workItem.id, "ready_for_development"));
  } else {
    transitions.push(workItem);
  }
  return transitions;
}

function recordBreakdownA2A(persistence, workItemId, taskRecords, options = {}) {
  if (options.recordA2A === false) {
    return null;
  }

  const reviewAgent = resolveReviewAgent(options);
  return createA2AEvent(persistence, {
    purpose: "task_breakdown_feedback",
    from_agent: "Codex",
    to_agent: reviewAgent,
    work_item_id: workItemId,
    context: JSON.stringify({
      kind: "solution_task_breakdown",
      task_ids: taskRecords.map((task) => task.id),
    }),
    claim_or_request:
      `Please review the solution task breakdown (${taskRecords.length} tasks).`,
    response: options.a2aResponse || "",
    conclusion: options.a2aConclusion || "",
    next_action: options.a2aNextAction || "awaiting_breakdown_feedback",
    requires_user_intervention: false,
  });
}

function recordSolutionAndTaskBreakdown(persistence, workItemId, input = {}, options = {}) {
  const validated = validateSolutionBreakdown(persistence, workItemId, input, options);
  const originalWorkItem = validated.workItem;
  const rollbackState = {
    createdTaskIds: [],
    updatedTaskSnapshots: new Map(),
  };

  try {
    for (const task of validated.tasks) {
      if (task.id) {
        rollbackState.updatedTaskSnapshots.set(
          task.id,
          persistence.taskStore.read(task.id)
        );
      }
    }

    const taskRecords = upsertTasks(
      persistence,
      workItemId,
      validated.tasks,
      rollbackState
    );

    persistence.workItemStore.update(
      workItemId,
      buildSolutionPatch(originalWorkItem, validated.solution, taskRecords, options)
    );

    const statusTransitions = advanceToReadyForDevelopment(
      persistence,
      validated.workItem
    );
    const finalWorkItem = persistence.workItemStore.read(workItemId);
    const a2aEvent = recordBreakdownA2A(persistence, workItemId, taskRecords, options);

    return {
      workItem: finalWorkItem,
      tasks: taskRecords,
      a2aEvent,
      statusTransitions,
      ready_for_development: finalWorkItem.status === "ready_for_development",
    };
  } catch (error) {
    rollbackTaskChanges(persistence, rollbackState);
    if (originalWorkItem) {
      persistence.workItemStore.update(workItemId, originalWorkItem);
    }
    throw error;
  }
}

module.exports = {
  PRE_DEVELOPMENT_STATUSES,
  normalizeAgentName,
  normalizeBreakdownInput,
  recordSolutionAndTaskBreakdown,
  validateSolutionBreakdown,
};

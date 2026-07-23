/**
 * Task Service - Manages agent tasks with planning and step tracking.
 */
import type {
  AgentTask,
  TaskStep,
  TaskStatus,
  TaskPriority,
} from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import type { AppStore } from '../AppStore';
import { nanoid } from '../../utils/nanoid';

const log = logger.scope('TaskService');

export class TaskService {
  private appStore: AppStore;
  private tasks: Map<string, AgentTask> = new Map();

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  initialize(): void {
    const stored = this.appStore.get('agent.tasks') as AgentTask[] | undefined;
    if (stored) {
      for (const task of stored) {
        this.tasks.set(task.id, task);
      }
    }
    log.info(`Loaded ${this.tasks.size} tasks`);
  }

  private save(): void {
    this.appStore.set('agent.tasks', Array.from(this.tasks.values()));
  }

  createTask(
    title: string,
    description: string,
    agentId: string,
    sessionId: string,
    priority: TaskPriority = 'normal',
  ): AgentTask {
    const task: AgentTask = {
      id: nanoid(),
      title,
      description,
      status: 'pending',
      priority,
      steps: [],
      currentStepIndex: -1,
      agentId,
      sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    this.save();
    log.info(`Created task: ${task.title} (${task.id})`);
    return task;
  }

  getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(filters?: { status?: TaskStatus; sessionId?: string; limit?: number }): AgentTask[] {
    let tasks = Array.from(this.tasks.values());
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters?.sessionId) {
      tasks = tasks.filter(t => t.sessionId === filters.sessionId);
    }
    tasks.sort((a, b) => b.updatedAt - a.updatedAt);
    if (filters?.limit) {
      tasks = tasks.slice(0, filters.limit);
    }
    return tasks;
  }

  updateTaskStatus(id: string, status: TaskStatus, error?: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = status;
    task.updatedAt = Date.now();
    if (status === 'completed' || status === 'failed') {
      task.completedAt = Date.now();
    }
    if (error) task.error = error;
    this.save();
  }

  addStep(taskId: string, description: string, toolId?: string, toolArgs?: Record<string, unknown>): TaskStep {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const step: TaskStep = {
      id: nanoid(),
      description,
      toolId,
      toolArgs,
      status: 'pending',
    };
    task.steps.push(step);
    task.updatedAt = Date.now();
    this.save();
    return step;
  }

  updateStep(taskId: string, stepId: string, updates: Partial<TaskStep>): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const step = task.steps.find(s => s.id === stepId);
    if (!step) return;
    Object.assign(step, updates);
    task.updatedAt = Date.now();
    this.save();
  }

  advanceToNextStep(taskId: string): TaskStep | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Mark current step completed if pending/executing
    if (task.currentStepIndex >= 0 && task.currentStepIndex < task.steps.length) {
      const current = task.steps[task.currentStepIndex];
      if (current.status === 'pending' || current.status === 'executing') {
        current.status = 'completed';
      }
    }

    task.currentStepIndex++;
    if (task.currentStepIndex >= task.steps.length) {
      task.status = 'completed';
      task.completedAt = Date.now();
      this.save();
      return null;
    }

    task.steps[task.currentStepIndex].status = 'executing';
    task.steps[task.currentStepIndex].startTime = Date.now();
    task.updatedAt = Date.now();
    this.save();
    return task.steps[task.currentStepIndex];
  }

  cancelTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = 'cancelled';
    task.updatedAt = Date.now();
    // Cancel pending steps
    for (const step of task.steps) {
      if (step.status === 'pending' || step.status === 'executing') {
        step.status = 'skipped';
      }
    }
    this.save();
  }

  deleteTask(id: string): boolean {
    const deleted = this.tasks.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  cleanup(olderThanDays: number = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (task.updatedAt < cutoff && (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')) {
        this.tasks.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.save();
      log.info(`Cleaned up ${removed} old tasks`);
    }
    return removed;
  }
}

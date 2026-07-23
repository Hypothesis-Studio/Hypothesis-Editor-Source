import { nanoid } from '../../utils/nanoid';
import type { AgentConfig, ChatMessage, ChatSession, ToolExecutionContext, TokenUsage } from '../../../shared/types/agent';

export interface PlanStep {
  description: string;
  toolId?: string;
  toolArgs?: Record<string, unknown>;
}

export interface PlanTask {
  title: string;
  description: string;
  steps: PlanStep[];
}

export interface Plan {
  tasks: PlanTask[];
  summary: string;
}

export async function generatePlan(
  providerId: string,
  modelId: string,
  providers: any,
  userMessage: string,
  availableTools: any[],
  wsPath: string,
): Promise<Plan> {
  const toolList = availableTools.map((t: any) => `- ${t.id}: ${t.description}`).join('\n');
  const prompt = `You are a planning engine. Given the user's request and available tools, create an execution plan.

Available tools:
${toolList}

Workspace: ${wsPath || '(current directory)'}

User request: ${userMessage}

Create a numbered plan with specific steps. Each step should specify which tool to use and with what arguments.
Be thorough - cover all aspects of the request. For file operations, use absolute paths or paths relative to workspace.

Respond ONLY with valid JSON in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "What this task accomplishes",
      "steps": [
        {
          "description": "What this step does",
          "toolId": "toolName",
          "toolArgs": {"param": "value"}
        }
      ]
    }
  ],
  "summary": "Brief summary of the overall plan"
}`;

  const response = await providers.chat(providerId, {
    model: modelId,
    messages: [
      { role: 'system', content: 'You are a precise planning engine. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 2000,
  });

  try {
    const json = response.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(json) as Plan;
  } catch {
    return {
      tasks: [{ title: 'Direct Response', description: 'Respond directly to user', steps: [{ description: userMessage }] }],
      summary: 'Direct response without tools',
    };
  }
}

export async function verifyStep(
  providerId: string,
  modelId: string,
  providers: any,
  stepDescription: string,
  result: string,
  wsPath: string,
): Promise<{ verified: boolean; issues: string }> {
  const prompt = `Verify if this step execution result is correct and complete.

Step: ${stepDescription}
Result (first 2000 chars): ${result.substring(0, 2000)}
Workspace: ${wsPath}

Respond ONLY with valid JSON:
{"verified": true/false, "issues": "description of issues if any"}`;

  try {
    const response = await providers.chat(providerId, {
      model: modelId,
      messages: [
        { role: 'system', content: 'You are a verification engine. Output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 500,
    });

    const json = response.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(json);
  } catch {
    return { verified: true, issues: 'Verification skipped (parse error)' };
  }
}

export async function analyzeAndFix(
  providerId: string,
  modelId: string,
  providers: any,
  stepDescription: string,
  error: string,
  previousAttempts: number,
  wsPath: string,
): Promise<{ toolId: string; toolArgs: Record<string, unknown>; explanation: string }> {
  const prompt = `Analyze this error and suggest a fix.

Step: ${stepDescription}
Error: ${error}
Previous attempts: ${previousAttempts}
Workspace: ${wsPath}

Respond ONLY with valid JSON:
{"toolId": "toolName", "toolArgs": {"param": "value"}, "explanation": "why this fix should work"}`;

  try {
    const response = await providers.chat(providerId, {
      model: modelId,
      messages: [
        { role: 'system', content: 'You are an error recovery engine. Output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    const json = response.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(json);
  } catch {
    return {
      toolId: '',
      toolArgs: {},
      explanation: 'Could not analyze error. Manual intervention needed.',
    };
  }
}

export async function generateSummary(
  providerId: string,
  modelId: string,
  providers: any,
  userMessage: string,
  taskResults: Array<{ title: string; status: string; steps: Array<{ description: string; result?: string; error?: string }> }>,
  wsPath: string,
): Promise<string> {
  const taskReport = taskResults.map(t => {
    const stepReport = t.steps.map((s, i) => {
      const status = s.error ? `✗ FAILED: ${s.error}` : `✓ ${s.result?.substring(0, 200) || 'Done'}`;
      return `  ${i + 1}. ${s.description} → ${status}`;
    }).join('\n');
    return `## ${t.title} [${t.status}]\n${stepReport}`;
  }).join('\n\n');

  const prompt = `Generate a concise work summary for this completed autonomous task.

User request: ${userMessage}
Workspace: ${wsPath}

Task Results:
${taskReport}

Create a clear, professional summary in markdown format. Include:
1. What was accomplished
2. Any issues encountered and how they were resolved
3. Files created/modified (if applicable)
4. Final status`;

  try {
    const response = await providers.chat(providerId, {
      model: modelId,
      messages: [
        { role: 'system', content: 'You are a technical writer. Generate clear, concise summaries.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      maxTokens: 1000,
    });
    return response.content;
  } catch {
    return `Completed ${taskResults.length} tasks. ${taskResults.filter(t => t.status === 'completed').length} succeeded, ${taskResults.filter(t => t.status === 'failed').length} failed.`;
  }
}

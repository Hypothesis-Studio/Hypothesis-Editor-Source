/**
 * AgentTasks - Task management and planning view for the agent system.
 */
import React, { useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentTask, TaskStatus } from '../../../shared/types/agent';

export const AgentTasks: React.FC = () => {
  const { tasks, loadTasks, cancelTask, deleteTask } = useAgentStore();

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'completed': return 'var(--theme-success, var(--theme-accent))';
      case 'failed': return 'var(--theme-error, #f44336)';
      case 'executing': return 'var(--theme-accent)';
      case 'planning': return 'var(--theme-warning, #ff9800)';
      case 'cancelled': return 'var(--theme-fg-muted)';
      default: return 'var(--theme-fg-muted)';
    }
  };

  const getStatusIcon = (status: TaskStatus): string => {
    switch (status) {
      case 'completed': return '✓';
      case 'failed': return '✗';
      case 'executing': return '⟳';
      case 'planning': return '⋯';
      case 'cancelled': return '⊘';
      default: return '○';
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)', margin: 0 }}>Tasks</h3>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{tasks.length} tasks</span>
      </div>

      {tasks.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: 200, color: 'var(--theme-fg-muted)',
        }}>
          <svg width={32} height={32} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ opacity: 0.3, marginBottom: 8 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div style={{ fontSize: 11 }}>No tasks yet</div>
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>Tasks are created when the agent plans multi-step operations</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              statusColor={getStatusColor(task.status)}
              statusIcon={getStatusIcon(task.status)}
              onCancel={() => cancelTask(task.id)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TaskCard: React.FC<{
  task: AgentTask;
  statusColor: string;
  statusIcon: string;
  onCancel: () => void;
  onDelete: () => void;
}> = ({ task, statusColor, statusIcon, onCancel, onDelete }) => {
  const [expanded, setExpanded] = React.useState(false);
  const completedSteps = task.steps.filter(s => s.status === 'completed').length;
  const totalSteps = task.steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div style={{
      background: 'var(--theme-bg-secondary)', borderRadius: 6,
      border: '1px solid var(--theme-border)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: statusColor, fontSize: 14, fontWeight: 600 }}>{statusIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--theme-fg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 2 }}>
            {task.status} · {completedSteps}/{totalSteps} steps · {new Date(task.updatedAt).toLocaleString()}
          </div>
        </div>

        {/* Progress bar */}
        {totalSteps > 0 && (
          <div style={{ width: 60, height: 4, background: 'var(--theme-bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: statusColor, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(task.status === 'executing' || task.status === 'planning' || task.status === 'pending') && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              style={actionBtnStyle}
              title="Cancel"
            >
              <svg width={12} height={12} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={actionBtnStyle}
            title="Delete"
          >
            <svg width={12} height={12} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded steps */}
      {expanded && task.steps.length > 0 && (
        <div style={{ borderTop: '1px solid var(--theme-border)', padding: '8px 12px' }}>
          {task.steps.map((step, i) => (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '4px 0', fontSize: 11,
              borderBottom: i < task.steps.length - 1 ? '1px solid var(--theme-border)' : 'none',
            }}>
              <span style={{
                color: step.status === 'completed' ? 'var(--theme-success, var(--theme-accent))'
                  : step.status === 'failed' ? 'var(--theme-error, #f44336)'
                  : step.status === 'executing' ? 'var(--theme-accent)'
                  : 'var(--theme-fg-muted)',
                fontWeight: 600, minWidth: 16,
              }}>
                {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'executing' ? '⟳' : '○'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--theme-fg)' }}>{step.description}</div>
                {step.toolId && (
                  <div style={{ fontSize: 9, color: 'var(--theme-fg-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                    Tool: {step.toolId}
                  </div>
                )}
                {step.error && (
                  <div style={{ fontSize: 10, color: 'var(--theme-error)', marginTop: 2 }}>{step.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div style={{
          padding: '6px 12px', fontSize: 10, color: 'var(--theme-error)',
          borderTop: '1px solid var(--theme-border)', background: 'rgba(244,67,54,0.05)',
        }}>
          {task.error}
        </div>
      )}
    </div>
  );
};

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--theme-fg-muted)', padding: 4, borderRadius: 3,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

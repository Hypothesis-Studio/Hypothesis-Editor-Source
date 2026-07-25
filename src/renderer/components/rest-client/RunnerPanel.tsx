/**
 * REST Client - Runner Panel (Collection runner with progress and results)
 */
import React, { useState, useCallback } from 'react';
import type { RestClientRunnerConfig, RestClientRunnerResult, RestClientRunRequestResult } from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { useRestClientStore } from '../../stores/restClientStore';

const mc: Record<string, string> = { GET: '#4ade80', POST: '#facc15', PUT: '#60a5fa', PATCH: '#a78bfa', DELETE: '#f87171' };

export const RunnerPanel: React.FC = () => {
  const { collections, activeCollectionId, isRunning, runnerResult, runnerProgress, startRunner, stopRunner } = useRestClientStore();
  const [colId, setColId] = useState(activeCollectionId || '');
  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const [stopOnError, setStopOnError] = useState(false);
  const [resultTab, setResultTab] = useState<'summary' | 'requests' | 'timeline'>('summary');
  const sel = collections.find(c => c.id === colId);

  const handleStart = useCallback(() => {
    if (!colId) return;
    startRunner(colId, { iterations, delay: delay > 0 ? delay : undefined, stopOnError });
  }, [colId, iterations, delay, stopOnError, startRunner]);

  const total = (sel?.requests.length || 0) * iterations;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <Icon name="play" size={18} style={{ color: 'var(--theme-accent)' }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Collection Runner</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl}>Collection</label>
            <select value={colId} onChange={e => setColId(e.target.value)} style={sel_style} disabled={isRunning}>
              <option value="">Select collection...</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.requests.length})</option>)}
            </select>
          </div>
          <div style={{ width: 100 }}><label style={lbl}>Iterations</label><input type="number" min={1} max={1000} value={iterations} onChange={e => setIterations(Math.max(1, parseInt(e.target.value) || 1))} style={numInp} disabled={isRunning} /></div>
          <div style={{ width: 120 }}><label style={lbl}>Delay (ms)</label><input type="number" min={0} step={100} value={delay} onChange={e => setDelay(Math.max(0, parseInt(e.target.value) || 0))} style={numInp} disabled={isRunning} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
            <button onClick={() => setStopOnError(!stopOnError)} style={{ width: 18, height: 18, border: '1px solid var(--theme-border)', borderRadius: 3, cursor: 'pointer', background: stopOnError ? 'var(--theme-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={isRunning}>{stopOnError && <Icon name="check" size={10} style={{ color: '#fff' }} />}</button>
            <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>Stop on error</span>
          </div>
          <button onClick={isRunning ? stopRunner : handleStart} disabled={!colId || collections.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', border: 'none', borderRadius: 6, background: isRunning ? '#f87171' : 'var(--theme-accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: !colId ? 0.5 : 1 }}>
            <Icon name={isRunning ? 'close' : 'play'} size={14} />{isRunning ? 'Stop' : 'Run'}
          </button>
        </div>
        {sel && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--theme-fg-muted)' }}>{sel.requests.length} requests × {iterations} iterations = {total} total</div>}
      </div>

      {isRunning && runnerProgress && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--theme-border)', borderTopColor: 'var(--theme-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12 }}>Iteration {runnerProgress.iteration}/{runnerProgress.totalIterations} • Request {runnerProgress.requestIndex}/{runnerProgress.totalRequests} • {runnerProgress.currentRequest}</span>
          </div>
          <div style={{ height: 4, background: 'var(--theme-border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((runnerProgress.iteration - 1) * runnerProgress.totalRequests + runnerProgress.requestIndex) / (runnerProgress.totalIterations * runnerProgress.totalRequests) * 100}%`, background: runnerProgress.passed ? '#4ade80' : '#f87171', transition: 'width 0.3s', borderRadius: 2 }} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!runnerResult && !isRunning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--theme-fg-muted)' }}>
            <Icon name="play" size={32} style={{ opacity: 0.3 }} /><div style={{ fontSize: 13 }}>Configure and run a collection</div>
          </div>
        )}
        {runnerResult && (
          <div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--theme-border)', padding: '0 16px' }}>
              {(['summary', 'requests', 'timeline'] as const).map(t => (
                <button key={t} onClick={() => setResultTab(t)} style={{ padding: '8px 14px', border: 'none', borderBottom: resultTab === t ? '2px solid var(--theme-accent)' : '2px solid transparent', background: 'transparent', color: resultTab === t ? 'var(--theme-fg)' : 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 11, fontWeight: resultTab === t ? 600 : 400 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
            {resultTab === 'summary' && <SummaryView result={runnerResult} />}
            {resultTab === 'requests' && <RequestsView result={runnerResult} />}
            {resultTab === 'timeline' && <TimelineView result={runnerResult} />}
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryView: React.FC<{ result: RestClientRunnerResult }> = ({ result }) => {
  const rate = result.totalRequests > 0 ? (result.passed / result.totalRequests * 100) : 0;
  const s = result.summary;
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: 12, background: 'var(--theme-bg-secondary)', borderRadius: 8 }}>
        <div style={{ flex: 1 }}><div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', background: 'var(--theme-border)' }}><div style={{ width: `${rate}%`, background: '#4ade80' }} /><div style={{ width: `${100 - rate}%`, background: '#f87171' }} /></div></div>
        <div style={{ fontSize: 20, fontWeight: 700, color: rate === 100 ? '#4ade80' : '#f87171', minWidth: 60, textAlign: 'right' }}>{rate.toFixed(0)}%</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatCard label="Total" value={result.totalRequests} /><StatCard label="Passed" value={result.passed} color="#4ade80" /><StatCard label="Failed" value={result.failed} color="#f87171" /><StatCard label="Duration" value={`${((result.finishedAt - result.startedAt) / 1000).toFixed(1)}s`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCard label="Avg" value={`${s.avgResponseTime.toFixed(0)}ms`} /><StatCard label="P95" value={`${s.p95ResponseTime.toFixed(0)}ms`} /><StatCard label="P99" value={`${s.p99ResponseTime.toFixed(0)}ms`} />
        <StatCard label="Min" value={`${s.minResponseTime}ms`} /><StatCard label="Max" value={`${s.maxResponseTime}ms`} /><StatCard label="Data" value={fmtBytes(s.totalDataReceived)} />
      </div>
    </div>
  );
};

const RequestsView: React.FC<{ result: RestClientRunnerResult }> = ({ result }) => (
  <div style={{ padding: 8 }}>
    {result.iterations.map(iter => (
      <div key={iter.iteration} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', padding: '4px 8px', marginBottom: 4 }}>Iteration {iter.iteration} — {iter.passed ? '✅' : '❌'} ({iter.duration}ms)</div>
        {iter.requests.map((r, i) => <ReqItem key={i} result={r} />)}
      </div>
    ))}
  </div>
);

const ReqItem: React.FC<{ result: RestClientRunRequestResult }> = ({ result }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${result.passed ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 6, marginBottom: 4, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', background: result.passed ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)' }}>
        <Icon name={result.passed ? 'check' : 'close'} size={12} style={{ color: result.passed ? '#4ade80' : '#f87171', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: mc[result.method] || 'var(--theme-fg-muted)', fontFamily: 'monospace', minWidth: 36 }}>{result.method}</span>
        <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.requestName}</span>
        {result.response && <span style={{ fontSize: 10, fontFamily: 'monospace', color: result.response.statusCode < 400 ? '#4ade80' : '#f87171' }}>{result.response.statusCode}</span>}
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{result.duration}ms</span>
      </div>
      {open && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--theme-border)', fontSize: 11 }}>
          <div style={{ color: 'var(--theme-fg-muted)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 4 }}>{result.url}</div>
          {result.error && <div style={{ color: '#f87171', marginBottom: 4 }}>Error: {result.error}</div>}
          {result.assertions.map((a, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, color: a.passed ? '#4ade80' : '#f87171' }}><span style={{ fontSize: 10 }}>{a.passed ? '✓' : '✗'}</span><span>{a.message}</span></div>)}
        </div>
      )}
    </div>
  );
};

const TimelineView: React.FC<{ result: RestClientRunnerResult }> = ({ result }) => {
  const all = result.iterations.flatMap(it => it.requests.map(r => ({ ...r, iter: it.iteration })));
  const max = Math.max(...all.map(r => r.duration), 1);
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 12 }}>Request Timeline ({all.length} requests)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {all.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', minWidth: 20, textAlign: 'right' }}>{i + 1}</span>
            <div style={{ flex: 1, height: 16, background: 'var(--theme-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(r.duration / max) * 100}%`, background: r.passed ? '#4ade80' : '#f87171', borderRadius: 3, minWidth: 2 }} /></div>
            <span style={{ fontSize: 10, fontFamily: 'monospace', minWidth: 50, textAlign: 'right' }}>{r.duration}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color }) => (
  <div style={{ padding: '10px 12px', background: 'var(--theme-bg-secondary)', borderRadius: 6, textAlign: 'center' }}>
    <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--theme-fg)', fontFamily: 'monospace' }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 2 }}>{label}</div>
  </div>
);

function fmtBytes(b: number): string { if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB`; }
const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--theme-fg-muted)', marginBottom: 4 };
const sel_style: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--theme-bg-input, var(--theme-bg))', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', fontSize: 12, outline: 'none' };
const numInp: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--theme-bg-input, var(--theme-bg))', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', fontSize: 12, outline: 'none', fontFamily: 'monospace' };

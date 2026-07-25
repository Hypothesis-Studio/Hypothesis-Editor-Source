/**
 * REST Client - Collection Runner
 */
import { BrowserWindow } from 'electron';
import type {
  RestClientCollection, RestClientRunnerConfig, RestClientRunnerResult,
  RestClientIterationResult, RestClientRunRequestResult, RestClientRunnerSummary,
  AssertionResult, RestClientVariable,
} from '../../../shared/types/rest-client';
import { sendRestClientRequest } from './RequestEngine';
import { executePreRequestScript, executeTestScript } from './ScriptEngine';

let activeRunner: { stop: () => void } | null = null;
export function stopActiveRunner(): boolean { if (activeRunner) { activeRunner.stop(); activeRunner = null; return true; } return false; }

export async function runCollection(
  collection: RestClientCollection, config: RestClientRunnerConfig,
  sendEvent: (channel: string, data: unknown) => void,
): Promise<RestClientRunnerResult> {
  const runnerId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  let stopped = false;
  activeRunner = { stop: () => { stopped = true; } };

  const iterations: RestClientIterationResult[] = [];
  const allTimes: number[] = [];
  let totalPassed = 0, totalFailed = 0, totalSkipped = 0, totalData = 0;
  let assertPassed = 0, assertFailed = 0;
  const flat = [...collection.requests];

  let dataRows: Record<string, string>[] = [];
  if (config.dataFile) dataRows = parseDataFile(config.dataFile.type, config.dataFile.content);

  const envVars = new Map<string, string>();
  const colVars = new Map<string, string>();
  for (const v of collection.variables) if (v.enabled) colVars.set(v.key, v.value);

  for (let iter = 0; iter < config.iterations; iter++) {
    if (stopped) break;
    const iterStart = Date.now();
    const reqResults: RestClientRunRequestResult[] = [];
    let iterPassed = true;
    const dataRow = dataRows[iter % dataRows.length] || {};

    for (const request of flat) {
      if (stopped) break;
      const scopes: Array<{ scope: string; variables: RestClientVariable[] }> = [
        { scope: 'global', variables: collection.variables },
        { scope: 'collection', variables: [] },
      ];
      const dv: RestClientVariable[] = Object.entries(dataRow).map(([k, v]) => ({ key: k, value: v, enabled: true, scope: 'collection' as const }));
      if (dv.length > 0) scopes.push({ scope: 'environment', variables: dv });

      if (request.preRequestScript || collection.preRequestScript) {
        const script = (request.preRequestScript || '') + '\n' + (collection.preRequestScript || '');
        const res = executePreRequestScript(script, request, new Map(scopes.flatMap(s => s.variables.map(v => [v.key, { value: v.value, scope: s.scope as any }]))), envVars);
        if (res.modifiedRequest) Object.assign(request, res.modifiedRequest);
        for (const [k, v] of Object.entries(res.variables)) colVars.set(k, v);
      }

      const reqStart = Date.now();
      let response: Awaited<ReturnType<typeof sendRestClientRequest>> | undefined;
      let assertions: AssertionResult[] = [];
      let error: string | undefined;

      try {
        response = await sendRestClientRequest(request, scopes);
        totalData += response.bodySize;
        if (request.testScript || collection.testScript) {
          const script = (request.testScript || '') + '\n' + (collection.testScript || '');
          const tr = executeTestScript(script, request, new Map(scopes.flatMap(s => s.variables.map(v => [v.key, { value: v.value, scope: s.scope as any }]))), envVars, { statusCode: response.statusCode, statusText: response.statusText, headers: response.headers, body: response.body, responseTime: response.responseTime });
          assertions = tr.assertions;
          for (const [k, v] of Object.entries(tr.variables)) colVars.set(k, v);
        }
        allTimes.push(response.responseTime);
        if (response.error) { error = response.error; iterPassed = false; totalFailed++; } else totalPassed++;
      } catch (err: any) { error = err.message || 'Unknown error'; iterPassed = false; totalFailed++; }

      for (const a of assertions) { if (a.passed) assertPassed++; else assertFailed++; }
      const passed = !error && assertions.every(a => a.passed);
      reqResults.push({ requestId: request.id, requestName: request.name, method: request.method, url: request.url, response, assertions, passed, duration: Date.now() - reqStart, error, extractedVariables: Object.fromEntries(colVars) });

      sendEvent('rest-client:event:runner-progress', { runnerId, iteration: iter + 1, totalIterations: config.iterations, requestIndex: reqResults.length, totalRequests: flat.length, currentRequest: request.name, passed, duration: Date.now() - reqStart });

      if (config.delay && config.delay > 0 && !stopped) await sleep(config.delay);
      if (config.stopOnError && !passed) { totalSkipped += flat.length - reqResults.length; break; }
    }

    iterations.push({ iteration: iter + 1, requests: reqResults, passed: iterPassed, duration: Date.now() - iterStart });
    if (config.delay && config.delay > 0 && iter < config.iterations - 1 && !stopped) await sleep(config.delay);
  }

  const finishedAt = Date.now();
  activeRunner = null;
  const sorted = [...allTimes].sort((a, b) => a - b);
  const summary: RestClientRunnerSummary = {
    avgResponseTime: sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
    p50ResponseTime: pct(sorted, 50), p95ResponseTime: pct(sorted, 95), p99ResponseTime: pct(sorted, 99),
    minResponseTime: sorted[0] || 0, maxResponseTime: sorted[sorted.length - 1] || 0,
    totalDataReceived: totalData, totalDataSent: 0,
    assertionStats: { total: assertPassed + assertFailed, passed: assertPassed, failed: assertFailed },
  };
  const result: RestClientRunnerResult = { id: runnerId, collectionId: collection.id, startedAt, finishedAt, totalRequests: flat.length * config.iterations, passed: totalPassed, failed: totalFailed, skipped: totalSkipped, iterations, summary };
  sendEvent('rest-client:event:runner-complete', result);
  return result;
}

function parseDataFile(type: 'json' | 'csv', content: string): Record<string, string>[] {
  if (type === 'json') { try { const p = JSON.parse(content); if (Array.isArray(p)) return p.map(r => typeof r === 'object' && r !== null ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])) : {}); } catch { return []; } }
  if (type === 'csv') { const lines = content.split('\n').filter(l => l.trim()); if (lines.length < 2) return []; const h = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g, '')); return lines.slice(1).map(l => { const v = l.split(',').map(x => x.trim().replace(/^"|"$/g, '')); return Object.fromEntries(h.map((k, i) => [k, v[i] || ''])); }); }
  return [];
}

function pct(sorted: number[], p: number): number { if (sorted.length === 0) return 0; return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]; }
function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

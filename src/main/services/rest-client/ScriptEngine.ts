/**
 * REST Client - Script Engine (Sandboxed JS execution for pre-request/test scripts)
 */
import { createContext, runInContext } from 'node:vm';
import type {
  ScriptContext, ScriptResult, HttpMethod, RestClientVariable,
  VariableScope, RestClientAuth, RestClientRequest, AssertionResult,
  RestClientAssertion, AssertionOperator,
} from '../../../shared/types/rest-client';

export function executePreRequestScript(
  script: string, request: RestClientRequest,
  variables: Map<string, { value: string; scope: VariableScope }>,
  environmentVars: Map<string, string>, timeout = 5000,
): ScriptResult {
  return executeScript(script, request, variables, environmentVars, undefined, timeout);
}

export function executeTestScript(
  script: string, request: RestClientRequest,
  variables: Map<string, { value: string; scope: VariableScope }>,
  environmentVars: Map<string, string>,
  response: { statusCode: number; statusText: string; headers: Record<string, string>; body: string; responseTime: number },
  timeout = 5000,
): ScriptResult {
  return executeScript(script, request, variables, environmentVars, response, timeout);
}

function executeScript(
  script: string, request: RestClientRequest,
  variables: Map<string, { value: string; scope: VariableScope }>,
  environmentVars: Map<string, string>,
  response: { statusCode: number; statusText: string; headers: Record<string, string>; body: string; responseTime: number } | undefined,
  timeout: number,
): ScriptResult {
  const startTime = Date.now();
  const logs: string[] = [];
  const errors: string[] = [];
  const assertions: AssertionResult[] = [];
  const extractedVars: Record<string, string> = {};
  let stopped = false, stopMessage = '';
  const modifiedReq: Partial<RestClientRequest> = {};
  let counter = 0;

  const makeAssert = (target: string, path: string | undefined, operator: AssertionOperator, expected: string | undefined, passed: boolean, message: string) => {
    const id = `assert_${++counter}_${Date.now()}`;
    const assertion: RestClientAssertion = { id, target: target as any, path, operator, expected, enabled: true };
    assertions.push({ assertion, passed, actual: undefined, message: passed ? `✓ ${message}` : `✗ ${message}` });
  };

  const assert = {
    equal: (a: unknown, e: unknown, m?: string) => makeAssert('body', undefined, 'equals', String(e), a === e, m || `Expected ${JSON.stringify(a)} to equal ${JSON.stringify(e)}`),
    notEqual: (a: unknown, e: unknown, m?: string) => makeAssert('body', undefined, 'not_equals', String(e), a !== e, m || `Expected ${JSON.stringify(a)} to not equal ${JSON.stringify(e)}`),
    contains: (a: string, e: string, m?: string) => makeAssert('body', undefined, 'contains', e, String(a).includes(e), m || `Expected "${a}" to contain "${e}"`),
    ok: (v: unknown, m?: string) => makeAssert('body', undefined, 'exists', 'truthy', !!v, m || `Expected ${JSON.stringify(v)} to be truthy`),
    notOk: (v: unknown, m?: string) => makeAssert('body', undefined, 'not_exists', 'falsy', !v, m || `Expected ${JSON.stringify(v)} to be falsy`),
    greaterThan: (a: number, e: number, m?: string) => makeAssert('body', undefined, 'greater_than', String(e), a > e, m || `Expected ${a} > ${e}`),
    lessThan: (a: number, e: number, m?: string) => makeAssert('body', undefined, 'less_than', String(e), a < e, m || `Expected ${a} < ${e}`),
    hasProperty: (o: unknown, p: string, m?: string) => makeAssert('body', p, 'exists', undefined, o != null && typeof o === 'object' && p in (o as Record<string, unknown>), m || `Expected object to have property "${p}"`),
    type: (v: unknown, t: string, m?: string) => makeAssert('body', undefined, 'is_type', t, typeof v === t, m || `Expected type "${typeof v}" to be "${t}"`),
    matches: (a: string, p: string | RegExp, m?: string) => { const r = typeof p === 'string' ? new RegExp(p) : p; makeAssert('body', undefined, 'matches', String(p), r.test(String(a)), m || `Expected "${a}" to match ${p}`); },
  };

  const scriptCtx: ScriptContext = {
    request: {
      method: request.method, url: request.url,
      headers: Object.fromEntries(request.headers.filter(h => h.enabled).map(h => [h.key, h.value])),
      body: request.body.raw, auth: request.auth,
      setMethod: (m: HttpMethod) => { modifiedReq.method = m; },
      setUrl: (u: string) => { modifiedReq.url = u; },
      setHeader: (name: string, value: string) => {
        if (!modifiedReq.headers) modifiedReq.headers = [...request.headers];
        const idx = modifiedReq.headers.findIndex(h => h.key.toLowerCase() === name.toLowerCase());
        if (idx >= 0) modifiedReq.headers[idx] = { ...modifiedReq.headers[idx], value };
        else modifiedReq.headers.push({ key: name, value, enabled: true });
      },
      setBody: (b: string) => { if (!modifiedReq.body) modifiedReq.body = { ...request.body }; modifiedReq.body.raw = b; modifiedReq.body.type = 'raw'; },
      setAuth: (a: RestClientAuth) => { modifiedReq.auth = a; },
    },
    variables: {
      get: (key: string) => variables.get(key)?.value,
      set: (key: string, value: string, scope: VariableScope = 'collection') => { variables.set(key, { value, scope }); extractedVars[key] = value; },
      unset: (key: string) => { variables.delete(key); },
      getAll: () => Object.fromEntries([...variables.entries()].map(([k, v]) => [k, v.value])),
    },
    environment: {
      get: (key: string) => environmentVars.get(key),
      set: (key: string, value: string) => { environmentVars.set(key, value); extractedVars[key] = value; },
    },
    assertions: assert,
    log: (...args: unknown[]) => { logs.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); },
    stop: (message: string) => { stopped = true; stopMessage = message; },
  };

  if (response) {
    let parsedBody: unknown;
    try { parsedBody = JSON.parse(response.body); } catch { /* not JSON */ }
    scriptCtx.response = {
      status: response.statusCode, headers: response.headers, body: response.body,
      json: () => parsedBody, text: () => response.body,
      header: (name: string) => { const l = name.toLowerCase(); for (const [k, v] of Object.entries(response.headers)) { if (k.toLowerCase() === l) return v; } return undefined; },
      responseTime: response.responseTime,
    };
  }

  const sandbox: Record<string, unknown> = {
    pm: scriptCtx,
    console: { log: scriptCtx.log, warn: scriptCtx.log, error: scriptCtx.log, info: scriptCtx.log },
    JSON, Math, Date, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    btoa: (str: string) => Buffer.from(str).toString('base64'),
    atob: (str: string) => Buffer.from(str, 'base64').toString(),
    crypto: { createHash: require('crypto').createHash, createHmac: require('crypto').createHmac, randomBytes: require('crypto').randomBytes },
    Buffer,
  };

  const ctx = createContext(sandbox);
  try { runInContext(script, ctx, { timeout, displayErrors: true }); }
  catch (err: any) {
    if (err.message?.includes('timed out')) errors.push(`Script timed out after ${timeout}ms`);
    else errors.push(`Script error: ${err.message || String(err)}`);
  }

  return {
    success: !stopped && errors.length === 0,
    logs,
    errors: stopped ? [stopMessage, ...errors] : errors,
    assertions,
    variables: extractedVars,
    modifiedRequest: Object.keys(modifiedReq).length > 0 ? modifiedReq : undefined,
    duration: Date.now() - startTime,
  };
}

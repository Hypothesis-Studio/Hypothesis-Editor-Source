/**
 * REST Client - Import/Export Engine
 */
import type {
  RestClientCollection, RestClientEnvironment, RestClientFolder, RestClientRequest,
  RestClientImportResult, RestClientExportOptions, KeyValue, HttpMethod, BodyType,
  AuthType, RestClientVariable, RestClientBody,
} from '../../../shared/types/rest-client';
import { nanoid } from '../../utils/nanoid';
import { parseCurl, generateCurl } from './CurlParser';

export function importRestClientData(content: string, format: string): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  try {
    const parsed = JSON.parse(content);
    switch (format) {
      case 'postman_v2': case 'postman_v2.1': return importPostman(parsed);
      case 'openapi_3': return importOpenAPI(parsed);
      case 'swagger_2': return importSwagger(parsed);
      case 'insomnia': return importInsomnia(parsed);
      case 'har': return importHAR(parsed);
      case 'rest_client': return importNative(parsed);
      default: errors.push(`Unsupported format: ${format}`);
    }
  } catch (err: any) { if (content.trim().startsWith('curl ')) return importCurl(content); errors.push(`Parse error: ${err.message}`); }
  return { collections, environments, errors, warnings };
}

function importPostman(data: any): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  const info = data.info || {};
  const col: RestClientCollection = { id: nanoid(), name: info.name || 'Imported', description: typeof info.description === 'string' ? info.description : info.description?.content || '', variables: parsePMVars(data.variable), auth: parsePMAuth(data.auth), headers: [], folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() };
  if (Array.isArray(data.item)) for (const item of data.item) {
    if (item.request) col.requests.push(parsePMRequest(item));
    else if (item.item) {
      const folder: RestClientFolder = { id: nanoid(), name: item.name || 'Folder', parentId: null, order: col.folders.length, createdAt: Date.now(), updatedAt: Date.now() };
      col.folders.push(folder);
      for (const sub of item.item) if (sub.request) col.requests.push(parsePMRequest(sub));
    }
  }
  collections.push(col);
  return { collections, environments, errors, warnings };
}

function parsePMRequest(item: any): RestClientRequest {
  const req = item.request || {}, method = (req.method || 'GET').toUpperCase() as HttpMethod;
  const headers: KeyValue[] = (req.header || []).map((h: any) => ({ key: h.key || '', value: h.value || '', enabled: !h.disabled }));
  let body: RestClientBody = { type: 'none' };
  if (req.body) switch (req.body.mode) {
    case 'raw': body = { type: 'raw', raw: req.body.raw || '' }; break;
    case 'urlencoded': body = { type: 'x-www-form-urlencoded', urlEncoded: (req.body.urlencoded || []).map((p: any) => ({ key: p.key || '', value: p.value || '', enabled: !p.disabled })) }; break;
    case 'formdata': body = { type: 'form-data', formData: (req.body.formdata || []).map((p: any) => ({ key: p.key || '', value: p.value || '', enabled: !p.disabled })) }; break;
    case 'graphql': body = { type: 'graphql', graphql: { query: req.body.graphql?.query || '', variables: req.body.graphql?.variables || '' } }; break;
  }
  const params: KeyValue[] = [];
  const u = typeof req.url === 'object' ? req.url : null;
  if (u?.query) for (const q of u.query) params.push({ key: q.key || '', value: q.value || '', enabled: !q.disabled });
  return { id: nanoid(), name: item.name || `${method} ${typeof req.url === 'string' ? req.url : req.url?.raw || ''}`, method, url: typeof req.url === 'string' ? req.url : req.url?.raw || '', headers, params, body, auth: parsePMAuth(req.auth), timeout: 30000, followRedirects: true, createdAt: Date.now(), updatedAt: Date.now() };
}

function parsePMAuth(d: any): { type: AuthType; [k: string]: any } {
  if (!d) return { type: 'none' };
  const fv = (t: string, k: string) => { const a = d[t]; if (!a) return undefined; return Array.isArray(a) ? a.find((i: any) => i.key === k)?.value : a[k]; };
  switch (d.type || 'none') {
    case 'basic': return { type: 'basic', basic: { username: fv('basic', 'username') || '', password: fv('basic', 'password') || '' } };
    case 'bearer': return { type: 'bearer', bearer: { token: fv('bearer', 'token') || '' } };
    case 'apikey': return { type: 'apikey', apikey: { key: fv('apikey', 'key') || '', value: fv('apikey', 'value') || '', addTo: (fv('apikey', 'in') || 'header') as 'header' | 'query' } };
    case 'oauth2': return { type: 'oauth2', oauth2: { grantType: fv('oauth2', 'grant_type') || 'authorization_code', clientId: fv('oauth2', 'clientId') || '', scope: fv('oauth2', 'scope') || '', accessToken: fv('oauth2', 'accessToken') || '' } };
    case 'digest': return { type: 'digest', digest: { username: fv('digest', 'username') || '', password: fv('digest', 'password') || '' } };
    default: return { type: 'none' };
  }
}

function parsePMVars(v: any[]): RestClientVariable[] { return Array.isArray(v) ? v.map(x => ({ key: x.key || '', value: x.value || '', enabled: !x.disabled, scope: 'collection' as const })) : []; }

function importOpenAPI(data: any): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  const baseUrl = (data.servers || [])[0]?.url || '';
  const col: RestClientCollection = { id: nanoid(), name: data.info?.title || 'OpenAPI Import', description: data.info?.description || '', variables: [], headers: [], folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() };
  for (const [path, pathItem] of Object.entries(data.paths || {}) as [string, any][]) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
      const op = pathItem[method]; if (!op) continue;
      const headers: KeyValue[] = [], params: KeyValue[] = [];
      for (const p of [...(pathItem.parameters || []), ...(op.parameters || [])]) {
        if (p.in === 'query') params.push({ key: p.name || '', value: p.example || '', enabled: true });
        else if (p.in === 'header') headers.push({ key: p.name || '', value: p.example || '', enabled: true });
      }
      let body: RestClientBody = { type: 'none' };
      if (op.requestBody?.content?.['application/json']) { const s = op.requestBody.content['application/json'].schema; body = { type: 'json', raw: s ? JSON.stringify(genExample(s), null, 2) : '' }; headers.push({ key: 'Content-Type', value: 'application/json', enabled: true }); }
      col.requests.push({ id: nanoid(), name: op.summary || `${method.toUpperCase()} ${path}`, method: method.toUpperCase() as HttpMethod, url: baseUrl + path, headers, params, body, auth: { type: 'none' }, timeout: 30000, followRedirects: true, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  collections.push(col);
  return { collections, environments, errors, warnings };
}

function genExample(s: any): any {
  if (!s) return null; if (s.example !== undefined) return s.example; if (s.default !== undefined) return s.default;
  switch (s.type) { case 'string': return s.enum?.[0] || 'string'; case 'number': case 'integer': return 0; case 'boolean': return false; case 'array': return s.items ? [genExample(s.items)] : []; case 'object': { const o: any = {}; for (const [k, v] of Object.entries(s.properties || {})) o[k] = genExample(v); return o; } default: return null; }
}

function importSwagger(data: any): RestClientImportResult {
  const bp = data.basePath || '', host = data.host || 'localhost', scheme = (data.schemes || ['https'])[0];
  return importOpenAPI({ info: data.info || {}, servers: [{ url: `${scheme}://${host}${bp}` }], paths: data.paths || {}, components: { securitySchemes: data.securityDefinitions } });
}

function importInsomnia(data: any): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  const res = data.resources || data.data || [];
  for (const ws of res.filter((r: any) => r._type === 'workspace')) {
    const col: RestClientCollection = { id: nanoid(), name: ws.name || 'Insomnia', variables: [], headers: [], folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() };
    for (const req of res.filter((r: any) => r._type === 'request')) {
      col.requests.push({ id: nanoid(), name: req.name || 'Request', method: (req.method || 'GET').toUpperCase(), url: (req.url || '').replace(/\{\{\s*_\.([^}]+)\}\}/g, '{{$1}}'), headers: Object.entries(req.headers || {}).map(([k, v]: any) => ({ key: k, value: typeof v === 'string' ? v : v.value || '', enabled: v.disabled !== true })), params: [], body: req.body?.mimeType === 'application/json' ? { type: 'json', raw: req.body.text || '' } : { type: 'none' }, auth: { type: 'none' }, timeout: 30000, followRedirects: true, createdAt: Date.now(), updatedAt: Date.now() });
    }
    collections.push(col);
  }
  for (const env of res.filter((r: any) => r._type === 'environment' || r._type === 'base_environment')) {
    if (env.data) environments.push({ id: nanoid(), name: env.name || 'Env', variables: Object.entries(env.data).map(([k, v]) => ({ key: k, value: String(v), enabled: true, scope: 'environment' as const })), isActive: false, createdAt: Date.now(), updatedAt: Date.now() });
  }
  return { collections, environments, errors, warnings };
}

function importHAR(data: any): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  const entries = data.log?.entries || [];
  const col: RestClientCollection = { id: nanoid(), name: 'HAR Import', variables: [], headers: [], folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() };
  for (const e of entries) {
    const r = e.request || {}, m = (r.method || 'GET').toUpperCase() as HttpMethod;
    const h: KeyValue[] = (r.headers || []).map((x: any) => ({ key: x.name || '', value: x.value || '', enabled: true }));
    const p: KeyValue[] = (r.queryString || []).map((x: any) => ({ key: x.name || '', value: x.value || '', enabled: true }));
    let body: RestClientBody = { type: 'none' };
    if (r.postData) { const mt = r.postData.mimeType || ''; if (mt.includes('json')) body = { type: 'json', raw: r.postData.text || '' }; else body = { type: 'raw', raw: r.postData.text || '' }; }
    col.requests.push({ id: nanoid(), name: `${m} ${(r.url || '').split('?')[0]}`, method: m, url: r.url || '', headers: h, params: p, body, auth: { type: 'none' }, timeout: 30000, followRedirects: true, createdAt: Date.now(), updatedAt: Date.now() });
  }
  collections.push(col);
  return { collections, environments, errors, warnings };
}

function importNative(data: any): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  if (data.collections) for (const c of data.collections) collections.push({ ...c, id: nanoid(), createdAt: Date.now(), updatedAt: Date.now() });
  if (data.environments) for (const e of data.environments) environments.push({ ...e, id: nanoid(), createdAt: Date.now(), updatedAt: Date.now() });
  return { collections, environments, errors, warnings };
}

function importCurl(curl: string): RestClientImportResult {
  const errors: string[] = [], warnings: string[] = [], collections: RestClientCollection[] = [], environments: RestClientEnvironment[] = [];
  const parsed = parseCurl(curl);
  collections.push({ id: nanoid(), name: 'cURL Import', variables: [], headers: [], folders: [], requests: [{ id: nanoid(), name: parsed.url ? `${parsed.method || 'GET'} ${parsed.url}` : 'Request', method: parsed.method || 'GET', url: parsed.url || '', headers: parsed.headers || [], params: [], body: parsed.body || { type: 'none' }, auth: parsed.auth || { type: 'none' }, timeout: 30000, followRedirects: true, createdAt: Date.now(), updatedAt: Date.now() }], createdAt: Date.now(), updatedAt: Date.now() });
  return { collections, environments, errors, warnings };
}

export function exportRestClientData(cols: RestClientCollection[], envs: RestClientEnvironment[], opts: RestClientExportOptions): string {
  switch (opts.format) {
    case 'rest_client': return JSON.stringify({ collections: cols, environments: envs, version: '1.0' }, null, 2);
    case 'postman_v2.1': return JSON.stringify(cols.map(c => ({ info: { name: c.name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: c.requests.map(r => ({ name: r.name, request: { method: r.method, header: r.headers.map(h => ({ key: h.key, value: h.value })), url: { raw: r.url } } })) })), null, 2);
    case 'curl': return cols.flatMap(c => c.requests.map(r => generateCurl(r))).join('\n\n');
    case 'har': return JSON.stringify({ log: { version: '1.2', creator: { name: 'REST Client' }, entries: cols.flatMap(c => c.requests.map(r => ({ request: { method: r.method, url: r.url, headers: r.headers.map(h => ({ name: h.key, value: h.value })) }, response: { status: 200, statusText: 'OK', headers: [] } }))) } }, null, 2);
    default: return '';
  }
}

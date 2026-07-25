/**
 * REST Client - Main Service (Orchestrator)
 */
import { BrowserWindow } from 'electron';
import type {
  RestClientCollection, RestClientEnvironment, RestClientHistoryEntry, RestClientRequest,
  RestClientFolder, RestClientVariable, RestClientExportOptions, RestClientImportResult,
  RestClientRunnerConfig, RestClientRunnerResult, RestClientTemplate, RestClientResponse, VariableResolution,
} from '../../../shared/types/rest-client';
import type { AppStore } from '../AppStore';
import { RestClientPersistence } from './RestClientPersistence';
import { sendRestClientRequest, cancelRestClientRequest } from './RequestEngine';
import { resolveAllVariables } from './VariableResolver';
import { importRestClientData, exportRestClientData } from './ImportExport';
import { parseCurl, generateCurl } from './CurlParser';
import { runCollection, stopActiveRunner } from './CollectionRunner';
import { nanoid } from '../../utils/nanoid';

export class RestClientService {
  private p: RestClientPersistence;
  constructor(appStore: AppStore) { this.p = new RestClientPersistence(appStore); }

  getCollections() { return this.p.getCollections(); }
  getCollection(id: string) { return this.p.getCollection(id); }
  createCollection(name: string, desc?: string) { return this.p.createCollection(name, desc); }
  updateCollection(id: string, u: Partial<RestClientCollection>) { return this.p.updateCollection(id, u); }
  deleteCollection(id: string) { return this.p.deleteCollection(id); }

  createRequest(cid: string, req: Partial<RestClientRequest>): RestClientRequest | undefined {
    const full: RestClientRequest = { id: nanoid(), name: req.name || 'New Request', method: req.method || 'GET', url: req.url || '', headers: req.headers || [], params: req.params || [], body: req.body || { type: 'none' }, auth: req.auth || { type: 'none' }, timeout: req.timeout || 30000, followRedirects: req.followRedirects !== false, createdAt: Date.now(), updatedAt: Date.now() };
    return this.p.addRequest(cid, full) ? full : undefined;
  }
  updateRequest(cid: string, rid: string, u: Partial<RestClientRequest>) { return this.p.updateRequest(cid, rid, { ...u, updatedAt: Date.now() }); }
  deleteRequest(cid: string, rid: string) { return this.p.deleteRequest(cid, rid); }
  duplicateRequest(cid: string, rid: string) { return this.p.duplicateRequest(cid, rid); }
  moveRequest(fid: string, rid: string, tid: string, idx?: number) { return this.p.moveRequest(fid, rid, tid, idx); }

  createFolder(cid: string, name: string, pid: string | null): RestClientFolder | undefined {
    const f: RestClientFolder = { id: nanoid(), name, parentId: pid, order: Date.now(), createdAt: Date.now(), updatedAt: Date.now() };
    return this.p.addFolder(cid, f) ? f : undefined;
  }
  updateFolder(cid: string, fid: string, u: Partial<RestClientFolder>) { return this.p.updateFolder(cid, fid, u); }
  deleteFolder(cid: string, fid: string) { return this.p.deleteFolder(cid, fid); }

  getEnvironments() { return this.p.getEnvironments(); }
  getEnvironment(id: string) { return this.p.getEnvironment(id); }
  createEnvironment(name: string, vars?: RestClientVariable[]) { return this.p.createEnvironment(name, vars); }
  updateEnvironment(id: string, u: Partial<RestClientEnvironment>) { return this.p.updateEnvironment(id, u); }
  deleteEnvironment(id: string) { return this.p.deleteEnvironment(id); }
  activateEnvironment(id: string) { this.p.activateEnvironment(id); }
  deactivateAllEnvironments() { this.p.deactivateAll(); }
  duplicateEnvironment(id: string) { return this.p.duplicateEnvironment(id); }

  getHistory() { return this.p.getHistory(); }
  clearHistory() { this.p.clearHistory(); }
  deleteHistoryEntry(id: string) { return this.p.deleteHistoryEntry(id); }
  searchHistory(q: string) { return this.p.searchHistory(q); }

  getGlobalVariables() { return this.p.getGlobalVariables(); }
  setGlobalVariable(key: string, value: string) { this.p.setGlobalVariable(key, value); }
  deleteGlobalVariable(key: string) { return this.p.deleteGlobalVariable(key); }

  resolveVariables(raw: string, cid?: string): VariableResolution {
    const scopes: Array<{ scope: any; variables: RestClientVariable[] }> = [{ scope: 'global', variables: this.getGlobalVariables() }];
    const env = this.p.getActiveEnvironment();
    if (env) scopes.push({ scope: 'environment', variables: env.variables });
    if (cid) { const col = this.getCollection(cid); if (col) scopes.push({ scope: 'collection', variables: col.variables }); }
    return resolveAllVariables(raw, scopes);
  }

  async sendRequest(rid: string, cid: string): Promise<RestClientResponse> {
    const col = this.getCollection(cid);
    if (!col) throw new Error('Collection not found');
    const req = col.requests.find(r => r.id === rid);
    if (!req) throw new Error('Request not found');
    const scopes: Array<{ scope: any; variables: RestClientVariable[] }> = [{ scope: 'global', variables: this.getGlobalVariables() }];
    const env = this.p.getActiveEnvironment();
    if (env) scopes.push({ scope: 'environment', variables: env.variables });
    scopes.push({ scope: 'collection', variables: col.variables });
    const response = await sendRestClientRequest(req, scopes);
    const entry: RestClientHistoryEntry = { id: nanoid(), requestId: req.id, collectionId: col.id, method: req.method, url: req.url, headers: req.headers, body: req.body, response, timestamp: Date.now(), duration: response.responseTime, environmentId: env?.id };
    this.p.addHistoryEntry(entry);
    this.p.addExample(req.id, response);
    this.emit('rest-client:event:response', { requestId: req.id, collectionId: col.id, response });
    return response;
  }

  cancelRequest(rid: string) { return cancelRestClientRequest(rid); }

  async runCollection(cid: string, config: RestClientRunnerConfig): Promise<RestClientRunnerResult> {
    const col = this.getCollection(cid);
    if (!col) throw new Error('Collection not found');
    const result = await runCollection(col, config, (ch, data) => this.emit(ch, data));
    this.p.addRunnerResult(result);
    return result;
  }
  stopRunner() { return stopActiveRunner(); }
  getRunnerStatus() { return { running: false }; }

  async importCollections(content: string, format: string): Promise<RestClientImportResult> {
    const result = importRestClientData(content, format);
    for (const c of result.collections) { const cs = this.p.getCollections(); cs.push(c); this.p.saveCollections(cs); }
    for (const e of result.environments) { const es = this.p.getEnvironments(); es.push(e); this.p.saveEnvironments(es); }
    return result;
  }

  exportCollections(opts: RestClientExportOptions): string {
    const cols = opts.collectionIds ? this.p.getCollections().filter(c => opts.collectionIds!.includes(c.id)) : this.p.getCollections();
    const envs = opts.environmentIds ? this.p.getEnvironments().filter(e => opts.environmentIds!.includes(e.id)) : this.p.getEnvironments();
    return exportRestClientData(cols, envs, opts);
  }

  getTemplates(): RestClientTemplate[] {
    return [
      { id: 'tpl_get', name: 'GET Request', description: 'Simple GET', category: 'Basic', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1', headers: [] },
      { id: 'tpl_post', name: 'POST JSON', description: 'POST with JSON', category: 'Basic', method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }], body: { type: 'json', raw: '{\n  "title": "Hello",\n  "body": "World",\n  "userId": 1\n}' } },
      { id: 'tpl_put', name: 'PUT Update', description: 'PUT update', category: 'Basic', method: 'PUT', url: 'https://jsonplaceholder.typicode.com/posts/1', headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }], body: { type: 'json', raw: '{\n  "id": 1,\n  "title": "Updated",\n  "body": "Body",\n  "userId": 1\n}' } },
      { id: 'tpl_delete', name: 'DELETE', description: 'DELETE resource', category: 'Basic', method: 'DELETE', url: 'https://jsonplaceholder.typicode.com/posts/1', headers: [] },
      { id: 'tpl_patch', name: 'PATCH', description: 'Partial update', category: 'Basic', method: 'PATCH', url: 'https://jsonplaceholder.typicode.com/posts/1', headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }], body: { type: 'json', raw: '{\n  "title": "Patched"\n}' } },
      { id: 'tpl_bearer', name: 'Bearer Auth', description: 'Bearer token', category: 'Auth', method: 'GET', url: 'https://httpbin.org/bearer', headers: [], auth: { type: 'bearer', bearer: { token: 'YOUR_TOKEN' } } },
      { id: 'tpl_basic', name: 'Basic Auth', description: 'Basic auth', category: 'Auth', method: 'GET', url: 'https://httpbin.org/basic-auth/user/passwd', headers: [], auth: { type: 'basic', basic: { username: 'user', password: 'passwd' } } },
      { id: 'tpl_form', name: 'Form Data', description: 'Multipart form', category: 'Forms', method: 'POST', url: 'https://httpbin.org/post', headers: [], body: { type: 'form-data', formData: [{ key: 'name', value: 'John', enabled: true }] } },
      { id: 'tpl_gql', name: 'GraphQL', description: 'GraphQL query', category: 'GraphQL', method: 'POST', url: 'https://countries.trevorblades.com/', headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }], body: { type: 'graphql', graphql: { query: '{ countries { name code capital } }' } } },
      { id: 'tpl_headers', name: 'Custom Headers', description: 'With custom headers', category: 'Advanced', method: 'GET', url: 'https://httpbin.org/headers', headers: [{ key: 'X-Custom', value: 'MyValue', enabled: true }, { key: 'X-Request-ID', value: '{{$guid}}', enabled: true }] },
    ];
  }

  generateCurl(rid: string, cid: string): string {
    const col = this.getCollection(cid); if (!col) return '';
    const req = col.requests.find(r => r.id === rid); if (!req) return '';
    return generateCurl(req);
  }

  private emit(channel: string, data: unknown) {
    BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.send(channel, data); });
  }
}

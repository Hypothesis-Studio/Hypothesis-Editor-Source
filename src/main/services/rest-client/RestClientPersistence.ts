/**
 * REST Client - Persistence Service (AppStore-backed storage)
 */
import type { RestClientCollection, RestClientEnvironment, RestClientHistoryEntry, RestClientWorkspace, RestClientRequest, RestClientFolder, RestClientVariable } from '../../../shared/types/rest-client';
import type { AppStore } from '../AppStore';
import { nanoid } from '../../utils/nanoid';

const SK = { COL: 'rest-client.collections' as const, ENV: 'rest-client.environments' as const, HIST: 'rest-client.history' as const, GV: 'rest-client.globalVariables' as const, AC: 'rest-client.activeCollectionId' as const, AE: 'rest-client.activeEnvironmentId' as const, AR: 'rest-client.activeRequestId' as const, EX: 'rest-client.examples' as const, RR: 'rest-client.runnerResults' as const };
const MAX_HIST = 500, MAX_EX = 20;

export class RestClientPersistence {
  private store: AppStore;
  constructor(store: AppStore) { this.store = store; }

  getCollections(): RestClientCollection[] { return (this.store.get as any)(SK.COL) || []; }
  saveCollections(c: RestClientCollection[]): void { (this.store.set as any)(SK.COL, c); }
  getCollection(id: string): RestClientCollection | undefined { return this.getCollections().find(c => c.id === id); }
  createCollection(name: string, desc?: string): RestClientCollection { const cs = this.getCollections(); const c: RestClientCollection = { id: nanoid(), name, description: desc || '', variables: [], headers: [], folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() }; cs.push(c); this.saveCollections(cs); return c; }
  updateCollection(id: string, u: Partial<RestClientCollection>): RestClientCollection | undefined { const cs = this.getCollections(); const i = cs.findIndex(c => c.id === id); if (i < 0) return undefined; cs[i] = { ...cs[i], ...u, updatedAt: Date.now() }; this.saveCollections(cs); return cs[i]; }
  deleteCollection(id: string): boolean { const cs = this.getCollections(); const f = cs.filter(c => c.id !== id); if (f.length === cs.length) return false; this.saveCollections(f); return true; }

  addRequest(cid: string, req: RestClientRequest): boolean { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return false; c.requests.push(req); c.updatedAt = Date.now(); this.saveCollections(cs); return true; }
  updateRequest(cid: string, rid: string, u: Partial<RestClientRequest>): boolean { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return false; const i = c.requests.findIndex(r => r.id === rid); if (i < 0) return false; c.requests[i] = { ...c.requests[i], ...u, updatedAt: Date.now() }; c.updatedAt = Date.now(); this.saveCollections(cs); return true; }
  deleteRequest(cid: string, rid: string): boolean { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return false; const b = c.requests.length; c.requests = c.requests.filter(r => r.id !== rid); if (c.requests.length === b) return false; c.updatedAt = Date.now(); this.saveCollections(cs); return true; }
  duplicateRequest(cid: string, rid: string): RestClientRequest | undefined { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return undefined; const o = c.requests.find(r => r.id === rid); if (!o) return undefined; const d: RestClientRequest = { ...JSON.parse(JSON.stringify(o)), id: nanoid(), name: `${o.name} (Copy)`, createdAt: Date.now(), updatedAt: Date.now() }; c.requests.push(d); c.updatedAt = Date.now(); this.saveCollections(cs); return d; }
  moveRequest(fid: string, rid: string, tid: string, idx?: number): boolean { const cs = this.getCollections(); const fc = cs.find(x => x.id === fid); const tc = cs.find(x => x.id === tid); if (!fc || !tc) return false; const i = fc.requests.findIndex(r => r.id === rid); if (i < 0) return false; const [req] = fc.requests.splice(i, 1); if (idx !== undefined && idx >= 0) tc.requests.splice(idx, 0, req); else tc.requests.push(req); fc.updatedAt = Date.now(); tc.updatedAt = Date.now(); this.saveCollections(cs); return true; }

  addFolder(cid: string, f: RestClientFolder): boolean { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return false; c.folders.push(f); c.updatedAt = Date.now(); this.saveCollections(cs); return true; }
  updateFolder(cid: string, fid: string, u: Partial<RestClientFolder>): boolean { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return false; const i = c.folders.findIndex(f => f.id === fid); if (i < 0) return false; c.folders[i] = { ...c.folders[i], ...u }; c.updatedAt = Date.now(); this.saveCollections(cs); return true; }
  deleteFolder(cid: string, fid: string): boolean { const cs = this.getCollections(); const c = cs.find(x => x.id === cid); if (!c) return false; c.folders = c.folders.filter(f => f.id !== fid); c.updatedAt = Date.now(); this.saveCollections(cs); return true; }

  getEnvironments(): RestClientEnvironment[] { return (this.store.get as any)(SK.ENV) || []; }
  saveEnvironments(e: RestClientEnvironment[]): void { (this.store.set as any)(SK.ENV, e); }
  getEnvironment(id: string): RestClientEnvironment | undefined { return this.getEnvironments().find(e => e.id === id); }
  getActiveEnvironment(): RestClientEnvironment | undefined { return this.getEnvironments().find(e => e.isActive); }
  createEnvironment(name: string, vars?: RestClientVariable[]): RestClientEnvironment { const es = this.getEnvironments(); const e: RestClientEnvironment = { id: nanoid(), name, variables: vars || [], isActive: false, createdAt: Date.now(), updatedAt: Date.now() }; es.push(e); this.saveEnvironments(es); return e; }
  updateEnvironment(id: string, u: Partial<RestClientEnvironment>): RestClientEnvironment | undefined { const es = this.getEnvironments(); const i = es.findIndex(e => e.id === id); if (i < 0) return undefined; es[i] = { ...es[i], ...u, updatedAt: Date.now() }; this.saveEnvironments(es); return es[i]; }
  deleteEnvironment(id: string): boolean { const es = this.getEnvironments(); const f = es.filter(e => e.id !== id); if (f.length === es.length) return false; this.saveEnvironments(f); return true; }
  activateEnvironment(id: string): void { const es = this.getEnvironments(); for (const e of es) e.isActive = e.id === id; this.saveEnvironments(es); (this.store.set as any)(SK.AE, id); }
  deactivateAll(): void { const es = this.getEnvironments(); for (const e of es) e.isActive = false; this.saveEnvironments(es); (this.store.set as any)(SK.AE, null); }
  duplicateEnvironment(id: string): RestClientEnvironment | undefined { const o = this.getEnvironment(id); if (!o) return undefined; return this.createEnvironment(`${o.name} (Copy)`, [...o.variables]); }

  getHistory(): RestClientHistoryEntry[] { return (this.store.get as any)(SK.HIST) || []; }
  addHistoryEntry(e: RestClientHistoryEntry): void { const h = this.getHistory(); h.unshift(e); if (h.length > MAX_HIST) h.length = MAX_HIST; (this.store.set as any)(SK.HIST, h); }
  clearHistory(): void { (this.store.set as any)(SK.HIST, []); }
  deleteHistoryEntry(id: string): boolean { const h = this.getHistory(); const f = h.filter(x => x.id !== id); if (f.length === h.length) return false; (this.store.set as any)(SK.HIST, f); return true; }
  searchHistory(q: string): RestClientHistoryEntry[] { const l = q.toLowerCase(); return this.getHistory().filter(h => h.url.toLowerCase().includes(l) || h.method.toLowerCase().includes(l)); }

  getGlobalVariables(): RestClientVariable[] { return (this.store.get as any)(SK.GV) || []; }
  setGlobalVariable(key: string, value: string): void { const vs = this.getGlobalVariables(); const i = vs.findIndex(v => v.key === key); if (i >= 0) vs[i] = { ...vs[i], value }; else vs.push({ key, value, enabled: true, scope: 'global' }); (this.store.set as any)(SK.GV, vs); }
  deleteGlobalVariable(key: string): boolean { const vs = this.getGlobalVariables(); const f = vs.filter(v => v.key !== key); if (f.length === vs.length) return false; (this.store.set as any)(SK.GV, f); return true; }

  getExamples(rid: string): any[] { const e = (this.store.get as any)(SK.EX) || {}; return (e as any)[rid] || []; }
  addExample(rid: string, resp: any): void { const e: any = (this.store.get as any)(SK.EX) || {}; if (!e[rid]) e[rid] = []; e[rid].unshift(resp); if (e[rid].length > MAX_EX) e[rid].length = MAX_EX; (this.store.set as any)(SK.EX, e); }
  getRunnerResults(): any[] { return (this.store.get as any)(SK.RR) || []; }
  addRunnerResult(r: any): void { const rs = this.getRunnerResults(); rs.unshift(r); if (rs.length > 20) rs.length = 20; (this.store.set as any)(SK.RR, rs); }

  getActiveCollectionId(): string | null { return (this.store.get as any)(SK.AC) || null; }
  setActiveCollectionId(id: string | null): void { (this.store.set as any)(SK.AC, id); }
  getActiveRequestId(): string | null { return (this.store.get as any)(SK.AR) || null; }
  setActiveRequestId(id: string | null): void { (this.store.set as any)(SK.AR, id); }
}

/**
 * REST Client - cURL Parser & Generator
 */
import type { RestClientRequest, HttpMethod, KeyValue, BodyType } from '../../../shared/types/rest-client';

export function parseCurl(curlCommand: string): Partial<RestClientRequest> {
  const tokens = tokenize(curlCommand);
  const result: Partial<RestClientRequest> = { method: 'GET', headers: [], params: [], body: { type: 'none' }, auth: { type: 'none' } };
  let i = 0, reqUrl = '', method: HttpMethod | undefined, dataParts: string[] = [], formParts: string[] = [], bodyType: BodyType = 'none';
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'curl') { i++; continue; }
    if (!t.startsWith('-') && !reqUrl) { reqUrl = t.replace(/^['"]|['"]$/g, ''); i++; continue; }
    if (t.startsWith('--')) {
      const flag = t.slice(2).toLowerCase();
      const next = () => (tokens[++i] || '').replace(/^['"]|['"]$/g, '');
      switch (flag) {
        case 'url': reqUrl = next(); break;
        case 'request': method = next().toUpperCase() as HttpMethod; break;
        case 'header': case 'headers': { const h = tokens[++i] || ''; const ci = h.indexOf(':'); if (ci > 0) result.headers!.push({ key: h.slice(0, ci).trim(), value: h.slice(ci + 1).trim(), enabled: true }); break; }
        case 'data': case 'data-raw': case 'data-ascii': case 'data-binary': case 'd': dataParts.push(next()); bodyType = 'raw'; break;
        case 'form': case 'f': formParts.push(next()); bodyType = 'form-data'; break;
        case 'user': case 'u': { const up = next(); const [un, pw] = up.split(':'); result.auth = { type: 'basic', basic: { username: un || '', password: pw || '' } }; break; }
        case 'user-agent': result.headers!.push({ key: 'User-Agent', value: next(), enabled: true }); break;
        case 'content-type': result.headers!.push({ key: 'Content-Type', value: next(), enabled: true }); break;
        case 'compressed': result.headers!.push({ key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true }); break;
        case 'location': case 'l': result.followRedirects = true; break;
        case 'max-time': case 'm': result.timeout = parseInt(next() || '30', 10) * 1000; break;
        case 'oauth2-bearer': result.auth = { type: 'bearer', bearer: { token: next() } }; break;
        default: break;
      }
      i++; continue;
    }
    if (t.startsWith('-') && t.length > 1 && !t.startsWith('--')) {
      const flags = t.slice(1);
      for (let f = 0; f < flags.length; f++) {
        const next = () => (tokens[++i] || '').replace(/^['"]|['"]$/g, '');
        switch (flags[f]) {
          case 'X': method = next().toUpperCase() as HttpMethod; break;
          case 'H': { const h = tokens[++i] || ''; const ci = h.indexOf(':'); if (ci > 0) result.headers!.push({ key: h.slice(0, ci).trim(), value: h.slice(ci + 1).trim(), enabled: true }); break; }
          case 'd': dataParts.push(next()); bodyType = 'raw'; break;
          case 'F': formParts.push(next()); bodyType = 'form-data'; break;
          case 'u': { const up = next(); const [un, pw] = up.split(':'); result.auth = { type: 'basic', basic: { username: un || '', password: pw || '' } }; break; }
          case 'A': result.headers!.push({ key: 'User-Agent', value: next(), enabled: true }); break;
          case 'L': result.followRedirects = true; break;
          case 'm': result.timeout = parseInt(next() || '30', 10) * 1000; break;
          case 'o': i++; break;
          default: break;
        }
      }
      i++; continue;
    }
    i++;
  }
  if (reqUrl) result.url = reqUrl;
  if (method) result.method = method;
  else if (dataParts.length > 0 || formParts.length > 0) result.method = 'POST';
  if (dataParts.length > 0) {
    const combined = dataParts.join('&');
    const trimmed = combined.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) { result.body = { type: 'json', raw: combined }; if (!result.headers!.some(h => h.key.toLowerCase() === 'content-type')) result.headers!.push({ key: 'Content-Type', value: 'application/json', enabled: true }); }
    else if (combined.includes('=') && !combined.includes('{')) { result.body = { type: 'x-www-form-urlencoded', urlEncoded: combined.split('&').map(p => { const [k, ...v] = p.split('='); return { key: k, value: v.join('='), enabled: true }; }) }; }
    else result.body = { type: bodyType, raw: combined };
  } else if (formParts.length > 0) { result.body = { type: 'form-data', formData: formParts.map(p => { const ei = p.indexOf('='); return ei > 0 ? { key: p.slice(0, ei), value: p.slice(ei + 1), enabled: true } : { key: p, value: '', enabled: true }; }) }; }
  return result;
}

function tokenize(input: string): string[] {
  const tokens: string[] = []; let current = '', inS = false, inD = false, esc = false;
  const norm = input.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ').trim();
  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i];
    if (esc) { current += ch; esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === "'" && !inD) { inS = !inS; continue; }
    if (ch === '"' && !inS) { inD = !inD; continue; }
    if ((ch === ' ' || ch === '\t') && !inS && !inD) { if (current.length > 0) { tokens.push(current); current = ''; } continue; }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

export function generateCurl(request: RestClientRequest): string {
  const parts: string[] = ['curl'];
  if (request.method !== 'GET') parts.push(`-X ${request.method}`);
  let fullUrl = request.url;
  const ep = request.params.filter(p => p.enabled);
  if (ep.length > 0) { try { const u = new URL(fullUrl); for (const p of ep) u.searchParams.set(p.key, p.value); fullUrl = u.toString(); } catch { /* invalid URL */ } }
  parts.push(`'${fullUrl}'`);
  for (const h of request.headers.filter(h => h.enabled)) parts.push(`-H '${h.key}: ${h.value}'`);
  if (request.auth.type === 'basic' && request.auth.basic) parts.push(`-u '${request.auth.basic.username}:${request.auth.basic.password}'`);
  if (request.auth.type === 'bearer' && request.auth.bearer) parts.push(`-H 'Authorization: ${request.auth.bearer.prefix || 'Bearer'} ${request.auth.bearer.token}'`);
  if (request.body.type !== 'none') {
    switch (request.body.type) {
      case 'json': case 'raw': if (request.body.raw) parts.push(`-d '${request.body.raw}'`); break;
      case 'x-www-form-urlencoded': if (request.body.urlEncoded) for (const f of request.body.urlEncoded.filter(f => f.enabled)) parts.push(`-d '${f.key}=${f.value}'`); break;
      case 'form-data': if (request.body.formData) for (const f of request.body.formData.filter(f => f.enabled)) parts.push(`-F '${f.key}=${f.value}'`); break;
    }
  }
  if (request.followRedirects) parts.push('-L');
  if (request.timeout) parts.push(`--max-time ${Math.floor(request.timeout / 1000)}`);
  return parts.join(' \\\n  ');
}

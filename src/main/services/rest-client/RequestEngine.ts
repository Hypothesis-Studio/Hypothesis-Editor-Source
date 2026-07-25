/**
 * REST Client - Request Engine (HTTP execution with auth, redirects, TLS, timeline)
 */
import * as http from 'node:http';
import * as https from 'node:https';
import * as url from 'node:url';
import * as zlib from 'node:zlib';
import * as tls from 'node:tls';
import type { RestClientRequest, RestClientResponse, KeyValue, HttpMethod, RestClientBody, ProxyConfig, RedirectInfo, RequestTimeline, RestClientVariable } from '../../../shared/types/rest-client';
import { resolveAllVariables } from './VariableResolver';

const activeRequests = new Map<string, { abort: () => void }>();

export function cancelRestClientRequest(requestId: string): boolean {
  const entry = activeRequests.get(requestId);
  if (entry) { entry.abort(); activeRequests.delete(requestId); return true; }
  return false;
}

export async function sendRestClientRequest(
  request: RestClientRequest,
  variableScopes: Array<{ scope: string; variables: RestClientVariable[] }>,
  globalTimeout = 30000,
): Promise<RestClientResponse> {
  const timeline: RequestTimeline = { start: Date.now(), phases: { request: 0, firstByte: 0, download: 0, total: 0 } };
  try {
    const resolvedUrl = resolveAllVariables(request.url, variableScopes as any).resolved;
    const resolvedHeaders = request.headers.filter(h => h.enabled).map(h => ({
      ...h,
      key: resolveAllVariables(h.key, variableScopes as any).resolved,
      value: resolveAllVariables(h.value, variableScopes as any).resolved,
    }));
    const parsedUrl = new url.URL(resolvedUrl);
    for (const param of request.params.filter(p => p.enabled)) {
      parsedUrl.searchParams.set(
        resolveAllVariables(param.key, variableScopes as any).resolved,
        resolveAllVariables(param.value, variableScopes as any).resolved,
      );
    }
    const finalUrl = parsedUrl.toString();
    const headers: Record<string, string> = {};
    for (const h of resolvedHeaders) headers[h.key] = h.value;
    applyAuth(headers, parsedUrl, request);
    const bodyData = prepareBody(request.body, headers);
    if (bodyData && !headers['Content-Length'] && !headers['content-length']) headers['Content-Length'] = Buffer.byteLength(bodyData).toString();
    if (!headers['User-Agent'] && !headers['user-agent']) headers['User-Agent'] = 'Hypothesis-RestClient/1.0';
    if (!headers['Accept'] && !headers['accept']) headers['Accept'] = '*/*';
    if (!headers['Accept-Encoding'] && !headers['accept-encoding']) headers['Accept-Encoding'] = 'gzip, deflate, br';
    const timeout = request.timeout || globalTimeout;
    const result = await executeRequest(finalUrl, request.method, headers, bodyData, timeout, request.followRedirects !== false, request.maxRedirects ?? 10, request, timeline);
    timeline.phases.total = Date.now() - timeline.start;
    result.timeline = timeline;
    return result;
  } catch (error: any) {
    timeline.phases.total = Date.now() - timeline.start;
    return { statusCode: 0, statusText: 'Error', headers: {}, body: '', bodySize: 0, responseTime: timeline.phases.total, responseSize: 0, error: error.message || 'Unknown error', timeline };
  }
}

function executeRequest(
  requestUrl: string, method: HttpMethod, headers: Record<string, string>, body: string | Buffer | null,
  timeout: number, followRedirects: boolean, maxRedirects: number, originalRequest: RestClientRequest,
  timeline: RequestTimeline, redirectCount = 0, redirects: RedirectInfo[] = [],
): Promise<RestClientResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(requestUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const options: any = {
      hostname: parsedUrl.hostname, port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search, method, headers, timeout,
      rejectUnauthorized: true,
    };
    const reqStart = Date.now();
    const req = transport.request(options, (res) => {
      const firstByteTime = Date.now();
      timeline.phases.firstByte = firstByteTime - reqStart;
      timeline.phases.request = timeline.phases.firstByte;
      if (followRedirects && redirectCount < maxRedirects && [301, 302, 303, 307, 308].includes(res.statusCode!)) {
        const location = res.headers['location'];
        if (location) {
          redirects.push({ statusCode: res.statusCode!, url: requestUrl, headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v || '')])) });
          res.resume();
          const redirectUrl = new url.URL(location, requestUrl).toString();
          executeRequest(redirectUrl, res.statusCode === 303 ? 'GET' : method, headers, (res.statusCode === 307 || res.statusCode === 308) ? body : null, timeout, followRedirects, maxRedirects, originalRequest, timeline, redirectCount + 1, redirects).then(resolve).catch(reject);
          return;
        }
      }
      const chunks: Buffer[] = [];
      const encoding = res.headers['content-encoding'];
      let stream: NodeJS.ReadableStream = res;
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        timeline.phases.download = Date.now() - firstByteTime;
        const bodyBuffer = Buffer.concat(chunks);
        const bodyStr = bodyBuffer.toString('utf-8');
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value || '');
        const cookies: KeyValue[] = [];
        const setCookies = res.headers['set-cookie'];
        if (setCookies) for (const cookie of setCookies) { const [nameValue] = cookie.split(';'); const eqIdx = nameValue.indexOf('='); if (eqIdx > 0) cookies.push({ key: nameValue.slice(0, eqIdx).trim(), value: nameValue.slice(eqIdx + 1).trim(), enabled: true }); }
        let tlsInfo: RestClientResponse['tlsInfo'];
        if (isHttps && res.socket) {
          const tlsSocket = res.socket as tls.TLSSocket;
          const cert = tlsSocket.getPeerCertificate();
          const cipher = tlsSocket.getCipher();
          if (cert) tlsInfo = { protocol: tlsSocket.getProtocol() || undefined, cipher: cipher ? `${cipher.name} (${cipher.version})` : undefined, certificate: { subject: String(cert.subject?.CN || ''), issuer: String(cert.issuer?.CN || ''), validFrom: cert.valid_from || '', validTo: cert.valid_to || '', serialNumber: cert.serialNumber || '', fingerprint: cert.fingerprint || '' } };
        }
        const contentType = responseHeaders['content-type'] || responseHeaders['Content-Type'];
        const contentLength = res.headers['content-length'];
        resolve({
          statusCode: res.statusCode || 0, statusText: res.statusMessage || '', headers: responseHeaders,
          body: bodyStr, bodySize: bodyBuffer.length, responseTime: Date.now() - timeline.start,
          responseSize: contentLength ? parseInt(contentLength, 10) : bodyBuffer.length,
          contentType, cookies, redirects: redirects.length > 0 ? redirects : undefined, tlsInfo,
          serverIp: res.socket?.remoteAddress, httpVersion: res.httpVersion,
        });
      });
      stream.on('error', (err) => reject(new Error(`Response stream error: ${err.message}`)));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timed out after ${timeout}ms`)); });
    req.on('error', (err) => reject(new Error(`Request error: ${err.message}`)));
    activeRequests.set(originalRequest.id, { abort: () => { req.destroy(); reject(new Error('Request cancelled')); } });
    if (body) req.write(body);
    req.end(() => activeRequests.delete(originalRequest.id));
  });
}

function applyAuth(headers: Record<string, string>, parsedUrl: url.URL, request: RestClientRequest): void {
  const auth = request.auth;
  if (!auth || auth.type === 'none') return;
  switch (auth.type) {
    case 'basic': if (auth.basic) headers['Authorization'] = `Basic ${Buffer.from(`${auth.basic.username}:${auth.basic.password}`).toString('base64')}`; break;
    case 'bearer': if (auth.bearer) headers['Authorization'] = `${auth.bearer.prefix || 'Bearer'} ${auth.bearer.token}`; break;
    case 'apikey': if (auth.apikey) { if (auth.apikey.addTo === 'header') headers[auth.apikey.headerName || 'X-API-Key'] = auth.apikey.value; else parsedUrl.searchParams.set(auth.apikey.queryParam || 'apikey', auth.apikey.value); } break;
    case 'digest': if (auth.digest) headers['Authorization'] = `Digest username="${auth.digest.username}"`; break;
    case 'oauth2': if (auth.oauth2?.accessToken) headers['Authorization'] = `${auth.oauth2.tokenType || 'Bearer'} ${auth.oauth2.accessToken}`; break;
    case 'awsv4': if (auth.awsv4) { const ds = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); headers['X-Amz-Date'] = ds; headers['X-Amz-Content-Sha256'] = require('crypto').createHash('sha256').update('').digest('hex'); if (auth.awsv4.sessionToken) headers['X-Amz-Security-Token'] = auth.awsv4.sessionToken; } break;
    case 'hawk': if (auth.hawk) headers['Authorization'] = `Hawk id="${auth.hawk.id}"`; break;
  }
}

function prepareBody(body: RestClientBody, headers: Record<string, string>): string | Buffer | null {
  switch (body.type) {
    case 'none': return null;
    case 'json': if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'; return body.raw || '';
    case 'raw': if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'text/plain'; return body.raw || '';
    case 'form-data': { const b = `----RC${Date.now().toString(36)}`; headers['Content-Type'] = `multipart/form-data; boundary=${b}`; if (!body.formData) return null; const p: string[] = []; for (const f of body.formData.filter(f => f.enabled)) p.push(`--${b}\r\nContent-Disposition: form-data; name="${f.key}"\r\n\r\n${f.value}\r\n`); p.push(`--${b}--\r\n`); return p.join(''); }
    case 'x-www-form-urlencoded': headers['Content-Type'] = 'application/x-www-form-urlencoded'; return (body.urlEncoded || []).filter(f => f.enabled).map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`).join('&');
    case 'graphql': headers['Content-Type'] = 'application/json'; if (!body.graphql) return ''; return JSON.stringify({ query: body.graphql.query, variables: body.graphql.variables ? JSON.parse(body.graphql.variables) : undefined, operationName: body.graphql.operationName || undefined });
    default: return body.raw || '';
  }
}

export function formatSize(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
export function formatDuration(ms: number): string { if (ms < 1000) return `${ms}ms`; if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`; const m = Math.floor(ms / 60000); return `${m}m ${((ms % 60000) / 1000).toFixed(1)}s`; }

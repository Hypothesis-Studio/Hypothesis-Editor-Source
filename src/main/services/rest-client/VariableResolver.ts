/**
 * REST Client - Variable Resolution Engine
 * Handles {{variable}} interpolation with scope precedence and dynamic variables.
 */
import type { RestClientVariable, VariableScope, VariableResolution } from '../../../shared/types/rest-client';

const VAR_REGEX = /\{\{([^}]+)\}\}/g;

export function resolveVariables(
  raw: string,
  scopes: Array<{ scope: VariableScope; variables: RestClientVariable[] }>,
): VariableResolution {
  const varMap = new Map<string, { value: string; scope: VariableScope }>();
  for (const { scope, variables } of scopes) {
    for (const v of variables) {
      if (v.enabled) varMap.set(v.key, { value: v.value, scope });
    }
  }
  const resolved = raw.replace(VAR_REGEX, (_match, key: string) => {
    const found = varMap.get(key.trim());
    return found ? found.value : `{{${key}}}`;
  });
  const variables: VariableResolution['variables'] = [];
  let m: RegExpExecArray | null;
  VAR_REGEX.lastIndex = 0;
  while ((m = VAR_REGEX.exec(raw)) !== null) {
    const key = m[1].trim();
    const found = varMap.get(key);
    variables.push({ key, value: found?.value ?? '', scope: found?.scope ?? 'global', found: !!found });
  }
  return { raw, resolved, variables };
}

export function getDynamicVariables(): Record<string, string> {
  const now = new Date();
  const ts = Math.floor(now.getTime() / 1000);
  const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  const ri = Math.floor(Math.random() * 1000000).toString();
  const ra = Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
  return {
    $timestamp: ts.toString(),
    $isoTimestamp: now.toISOString(),
    $guid: guid,
    $randomUUID: guid,
    $randomInt: ri,
    $randomAlpha: ra,
    $randomHexColor: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    $randomEmail: `user${ri}@example.com`,
    $randomFirstName: ra.charAt(0).toUpperCase() + ra.slice(1, 6),
    $randomLastName: ra.charAt(0).toUpperCase() + ra.slice(1, 8),
    $randomUrl: `https://example.com/${ra}`,
    $randomIP: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    $randomPrice: (Math.random() * 100).toFixed(2),
    $randomBoolean: Math.random() > 0.5 ? 'true' : 'false',
    $randomWord: ra,
    $timestampUnix: ts.toString(),
    $timestampUnixMs: now.getTime().toString(),
    $dayOfWeek: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()],
    $dayOfMonth: now.getDate().toString(),
    $month: (now.getMonth() + 1).toString().padStart(2, '0'),
    $year: now.getFullYear().toString(),
  };
}

export function resolveAllVariables(
  raw: string,
  scopes: Array<{ scope: VariableScope; variables: RestClientVariable[] }>,
): VariableResolution {
  const explicit = resolveVariables(raw, scopes);
  const dynamic = getDynamicVariables();
  const resolved = explicit.resolved.replace(/\{\{(\$[^}]+)\}\}/g, (_match, key: string) => {
    return dynamic[key] ?? `{{${key}}}`;
  });
  return { ...explicit, resolved };
}

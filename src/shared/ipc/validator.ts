/**
 * IPC Message Validator - Validates all IPC messages between processes.
 */
import { IPC_CHANNELS } from '../types';

type IPCHandler = (...args: unknown[]) => unknown;

interface ValidationRule {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  validator?: (value: unknown) => boolean;
  sanitizer?: (value: unknown) => unknown;
}

const IPC_VALIDATORS: Record<string, Record<string, ValidationRule>> = {
  [IPC_CHANNELS.FILE_SAVE]: {
    filePath: { required: true, type: 'string', sanitizer: sanitizePath },
    content: { required: true, type: 'string' },
  },
  [IPC_CHANNELS.FILE_READ]: {
    filePath: { required: true, type: 'string', sanitizer: sanitizePath },
  },
  [IPC_CHANNELS.FILE_DELETE]: {
    filePath: { required: true, type: 'string', sanitizer: sanitizePath },
  },
  [IPC_CHANNELS.FILE_RENAME]: {
    oldPath: { required: true, type: 'string', sanitizer: sanitizePath },
    newPath: { required: true, type: 'string', sanitizer: sanitizePath },
  },
  [IPC_CHANNELS.TERMINAL_CREATE]: {
    shell: { required: false, type: 'string', validator: isValidShell },
    cwd: { required: false, type: 'string', sanitizer: sanitizePath },
    name: { required: false, type: 'string' },
  },
  [IPC_CHANNELS.TERMINAL_WRITE]: {
    id: { required: true, type: 'string' },
    data: { required: true, type: 'string' },
  },
  [IPC_CHANNELS.SETTINGS_SET]: {
    key: { required: true, type: 'string' },
    value: { required: true, type: 'object' },
  },
};

function sanitizePath(value: unknown): string {
  const str = String(value);
  // Remove null bytes
  return str.replace(/\0/g, '');
}

function isValidPath(value: unknown): boolean {
  const str = String(value);
  // Check for path traversal
  if (str.includes('..') || str.includes('~')) return false;
  // Check for null bytes
  if (str.includes('\0')) return false;
  return true;
}

function isValidShell(value: unknown): boolean {
  const allowed = ['powershell.exe', 'cmd.exe', 'bash', 'zsh', 'sh', 'fish'];
  return allowed.includes(String(value));
}

function validateType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

export function validateIPC(channel: string, args: unknown[]): { valid: boolean; errors: string[]; sanitizedArgs: unknown[] } {
  const rules = IPC_VALIDATORS[channel];
  const errors: string[] = [];
  const sanitizedArgs = [...args];

  if (!rules) {
    return { valid: true, errors: [], sanitizedArgs };
  }

  // For single-object argument style
  const data = args[0];
  if (typeof data === 'object' && data !== null) {
    for (const [key, rule] of Object.entries(rules)) {
      const value = (data as Record<string, unknown>)[key];

      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (!validateType(value, rule.type)) {
          errors.push(`Invalid type for ${key}: expected ${rule.type}, got ${typeof value}`);
        }

        if (rule.validator && !rule.validator(value)) {
          errors.push(`Validation failed for ${key}`);
        }

        if (rule.sanitizer) {
          (sanitizedArgs[0] as Record<string, unknown>)[key] = rule.sanitizer(value);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, sanitizedArgs };
}

export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeFilePath(path: string): string {
  return path.replace(/\0/g, '').replace(/\.\./g, '');
}

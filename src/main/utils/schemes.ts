/**
 * Protocol registration for secure custom schemes.
 */
import { protocol } from 'electron';

export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'hypothesis',
      privileges: {
        standard: true,
        secure: true,
        bypassCSP: false,
        allowServiceWorkers: false,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

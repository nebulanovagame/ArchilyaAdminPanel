import os from 'os';
import { randomUUID } from 'crypto';
import Store from 'electron-store';
import type { MachineIdentityInfo } from '../../shared/remoteCommandTypes';

interface MachineIdentityStore {
  machineId?: string;
}

const store = new Store<MachineIdentityStore>({
  name: 'archilya-launcher-machine',
});

export function getOrCreateMachineId(): string {
  const existing = store.get('machineId');
  if (existing) {
    return existing;
  }

  const machineId = `arch-${randomUUID()}`;
  store.set('machineId', machineId);
  return machineId;
}

export function getMachineIdentityMetadata(): MachineIdentityInfo {
  return {
    machineId: getOrCreateMachineId(),
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
  };
}

import Dexie, { type Table } from 'dexie';
import type {
  Campaign,
  Recipient,
  SendLog,
  SendCounter,
  Template,
} from '@fanout/shared';

/** Single-row key/value settings bag. */
export interface SettingRow {
  key: string;
  value: unknown;
}

/**
 * Local operational store (ARCHITECTURE §4.1). Holds ALL recipient PII and
 * email content — never uploaded anywhere. Isolated per Chrome profile.
 */
export class FanoutDB extends Dexie {
  campaigns!: Table<Campaign, string>;
  recipients!: Table<Recipient, string>;
  sendLogs!: Table<SendLog, string>;
  sendCounters!: Table<SendCounter, string>;
  settings!: Table<SettingRow, string>;
  templates!: Table<Template, string>;

  constructor() {
    super('fanout');
    this.version(1).stores({
      // Indexes chosen for the send engine's hot paths.
      campaigns: 'id, status, updatedAt',
      recipients: 'id, campaignId, email, status, [campaignId+status]',
      sendLogs: 'id, campaignId, recipientId, timestamp',
      sendCounters: 'id, accountEmail, date',
      settings: 'key',
    });
    // v2 adds the reusable template library (TICKET-017).
    this.version(2).stores({
      templates: 'id, name, updatedAt',
    });
  }
}

export const db = new FanoutDB();

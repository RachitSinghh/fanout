import { create } from 'zustand';
import type {
  Campaign,
  Recipient,
  TokenMapping,
  ThrottleConfig,
  UserIdentity,
  Template,
} from '@fanout/shared';
import { tokenSchema, templateApplyPatch } from '@fanout/shared';
import { dbClient } from '../services/dbClient';
import {
  autoDetectMappings,
  buildRecipients,
  type ImportSummary,
} from '../services/recipients';
import type { ComposeSnapshot } from '../content/gmailDom';

export type Step = 'import' | 'map' | 'review' | 'send' | 'report';
export const STEP_ORDER: Step[] = ['import', 'map', 'review', 'send', 'report'];
export const STEP_LABELS: Record<Step, string> = {
  import: 'Import',
  map: 'Map',
  review: 'Preview',
  send: 'Send',
  report: 'Report',
};

interface CampaignStore {
  campaign: Campaign | null;
  recipients: Recipient[];
  importSummary: ImportSummary | null;
  step: Step;
  busy: boolean;
  error: string | null;

  start: (compose: ComposeSnapshot, identity: UserIdentity) => Promise<void>;
  resumeActive: () => Promise<boolean>;
  applyImport: (headers: string[], rows: Record<string, string>[]) => Promise<void>;
  rebuildRecipients: (emailColumn: string | null) => Promise<void>;
  setRecipients: (recipients: Recipient[]) => Promise<void>;
  setMappings: (mappings: TokenMapping[], headers: string[]) => Promise<void>;
  setThrottle: (throttle: ThrottleConfig) => Promise<void>;
  setDailyCap: (dailyCap: number | null) => Promise<void>;
  setTokenFallback: (token: string, fallback: string) => Promise<void>;
  applyTemplate: (template: Template) => Promise<void>;
  refresh: () => Promise<void>;
  goTo: (step: Step) => void;
  reset: () => void;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaign: null,
  recipients: [],
  importSummary: null,
  step: 'import',
  busy: false,
  error: null,

  start: async (compose, identity) => {
    set({ busy: true, error: null });
    try {
      const campaign = await dbClient.createCampaign({
        subject: compose.subject,
        bodyHtml: compose.bodyHtml,
        bodyText: compose.bodyText,
        fromEmail: identity.email,
        fromName: identity.name,
      });
      // Seed the token schema from the compose contents.
      const schema = tokenSchema(compose.subject, compose.bodyHtml);
      await dbClient.updateCampaign(campaign.id, { tokenSchema: schema });
      set({
        campaign: { ...campaign, tokenSchema: schema },
        recipients: [],
        step: 'import',
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : 'Failed to start' });
    }
  },

  resumeActive: async () => {
    // If a campaign is already sending/paused, resume showing it (so reopening
    // the overlay mid-send reflects live state — TICKET-011).
    const list = await dbClient.listCampaigns();
    const active = list.find(
      (c) => c.status === 'sending' || c.status === 'paused' || c.status === 'scheduled',
    );
    if (!active) return false;
    const recipients = await dbClient.listRecipients(active.id);
    set({ campaign: active, recipients, step: 'send', importSummary: null });
    return true;
  },

  applyImport: async (headers, rows) => {
    const { campaign } = get();
    if (!campaign) return;
    set({ busy: true, error: null });
    try {
      const mappings = autoDetectMappings(headers, campaign.tokenSchema);
      const emailCol = mappings.find((m) => m.token === 'email')?.column ?? null;
      const { recipients, summary } = buildRecipients(campaign.id, rows, emailCol);
      await dbClient.replaceRecipients(campaign.id, recipients);
      await dbClient.updateCampaign(campaign.id, { columnMappings: mappings, headers });
      set({
        campaign: { ...campaign, columnMappings: mappings, headers },
        recipients,
        importSummary: summary,
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : 'Import failed' });
    }
  },

  rebuildRecipients: async (emailColumn) => {
    const { campaign, recipients } = get();
    if (!campaign) return;
    // Reuse the imported field data already on each recipient row.
    const rows = recipients.map((r) => r.fields);
    const { recipients: rebuilt, summary } = buildRecipients(campaign.id, rows, emailColumn);
    await dbClient.replaceRecipients(campaign.id, rebuilt);
    set({ recipients: rebuilt, importSummary: summary });
  },

  setRecipients: async (recipients) => {
    const { campaign } = get();
    if (!campaign) return;
    await dbClient.replaceRecipients(campaign.id, recipients);
    await get().refresh();
    set({ recipients });
  },

  setMappings: async (mappings, headers) => {
    const { campaign } = get();
    if (!campaign) return;
    await dbClient.updateCampaign(campaign.id, { columnMappings: mappings, headers });
    set({ campaign: { ...campaign, columnMappings: mappings, headers } });
  },

  setThrottle: async (throttle) => {
    const { campaign } = get();
    if (!campaign) return;
    await dbClient.updateCampaign(campaign.id, { throttle });
    set({ campaign: { ...campaign, throttle } });
  },

  setDailyCap: async (dailyCap) => {
    const { campaign } = get();
    if (!campaign) return;
    await dbClient.updateCampaign(campaign.id, { dailyCap });
    set({ campaign: { ...campaign, dailyCap } });
  },

  setTokenFallback: async (token, fallback) => {
    const { campaign } = get();
    if (!campaign) return;
    // Rewrite bare {{Token}} occurrences (no existing fallback) to carry one.
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g');
    const repl = `{{${token}|${fallback}}}`;
    const patch = {
      subject: campaign.subject.replace(re, repl),
      bodyHtml: campaign.bodyHtml.replace(re, repl),
      bodyText: campaign.bodyText.replace(re, repl),
    };
    await dbClient.updateCampaign(campaign.id, patch);
    set({ campaign: { ...campaign, ...patch } });
  },

  applyTemplate: async (template) => {
    const { campaign } = get();
    if (!campaign) return;
    // Overwrite subject/body with the template and re-derive the token schema
    // from the template's own content (TICKET-017).
    const patch = templateApplyPatch(template);
    // Re-map the template's tokens to the already-imported columns. Without this,
    // applying a template introduces new {{tokens}} that no column feeds, so every
    // recipient is "missing values". autoDetect maps them against the CSV headers;
    // keep any column the user already picked (esp. the email column).
    const prev = new Map(campaign.columnMappings.map((m) => [m.token, m] as const));
    const columnMappings = autoDetectMappings(campaign.headers, patch.tokenSchema).map((m) => {
      const existing = prev.get(m.token);
      return existing?.column ? existing : m;
    });
    const full = { ...patch, columnMappings };
    await dbClient.updateCampaign(campaign.id, full);
    set({ campaign: { ...campaign, ...full } });
  },

  refresh: async () => {
    const { campaign } = get();
    if (!campaign) return;
    const [fresh, recipients] = await Promise.all([
      dbClient.getCampaign(campaign.id),
      dbClient.listRecipients(campaign.id),
    ]);
    if (fresh) set({ campaign: fresh, recipients });
  },

  goTo: (step) => set({ step }),

  reset: () =>
    set({ campaign: null, recipients: [], importSummary: null, step: 'import', error: null }),
}));

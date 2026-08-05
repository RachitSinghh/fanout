import type { Campaign, Recipient, SendLog, Template } from '@fanout/shared';
import { sendToWorker, type ComposeInput, type TemplateInput } from '../messaging/channel';

/**
 * Uniform campaign/recipient data access for ALL UI surfaces, routed through
 * the service worker (the single owner of the extension-origin IndexedDB).
 * The content-script overlay must use this (its own IndexedDB is the Gmail
 * page's origin); popup/options use it too so there is one code path.
 */
export const dbClient = {
  createCampaign: (compose: ComposeInput): Promise<Campaign> =>
    sendToWorker({ type: 'DATA_CAMPAIGN_CREATE', compose }),

  getCampaign: (id: string): Promise<Campaign | null> =>
    sendToWorker({ type: 'DATA_CAMPAIGN_GET', id }),

  updateCampaign: (id: string, patch: Partial<Campaign>): Promise<{ ok: true }> =>
    sendToWorker({ type: 'DATA_CAMPAIGN_UPDATE', id, patch }),

  listCampaigns: (): Promise<Campaign[]> =>
    sendToWorker({ type: 'DATA_CAMPAIGN_LIST' }),

  deleteCampaign: (id: string): Promise<{ ok: true }> =>
    sendToWorker({ type: 'DATA_CAMPAIGN_DELETE', id }),

  replaceRecipients: (campaignId: string, recipients: Recipient[]): Promise<{ ok: true }> =>
    sendToWorker({ type: 'DATA_RECIPIENTS_REPLACE', campaignId, recipients }),

  listRecipients: (campaignId: string): Promise<Recipient[]> =>
    sendToWorker({ type: 'DATA_RECIPIENTS_LIST', campaignId }),

  listSendLogs: (campaignId: string): Promise<SendLog[]> =>
    sendToWorker({ type: 'DATA_SENDLOGS_LIST', campaignId }),

  saveTemplate: (template: TemplateInput): Promise<Template> =>
    sendToWorker({ type: 'DATA_TEMPLATE_SAVE', template }),

  listTemplates: (): Promise<Template[]> =>
    sendToWorker({ type: 'DATA_TEMPLATE_LIST' }),

  deleteTemplate: (id: string): Promise<{ ok: true }> =>
    sendToWorker({ type: 'DATA_TEMPLATE_DELETE', id }),
};

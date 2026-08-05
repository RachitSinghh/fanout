import { AlertTriangle, ArrowRight, Mail } from 'lucide-react';
import type { TokenMapping } from '@fanout/shared';
import { useCampaignStore } from '../../../store/campaignStore';
import { StepLayout } from '../StepLayout';
import { Button, Callout, Badge } from '../../components/primitives';

/**
 * Map CSV columns to personalization tokens (TICKET-005). The `email` mapping
 * is required and, when changed, rebuilds the recipient list (re-validating and
 * re-deduping against the new address column).
 */
export function MapStep() {
  const goTo = useCampaignStore((s) => s.goTo);
  const campaign = useCampaignStore((s) => s.campaign);
  const recipients = useCampaignStore((s) => s.recipients);
  const summary = useCampaignStore((s) => s.importSummary);
  const setMappings = useCampaignStore((s) => s.setMappings);
  const rebuildRecipients = useCampaignStore((s) => s.rebuildRecipients);

  if (!campaign) return null;
  const headers = campaign.headers;
  const mappings = campaign.columnMappings;
  const emailMapping = mappings.find((m) => m.token === 'email') ?? null;
  const tokenMappings = mappings.filter((m) => m.token !== 'email');

  async function updateMapping(token: string, column: string | null) {
    const next: TokenMapping[] = mappings.map((m) =>
      m.token === token ? { ...m, column, auto: false } : m,
    );
    await setMappings(next, headers);
    if (token === 'email') await rebuildRecipients(column);
  }

  const emailSet = !!emailMapping?.column;
  const validCount = summary?.valid ?? 0;
  const unmapped = tokenMappings.filter((m) => !m.column).map((m) => m.token);
  const canContinue = emailSet && validCount > 0;

  return (
    <StepLayout
      footer={
        <>
          <Button variant="secondary" onClick={() => goTo('import')}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {!emailSet && (
              <span className="text-caption text-danger-fg">Set the email column</span>
            )}
            <Button disabled={!canContinue} onClick={() => goTo('review')}>
              Continue
            </Button>
          </div>
        </>
      }
    >
      <h2 className="text-xl font-semibold">Map your columns</h2>
      <p className="mt-2 text-body text-[var(--text-secondary)]">
        Headers were matched to tokens automatically. Adjust any that look off.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {tokenMappings.map((m) => (
          <MappingRow
            key={m.token}
            token={m.token}
            mapping={m}
            headers={headers}
            onChange={(col) => void updateMapping(m.token, col)}
          />
        ))}
        <MappingRow
          email
          token="email"
          mapping={emailMapping}
          headers={headers}
          onChange={(col) => void updateMapping('email', col)}
        />
      </div>

      {tokenMappings.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3 text-caption text-[var(--text-muted)]">
          No personalization tokens in your draft yet. Add{' '}
          <span className="font-mono text-brand-400">{'{{FirstName}}'}</span> (or any{' '}
          <span className="font-mono">{'{{token}}'}</span>) to your Gmail message and it'll show up
          here to map to a column.
        </div>
      )}

      {emailSet && validCount === 0 && (
        <Callout tone="danger" icon={<AlertTriangle size={16} />} className="mt-4">
          No valid email addresses were found in that column. Pick the column
          that actually contains email addresses.
        </Callout>
      )}

      {unmapped.length > 0 && (
        <Callout tone="warning" icon={<AlertTriangle size={16} />} className="mt-4">
          {unmapped.length} token{unmapped.length > 1 ? 's are' : ' is'} not mapped
          to a column ({unmapped.map((t) => `{{${t}}}`).join(', ')}). You can set a
          fallback in the next step, or map them here.
        </Callout>
      )}

      {emailSet && validCount > 0 && (
        <p className="mt-4 text-caption text-[var(--text-muted)]">
          {validCount} of {recipients.length} rows have a valid, unique address and
          will be sent.
        </p>
      )}
    </StepLayout>
  );
}

function MappingRow({
  token,
  email,
  mapping,
  headers,
  onChange,
}: {
  token: string;
  email?: boolean;
  mapping: TokenMapping | null;
  headers: string[];
  onChange: (column: string | null) => void;
}) {
  const needsColumn = email && !mapping?.column;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]">
      <select
        value={mapping?.column ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`h-8 min-w-[170px] rounded-lg border bg-[var(--surface)] px-3 text-body ${
          needsColumn ? 'border-danger-fg' : 'border-[var(--border)]'
        }`}
      >
        <option value="">— choose column —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)]" />

      {email ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-body">
          <Mail size={14} className="text-[var(--text-muted)]" /> Recipient
        </span>
      ) : (
        <span className="rounded-lg bg-brand-600/15 px-3 py-1.5 font-mono text-mono-sm text-brand-400">
          {`{{${token}}}`}
        </span>
      )}

      <span className="ml-auto shrink-0">
        {email ? (
          <span className="text-caption text-[var(--text-muted)]">required</span>
        ) : mapping?.auto && mapping.column ? (
          <Badge tone="info">auto</Badge>
        ) : null}
      </span>
    </div>
  );
}

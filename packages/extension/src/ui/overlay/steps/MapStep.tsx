import { AlertTriangle, Braces, Mail } from 'lucide-react';
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
      <h2 className="text-h2">Map columns to tokens</h2>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        We auto-detected these from your headers. Adjust any mapping if needed.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <MappingRow
          required
          icon={<Mail size={16} className="text-brand-600" />}
          label="Email address"
          mapping={emailMapping}
          headers={headers}
          onChange={(col) => void updateMapping('email', col)}
        />

        {tokenMappings.length > 0 && (
          <p className="mt-3 text-overline uppercase text-[var(--text-muted)]">
            Body tokens
          </p>
        )}
        {tokenMappings.map((m) => (
          <MappingRow
            key={m.token}
            icon={<Braces size={16} className="text-brand-500" />}
            label={`{{${m.token}}}`}
            mono
            mapping={m}
            headers={headers}
            onChange={(col) => void updateMapping(m.token, col)}
          />
        ))}
      </div>

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
  icon,
  label,
  mono,
  required,
  mapping,
  headers,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  mono?: boolean;
  required?: boolean;
  mapping: TokenMapping | null;
  headers: string[];
  onChange: (column: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className={mono ? 'font-mono text-mono-sm' : 'text-body-strong'}>{label}</span>
        {required && <span className="text-brand-600">*</span>}
        {mapping?.auto && mapping.column && <Badge tone="info">auto</Badge>}
      </div>
      <select
        value={mapping?.column ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`h-9 min-w-[200px] rounded-md border bg-neutral-100 px-3 text-body ${
          required && !mapping?.column ? 'border-danger-fg' : 'border-neutral-300'
        }`}
      >
        <option value="">— not mapped —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

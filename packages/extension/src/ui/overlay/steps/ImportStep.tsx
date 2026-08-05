import { useRef, useState } from 'react';
import { Upload, ClipboardPaste, FileText, X, AlertTriangle } from 'lucide-react';
import { useCampaignStore } from '../../../store/campaignStore';
import { StepLayout } from '../StepLayout';
import { Button, Callout } from '../../components/primitives';
import { parseCsvFile, parsePastedText } from '../../../services/csvService';
import { MAX_RECIPIENTS } from '@fanout/shared';

type Method = 'csv' | 'paste';

export function ImportStep() {
  const goTo = useCampaignStore((s) => s.goTo);
  const applyImport = useCampaignStore((s) => s.applyImport);
  const busy = useCampaignStore((s) => s.busy);
  const recipients = useCampaignStore((s) => s.recipients);
  // Default OUTSIDE the selector: returning `?? []` inside makes a fresh array
  // every render, which useSyncExternalStore reads as a changed snapshot →
  // infinite re-render loop (React #185). Select the stable value, default after.
  const headers = useCampaignStore((s) => s.campaign?.headers) ?? [];
  const summary = useCampaignStore((s) => s.importSummary);

  const [method, setMethod] = useState<Method>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function ingest(headers: string[], rows: Record<string, string>[]) {
    setError(null);
    if (rows.length === 0) {
      setError('No rows found. Check the file has a header row and data.');
      return;
    }
    if (rows.length > MAX_RECIPIENTS) {
      setError(`That list has ${rows.length} rows — the limit is ${MAX_RECIPIENTS}.`);
      return;
    }
    await applyImport(headers, rows);
  }

  async function onFile(file: File) {
    setFileName(file.name);
    try {
      const table = await parseCsvFile(file);
      await ingest(table.headers, table.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that file.");
    }
  }

  function onParsePaste() {
    try {
      const table = parsePastedText(pasteText);
      void ingest(table.headers, table.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't parse that text.");
    }
  }

  const hasData = recipients.length > 0;
  const canContinue = (summary?.valid ?? 0) > 0;

  return (
    <StepLayout
      footer={
        <>
          <span className="text-caption text-[var(--text-muted)]">
            {hasData ? `${recipients.length} rows · ${summary?.valid ?? 0} ready to send` : 'Import recipients'}
          </span>
          <Button disabled={!canContinue} onClick={() => goTo('map')}>
            Continue
          </Button>
        </>
      }
    >
      <h2 className="text-h2">Import recipients</h2>
      <p className="mt-1 text-body text-[var(--text-secondary)]">
        Upload a CSV or paste rows from a spreadsheet. Everything stays in this
        browser.
      </p>

      <div className="mt-4 flex gap-2">
        <MethodTab active={method === 'csv'} onClick={() => setMethod('csv')} icon={<Upload size={16} />}>
          Upload CSV
        </MethodTab>
        <MethodTab active={method === 'paste'} onClick={() => setMethod('paste')} icon={<ClipboardPaste size={16} />}>
          Paste
        </MethodTab>
      </div>

      <div className="mt-4">
        {method === 'csv' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void onFile(f);
            }}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 py-10 text-center"
          >
            {fileName ? (
              <div className="flex items-center gap-2 rounded-md bg-[var(--surface)] px-3 py-2 shadow-xs">
                <FileText size={16} className="text-brand-600" />
                <span className="text-body">{fileName}</span>
                <span className="text-caption text-[var(--text-muted)]">
                  {recipients.length} rows
                </span>
                <button
                  aria-label="Remove file"
                  onClick={() => {
                    setFileName(null);
                    if (fileInput.current) fileInput.current.value = '';
                  }}
                  className="ml-1 text-[var(--text-muted)] hover:text-danger-fg"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-[var(--text-muted)]" />
                <p className="mt-2 text-body text-[var(--text-secondary)]">
                  Drop a CSV or{' '}
                  <button
                    className="font-medium text-brand-600 underline"
                    onClick={() => fileInput.current?.click()}
                  >
                    click to browse
                  </button>
                </p>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </div>
        ) : (
          <div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'email\tFirstName\tCompany\njordan@acme.com\tJordan\tAcme'}
              className="h-32 w-full resize-none rounded-md border border-neutral-300 bg-neutral-100 p-3 font-mono text-mono-sm"
            />
            <Button className="mt-2" variant="secondary" size="sm" onClick={onParsePaste} loading={busy}>
              Parse pasted rows
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Callout tone="danger" icon={<AlertTriangle size={16} />} className="mt-4">
          {error}
        </Callout>
      )}

      {summary && hasData && (
        <div className="mt-4">
          <ImportSummaryRow />
          <PreviewTable headers={headers} />
        </div>
      )}
    </StepLayout>
  );
}

function MethodTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-label transition-colors ${
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-neutral-300 text-[var(--text-secondary)] hover:bg-neutral-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ImportSummaryRow() {
  const s = useCampaignStore((st) => st.importSummary);
  if (!s) return null;
  const issues = s.invalidEmail + s.missingEmail + s.duplicate;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-caption">
      <span className="rounded-full bg-success-bg px-2 py-0.5 text-success-fg">
        {s.valid} ready
      </span>
      {s.duplicate > 0 && (
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
          {s.duplicate} duplicate{s.duplicate > 1 ? 's' : ''} skipped
        </span>
      )}
      {s.invalidEmail > 0 && (
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
          {s.invalidEmail} invalid skipped
        </span>
      )}
      {s.missingEmail > 0 && (
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
          {s.missingEmail} missing email
        </span>
      )}
      {issues === 0 && (
        <span className="text-[var(--text-muted)]">No issues detected</span>
      )}
    </div>
  );
}

function PreviewTable({ headers }: { headers: string[] }) {
  const recipients = useCampaignStore((s) => s.recipients);
  const preview = recipients.slice(0, 5);
  if (headers.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="bg-[var(--surface-sunken)] text-left">
            <th className="px-3 py-2 text-overline uppercase text-[var(--text-muted)]">Status</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-mono text-caption text-[var(--text-muted)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">
                {r.status === 'skipped' ? (
                  <span className="text-caption text-warning-fg">skipped</span>
                ) : (
                  <span className="text-caption text-success-fg">ready</span>
                )}
              </td>
              {headers.map((h) => (
                <td key={h} className="max-w-[160px] truncate px-3 py-2">
                  {r.fields[h] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {recipients.length > 5 && (
        <p className="px-3 py-2 text-caption text-[var(--text-muted)]">
          + {recipients.length - 5} more rows
        </p>
      )}
    </div>
  );
}

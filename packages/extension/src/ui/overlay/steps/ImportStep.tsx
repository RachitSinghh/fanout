import { useState } from 'react';
import { UploadCloud, Upload, ClipboardPaste, FileSpreadsheet, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCampaignStore } from '../../../store/campaignStore';
import { StepLayout } from '../StepLayout';
import { Button, Callout } from '../../components/primitives';
import { parseCsvFile, parsePastedText } from '../../../services/csvService';
import { MAX_RECIPIENTS } from '@fanout/shared';

type Method = 'csv' | 'paste';

export function ImportStep() {
  const goTo = useCampaignStore((s) => s.goTo);
  const applyImport = useCampaignStore((s) => s.applyImport);
  const setRecipients = useCampaignStore((s) => s.setRecipients);
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
  const [dragActive, setDragActive] = useState(false);

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

  async function clearImport() {
    await setRecipients([]);
    setFileName(null);
    setPasteText('');
    setError(null);
  }

  const hasData = recipients.length > 0;
  const canContinue = (summary?.valid ?? 0) > 0;
  const issues = summary ? summary.invalidEmail + summary.missingEmail + summary.duplicate : 0;

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
      <h2 className="text-xl font-semibold">Import recipients</h2>
      <p className="mt-2 text-body text-[var(--text-secondary)]">
        Upload a CSV or paste rows from a spreadsheet. Everything stays in this
        browser.
      </p>

      {/* Segmented method control — matches the landing slide */}
      <div className="mt-5 inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-1 text-body">
        <MethodTab active={method === 'csv'} onClick={() => setMethod('csv')} icon={<Upload size={15} />}>
          Upload CSV
        </MethodTab>
        <MethodTab active={method === 'paste'} onClick={() => setMethod('paste')} icon={<ClipboardPaste size={15} />}>
          Paste
        </MethodTab>
      </div>

      <div className="mt-4">
        {method === 'csv' ? (
          <label
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              // Only clear when the pointer actually leaves the label, not when it
              // crosses onto a child (icon/text) — otherwise the highlight flickers.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files[0];
              if (f) void onFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-9 text-center transition-all duration-200 ${
              dragActive
                ? 'border-brand-600 bg-brand-600/10'
                : 'border-[var(--border-strong)] bg-[var(--surface-sunken)] hover:border-brand-600/50'
            }`}
          >
            <UploadCloud
              className={`${dragActive ? 'text-brand-400' : 'text-[var(--text-muted)]'} transition-transform duration-200 ${dragActive ? 'scale-110' : ''}`}
              size={30}
            />
            <p className="mt-3 text-body text-[var(--text-secondary)]">
              {dragActive ? (
                <span className="font-medium text-brand-400">Drop to upload</span>
              ) : (
                <>
                  Drop a CSV or <span className="font-medium text-brand-400 underline">click to browse</span>
                </>
              )}
            </p>
            {/* Native label→input: clicking anywhere opens the picker, no programmatic
                .click() (which double-fired and cancelled the dialog). */}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onClick={(e) => {
                (e.currentTarget as HTMLInputElement).value = '';
              }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        ) : (
          <div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'email\tFirstName\tCompany\njordan@acme.com\tJordan\tAcme'}
              className="h-32 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-3 font-mono text-mono-sm"
            />
            <Button className="mt-2" variant="secondary" size="sm" onClick={onParsePaste} loading={busy}>
              Parse pasted rows
            </Button>
          </div>
        )}
      </div>

      {/* Loaded-file result row (with a corner × to clear and re-import) */}
      {hasData && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600/15 text-brand-400">
            <FileSpreadsheet size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-medium">{fileName ?? 'Pasted rows'}</p>
            <p className="text-caption text-[var(--text-muted)]">
              {recipients.length} rows · {headers.length} column{headers.length === 1 ? '' : 's'} detected
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-brand-400">
            <CheckCircle2 size={14} /> ready
          </span>
          <button
            aria-label="Remove imported list"
            title="Remove"
            onClick={() => void clearImport()}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-danger-fg"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <Callout tone="danger" icon={<AlertTriangle size={16} />} className="mt-4">
          {error}
        </Callout>
      )}

      {/* Issue chips only when something needs attention — a clean import stays clean */}
      {hasData && summary && issues > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
          {summary.duplicate > 0 && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
              {summary.duplicate} duplicate{summary.duplicate > 1 ? 's' : ''} skipped
            </span>
          )}
          {summary.invalidEmail > 0 && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
              {summary.invalidEmail} invalid skipped
            </span>
          )}
          {summary.missingEmail > 0 && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning-fg">
              {summary.missingEmail} missing email
            </span>
          )}
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
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label transition-colors ${
        active
          ? 'bg-brand-600/15 font-semibold text-brand-400'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

import { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Trash2, Pencil, Check, X, Save } from 'lucide-react';
import type { Template } from '@fanout/shared';
import { dbClient } from '../../services/dbClient';
import { useCampaignStore } from '../../store/campaignStore';
import { Button } from '../components/primitives';
import { spring, duration } from '../motion/tokens';

/**
 * The template library (TICKET-017): save / name / load / edit / delete reusable
 * subject+body templates. Opened from the campaign panel header. All persistence
 * routes through the worker via dbClient (never Dexie directly — CLAUDE.md rule).
 */

interface EditState {
  id: string | null; // null = creating a new template
  name: string;
  subject: string;
  body: string;
}

/** Editing a body as plain text produces simple, escaped paragraph HTML. */
function plaintextToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function TemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const campaign = useCampaignStore((s) => s.campaign);
  const applyTemplate = useCampaignStore((s) => s.applyTemplate);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setTemplates(await dbClient.listTemplates());
  }

  useEffect(() => {
    if (open) {
      setEditing(null);
      void refresh();
    }
  }, [open]);

  // Esc closes, but not while an edit form is open (avoid losing input).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, editing, onClose]);

  async function saveCurrentDraft() {
    if (!campaign) return;
    setBusy(true);
    try {
      await dbClient.saveTemplate({
        name: campaign.name || campaign.subject || 'Untitled template',
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        bodyText: campaign.bodyText,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveForm() {
    if (!editing) return;
    setBusy(true);
    try {
      await dbClient.saveTemplate({
        id: editing.id ?? undefined,
        name: editing.name,
        subject: editing.subject,
        bodyText: editing.body,
        bodyHtml: plaintextToHtml(editing.body),
      });
      await refresh();
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await dbClient.deleteTemplate(id);
    await refresh();
  }

  async function use(t: Template) {
    await applyTemplate(t);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-popover flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editing) onClose();
          }}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Templates"
            className="flex max-h-[80vh] w-[560px] max-w-[92vw] flex-col overflow-hidden rounded-xl bg-[var(--surface)] shadow-lg"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.default}
          >
            <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-brand-600" />
                <h1 className="text-h2">Templates</h1>
              </div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-neutral-100"
              >
                <X size={18} />
              </button>
            </header>

            {editing ? (
              <EditForm
                state={editing}
                onChange={setEditing}
                onCancel={() => setEditing(null)}
                onSave={saveForm}
                busy={busy}
              />
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
                  <Button
                    size="sm"
                    leadingIcon={<Plus size={14} />}
                    onClick={() => setEditing({ id: null, name: '', subject: '', body: '' })}
                  >
                    New template
                  </Button>
                  {campaign && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leadingIcon={<Save size={14} />}
                      loading={busy}
                      onClick={saveCurrentDraft}
                    >
                      Save current draft
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {templates.length === 0 ? (
                    <p className="py-8 text-center text-body text-[var(--text-muted)]">
                      No templates yet. Save your current draft or create a new one.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {templates.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-strong">{t.name}</p>
                            <p className="truncate text-caption text-[var(--text-muted)]">
                              {t.subject || '(no subject)'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void use(t)}
                            disabled={!campaign}
                            title={campaign ? 'Apply to this campaign' : 'Open from a compose window to apply'}
                          >
                            Use
                          </Button>
                          <button
                            aria-label={`Edit ${t.name}`}
                            className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-neutral-100"
                            onClick={() =>
                              setEditing({ id: t.id, name: t.name, subject: t.subject, body: t.bodyText })
                            }
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            aria-label={`Delete ${t.name}`}
                            className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-danger-bg hover:text-danger-fg"
                            onClick={() => void remove(t.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function EditForm({
  state,
  onChange,
  onCancel,
  onSave,
  busy,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  const canSave = state.name.trim().length > 0;
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
      <label className="text-label">
        Name
        <input
          value={state.name}
          onChange={(e) => onChange({ ...state, name: e.target.value })}
          className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-neutral-100 px-3 text-body"
          placeholder="e.g. Cold outreach"
        />
      </label>
      <label className="text-label">
        Subject
        <input
          value={state.subject}
          onChange={(e) => onChange({ ...state, subject: e.target.value })}
          className="mt-1 h-9 w-full rounded-md border border-neutral-300 bg-neutral-100 px-3 text-body"
          placeholder="Hi {{FirstName}}"
        />
      </label>
      <label className="text-label">
        Body
        <textarea
          value={state.body}
          onChange={(e) => onChange({ ...state, body: e.target.value })}
          rows={8}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 font-mono text-mono-sm"
          placeholder="Write your message. Use {{Token}} for personalization."
        />
      </label>
      <p className="text-caption text-[var(--text-muted)]">
        Editing here saves the body as plain text. To keep rich formatting, compose in
        Gmail and use “Save current draft”.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" leadingIcon={<X size={14} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          leadingIcon={<Check size={14} />}
          loading={busy}
          disabled={!canSave}
          onClick={onSave}
        >
          Save template
        </Button>
      </div>
    </div>
  );
}

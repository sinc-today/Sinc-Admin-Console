'use client';

import { FilePdf, FileImage, UploadSimple } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { api, ApiError } from '@/lib/api';
import { isMarketPath, marketApiPath } from '@/lib/market';
import { dayFmt } from './directory-ui';
import { Modal } from './Modal';
import { Button, Field, InlineEmpty, inputClass, Panel, Skeleton } from './ui';

export interface OrgDocument {
  id: number;
  fileName: string;
  mime: string;
  size: number;
  createdAt: string;
  uploadedBy: string | null;
  byPartner: boolean;
}

export const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const DOC_MAX = 10 * 1024 * 1024;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Checks a picked file before sending it; the admin service checks it again from its contents. */
export const documentProblem = (f: File | null) => {
  if (!f) return null;
  if (f.size > DOC_MAX) return 'The file is larger than 10 MB.';
  if (f.type && !DOC_TYPES.includes(f.type)) return 'Upload a PDF, JPG, PNG or WebP file.';
  return null;
};

/** Sends the file itself (not JSON). Returns the new document. */
export const uploadDocument = (organizerId: number, file: File) =>
  api<{ document: OrgDocument }>(`/organizers/${organizerId}/documents`, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
  }).then((r) => r.document);

/** Link to a document's file; on market pages it goes through the partner-limited API. */
const fileHref = (organizerId: number, docId: number, download = false) => {
  let path = `/organizers/${organizerId}/documents/${docId}/file${download ? '?download=1' : ''}`;
  if (typeof window !== 'undefined' && isMarketPath(window.location.pathname)) path = marketApiPath(path, window.location.search);
  return `/admin-api/v1${path}`;
};

/** A file field for the optional company document. */
export function DocumentPicker({ file, onChange, id = 'org-doc' }: { file: File | null; onChange: (f: File | null) => void; id?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const problem = documentProblem(file);
  return (
    <Field label="Company document (optional)" htmlFor={id} helper="Registration certificate or licence. PDF, JPG, PNG or WebP, up to 10 MB.">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={ref}
          id={id}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="secondary" className="h-9 px-3 text-[13px]" icon={<UploadSimple size={16} aria-hidden />} onClick={() => ref.current?.click()}>
          {file ? 'Change file' : 'Choose file'}
        </Button>
        {file ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
            <span className="truncate">{file.name}</span>
            <span className="text-ink-muted">{kb(file.size)}</span>
            <button
              type="button"
              className="cursor-pointer text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
              onClick={() => {
                onChange(null);
                if (ref.current) ref.current.value = '';
              }}
            >
              Remove
            </button>
          </span>
        ) : (
          <span className="text-[13px] text-ink-muted">No file chosen</span>
        )}
      </div>
      {problem && <p className="mt-1 text-[12px] text-ember-ink">{problem}</p>}
    </Field>
  );
}

/** Company documents on file for an organizer: view, download, add, remove. */
export function OrganizerDocumentsPanel({ organizerId }: { organizerId: number }) {
  const canRead = useCan('organizers.read');
  const canEdit = useCan('organizers.verify');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['organizer-docs', organizerId], queryFn: () => api<{ items: OrgDocument[] }>(`/organizers/${organizerId}/documents`), enabled: canRead });
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removing, setRemoving] = useState<OrgDocument | null>(null);
  const [reason, setReason] = useState('');
  const add = useMutation({
    mutationFn: () => uploadDocument(organizerId, file!),
    meta: { success: 'Document added' },
    onSuccess: () => {
      setAdding(false);
      setFile(null);
      qc.invalidateQueries({ queryKey: ['organizer-docs', organizerId] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/organizers/${organizerId}/documents/${removing!.id}/remove`, { method: 'POST', json: { reason } }),
    meta: { success: 'Document removed' },
    onSuccess: () => {
      setRemoving(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['organizer-docs', organizerId] });
    },
  });
  if (!canRead) return null;
  return (
    <Panel
      title="Company documents"
      info="Optional documents added when verifying, such as a registration certificate. Only people who can see this organizer can open them; every view is in the audit log."
      actions={
        canEdit ? (
          <Button variant="quiet" icon={<UploadSimple size={16} aria-hidden />} onClick={() => setAdding(true)}>
            Add document
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : q.error ? (
        <p className="text-[13px] text-ember-ink">{(q.error as ApiError).message}</p>
      ) : !q.data?.items.length ? (
        <InlineEmpty>No documents yet.</InlineEmpty>
      ) : (
        <ul className="flex flex-col">
          {q.data.items.map((d) => (
            <li key={d.id} className="group -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-[8px] px-2 py-2 transition-colors hover:bg-fog">
              <a href={fileHref(organizerId, d.id)} target="_blank" rel="noopener noreferrer" className="flex min-w-0 cursor-pointer items-center gap-2 text-[13px] text-ink">
                {d.mime === 'application/pdf' ? <FilePdf size={20} className="shrink-0 text-ember" aria-hidden /> : <FileImage size={20} className="shrink-0 text-ember" aria-hidden />}
                <span className="truncate underline decoration-line-strong underline-offset-4 group-hover:decoration-ember">{d.fileName}</span>
              </a>
              <span className="flex items-center gap-3 text-[12px] text-ink-muted">
                {kb(d.size)} · {d.uploadedBy ?? 'Unknown'}
                {d.byPartner ? ' (partner)' : ''} · {dayFmt(d.createdAt)}
                <a href={fileHref(organizerId, d.id, true)} className="cursor-pointer text-ink-secondary hover:text-ink hover:underline">
                  Download
                </a>
                {canEdit && (
                  <button type="button" className="cursor-pointer text-ink-secondary hover:text-ember-ink hover:underline" onClick={() => setRemoving(d)}>
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a company document" width="max-w-[520px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <DocumentPicker file={file} onChange={setFile} id="org-doc-add" />
          {add.error && <p className="text-[12px] text-ember-ink">{(add.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={add.isPending} loadingText="Uploading…" disabled={!file || !!documentProblem(file)}>
              Upload
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove this document?" description="The file is deleted. The audit log keeps a record that it existed." width="max-w-[520px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            remove.mutate();
          }}
        >
          <Field label="Reason" htmlFor="doc-rm-reason">
            <input id="doc-rm-reason" required minLength={3} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong file" />
          </Field>
          {remove.error && <p className="text-[12px] text-ember-ink">{(remove.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" loading={remove.isPending} disabled={reason.trim().length < 3}>
              Remove
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

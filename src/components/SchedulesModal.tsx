import { useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, Form, FormGroup,
  Modal, ModalVariant, Spinner, Switch,
  TextInput, Title, Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon, PencilAltIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api/client';
import type { CollectionSchedule } from '../api/client';

interface Props {
  providerId: string;
  providerName: string;
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour',       value: '0 * * * *'    },
  { label: 'Every 4 hours',    value: '0 */4 * * *'  },
  { label: 'Every 6 hours',    value: '0 */6 * * *'  },
  { label: 'Daily at midnight',value: '0 0 * * *'    },
  { label: 'Daily at 2am',     value: '0 2 * * *'    },
  { label: 'Weekly (Sunday)',  value: '0 0 * * 0'    },
  { label: 'Custom...',        value: '__custom__'    },
];

const cronLabel = (expr: string) =>
  PRESETS.find((p) => p.value === expr && p.value !== '__custom__')?.label ?? expr;

interface FState { name: string; preset: string; custom: string; enabled: boolean; }
const blank = (): FState => ({ name: '', preset: '0 */6 * * *', custom: '', enabled: true });

export function SchedulesModal({ providerId, providerName, isOpen, onClose }: Props) {
  const [rows, setRows]         = useState<CollectionSchedule[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState<FState>(blank());
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [busy, setBusy]         = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try { setRows((await api.listSchedules(providerId)).results); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) load(); }, [isOpen, providerId]);

  const startAdd = () => { setEditId(null); setForm(blank()); setErr(''); setShowForm(true); };

  const startEdit = (s: CollectionSchedule) => {
    const isPreset = PRESETS.some((p) => p.value === s.cron_expression && p.value !== '__custom__');
    setEditId(s.id);
    setForm({
      name: s.name,
      preset: isPreset ? s.cron_expression : '__custom__',
      custom: isPreset ? '' : s.cron_expression,
      enabled: s.enabled,
    });
    setErr('');
    setShowForm(true);
  };

  const cronExpr = () => (form.preset === '__custom__' ? form.custom : form.preset);

  const save = async () => {
    const e = cronExpr().trim();
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (!e) { setErr('Cron expression is required.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { name: form.name.trim(), cron_expression: e, enabled: form.enabled };
      if (editId) { await api.updateSchedule(providerId, editId, payload); }
      else { await api.createSchedule(providerId, payload); }
      setShowForm(false);
      await load();
    } catch (ex: unknown) {
      setErr((ex as { message?: string }).message ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    setBusy((b) => new Set(b).add(id));
    try { await api.deleteSchedule(providerId, id); await load(); }
    finally { setBusy((b) => { const n = new Set(b); n.delete(id); return n; }); }
  };

  const toggle = async (s: CollectionSchedule) => {
    try { await api.updateSchedule(providerId, s.id, { enabled: !s.enabled }); await load(); }
    catch { /* swallow */ }
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '\u2014';

  const selStyle: React.CSSProperties = {
    width: '100%', height: '36px', padding: '0 8px',
    border: '1px solid var(--pf-v5-global--BorderColor--100)',
    borderRadius: '3px',
    background: 'var(--pf-v5-global--BackgroundColor--100)',
    color: 'var(--pf-v5-global--Color--100)',
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title={'Schedules \u2014 ' + providerName}
      isOpen={isOpen}
      onClose={onClose}
      actions={[<Button key="x" variant="link" onClick={onClose}>Close</Button>]}
    >
      {showForm ? (
        <Form>
          <Title headingLevel="h3" size="md" style={{ marginBottom: '1rem' }}>
            {editId ? 'Edit Schedule' : 'New Schedule'}
          </Title>
          <FormGroup label="Name" isRequired fieldId="sn">
            <TextInput id="sn" value={form.name}
              onChange={(_e, v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Nightly full refresh" />
          </FormGroup>
          <FormGroup label="Frequency" isRequired fieldId="sp">
            <select id="sp" value={form.preset} style={selStyle}
              onChange={(e) => setForm((f) => ({ ...f, preset: e.target.value }))}>
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </FormGroup>
          {form.preset === '__custom__' && (
            <FormGroup label="Cron expression" isRequired fieldId="sc"
              helperText="5-field: minute hour day month weekday. E.g. '0 */4 * * *' = every 4 h.">
              <TextInput id="sc" value={form.custom} placeholder="0 */6 * * *"
                onChange={(_e, v) => setForm((f) => ({ ...f, custom: v }))} />
            </FormGroup>
          )}
          <FormGroup fieldId="se">
            <Checkbox id="se" label="Enabled" isChecked={form.enabled}
              onChange={(_e, v) => setForm((f) => ({ ...f, enabled: v }))} />
          </FormGroup>
          {err && <Alert variant="danger" isInline title={err} />}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="primary" isLoading={saving} isDisabled={saving} onClick={save}>
              {editId ? 'Save Changes' : 'Add Schedule'}
            </Button>
            <Button variant="link" isDisabled={saving} onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Form>
      ) : (
        <>
          <Toolbar>
            <ToolbarContent>
              <ToolbarItem>
                <Button variant="primary" icon={<PlusCircleIcon />} onClick={startAdd}>Add Schedule</Button>
              </ToolbarItem>
              <ToolbarItem align={{ default: 'alignRight' }}>
                <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>
                  {rows.length} schedule{rows.length !== 1 ? 's' : ''}
                </span>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
          {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}><Spinner size="lg" /></div>
            : rows.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
                No schedules configured. Add one to automate collection.
              </div>
            ) : (
              <Table aria-label="Schedules" variant="compact">
                <Thead><Tr><Th>Name</Th><Th>Schedule</Th><Th>Last Run</Th><Th>Next Run</Th><Th>Enabled</Th><Th screenReaderText="Actions" /></Tr></Thead>
                <Tbody>{rows.map((s) => (
                    <Tr key={s.id}>
                      <Td dataLabel="Name"><strong>{s.name}</strong></Td>
                      <Td dataLabel="Schedule"><code title={s.cron_expression}>{cronLabel(s.cron_expression)}</code></Td>
                      <Td dataLabel="Last Run">{fmt(s.last_run_at)}</Td>
                      <Td dataLabel="Next Run">{fmt(s.next_run_at)}</Td>
                      <Td dataLabel="Enabled"><Switch id={'t-' + s.id} isChecked={s.enabled} onChange={() => toggle(s)} aria-label="toggle" /></Td>
                      <Td isActionCell>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <Button variant="plain" aria-label="Edit" onClick={() => startEdit(s)}><PencilAltIcon /></Button>
                          <Button variant="plain" aria-label="Delete"
                            isDisabled={busy.has(s.id)}
                            style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                            onClick={() => del(s.id)}>
                            {busy.has(s.id) ? <Spinner size="sm" /> : <TrashIcon />}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )
          }
        </>
      )}
    </Modal>
  );
}

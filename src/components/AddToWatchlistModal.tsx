import { useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, Form, FormGroup,
  Modal, ModalVariant, Spinner, TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { api } from '../api/client';
import type { Watchlist } from '../api/client';

interface Props {
  isOpen: boolean;
  resourceIds: string[];
  onClose: () => void;
  onDone?: () => void;
}

export function AddToWatchlistModal({ isOpen, resourceIds, onClose, onDone }: Props) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Inline create state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelected(new Set());
    setError('');
    setShowCreate(false);
    setNewName('');
    api.listWatchlists('page_size=100').then((r) => {
      setWatchlists(r.results);
    }).catch(() => {
      setWatchlists([]);
    }).finally(() => setLoading(false));
  }, [isOpen]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const wl = await api.createWatchlist({ name: newName.trim(), organization: 1 });
      setWatchlists((prev) => [wl, ...prev]);
      setSelected((prev) => new Set(prev).add(wl.id));
      setShowCreate(false);
      setNewName('');
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to create watchlist.');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError('');
    try {
      await Promise.all(
        Array.from(selected).map((wlId) => api.addToWatchlist(wlId, resourceIds))
      );
      onDone?.();
      onClose();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to add resources.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title="Add to Watchlist"
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button key="save" variant="primary" isDisabled={selected.size === 0 || saving} isLoading={saving} onClick={handleSave}>
          Add to {selected.size} watchlist{selected.size !== 1 ? 's' : ''}
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose}>Cancel</Button>,
      ]}
    >
      {error && <Alert variant="danger" isInline title={error} style={{ marginBottom: '1rem' }} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Create new */}
          {showCreate ? (
            <Form style={{ marginBottom: '1rem' }}>
              <FormGroup label="New watchlist name" fieldId="wl-new">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <TextInput id="wl-new" value={newName} onChange={(_e, v) => setNewName(v)} placeholder="e.g. Production VMs" autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }} />
                  <Button variant="primary" isDisabled={!newName.trim() || creating} isLoading={creating} onClick={handleCreate}>Create</Button>
                  <Button variant="plain" onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</Button>
                </div>
              </FormGroup>
            </Form>
          ) : (
            <Button variant="link" icon={<PlusCircleIcon />} style={{ marginBottom: '1rem' }} onClick={() => setShowCreate(true)}>
              Create new watchlist
            </Button>
          )}

          {/* Existing watchlists */}
          {watchlists.length === 0 && !showCreate ? (
            <p style={{ color: 'var(--pf-v5-global--Color--200)' }}>No watchlists yet. Create one above.</p>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {watchlists.map((wl) => (
                <div key={wl.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)' }}>
                  <Checkbox
                    id={'wl-' + wl.id}
                    label={
                      <span>
                        <strong>{wl.name}</strong>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>
                          {wl.resource_count} resource{wl.resource_count !== 1 ? 's' : ''}
                        </span>
                      </span>
                    }
                    isChecked={selected.has(wl.id)}
                    onChange={() => toggle(wl.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

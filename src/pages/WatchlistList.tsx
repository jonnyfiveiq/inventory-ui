import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Button, Bullseye, Form, FormGroup,
  Label, Modal, ModalVariant, PageSection, Spinner,
  TextInput, Title,
  Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
import { PlusCircleIcon, SyncAltIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api/client';
import type { Watchlist } from '../api/client';
import { usePolling } from '../hooks/usePolling';

export default function WatchlistList() {
  const navigate = useNavigate();
  const fetchWatchlists = useCallback(() => api.listWatchlists('page_size=100'), []);
  const { data, loading, refresh } = usePolling(fetchWatchlists, 30000);
  const watchlists: Watchlist[] = data?.results ?? [];

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete modal
  const [confirmDelete, setConfirmDelete] = useState<Watchlist | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [editWl, setEditWl] = useState<Watchlist | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const wl = await api.createWatchlist({ name: newName.trim(), description: newDesc.trim(), organization: 1 });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      refresh();
      navigate('/watchlists/' + wl.id);
    } catch (e: unknown) {
      setCreateError((e as { message?: string }).message ?? 'Failed to create watchlist.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.deleteWatchlist(confirmDelete.id);
      setConfirmDelete(null);
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editWl) return;
    setEditSaving(true);
    try {
      await api.updateWatchlist(editWl.id, { name: editName.trim(), description: editDesc.trim() });
      setEditWl(null);
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setEditSaving(false);
    }
  };

  const openEdit = (wl: Watchlist) => {
    setEditWl(wl);
    setEditName(wl.name);
    setEditDesc(wl.description);
  };

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">Watchlists</Title>
        <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
          Curated lists of resources you want to track together.
        </p>
      </PageSection>
      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowCreate(true)}>
                Create Watchlist
              </Button>
            </ToolbarItem>
            <ToolbarItem>
              <Button variant="plain" aria-label="Refresh" onClick={refresh}><SyncAltIcon /></Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>
                {watchlists.length} watchlist{watchlists.length !== 1 ? 's' : ''}
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {loading && !data ? (
          <Bullseye style={{ padding: '3rem' }}><Spinner size="xl" /></Bullseye>
        ) : watchlists.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
            No watchlists yet. <Button variant="link" isInline onClick={() => setShowCreate(true)}>Create one now</Button>
          </div>
        ) : (
          <Table aria-label="Watchlists" variant="compact">
            <Thead>
              <Tr>
                <Th width={30}>Name</Th>
                <Th width={30}>Description</Th>
                <Th width={10}>Type</Th>
                <Th width={10}>Resources</Th>
                <Th width={10}>Updated</Th>
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {watchlists.map((wl) => (
                <Tr key={wl.id} style={{ cursor: 'pointer' }} onRowClick={() => navigate('/watchlists/' + wl.id)}>
                  <Td dataLabel="Name"><strong>{wl.name}</strong></Td>
                  <Td dataLabel="Description">
                    <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
                      {wl.description || '\u2014'}
                    </span>
                  </Td>
                  <Td dataLabel="Type">
                    <Label isCompact color={wl.watchlist_type === 'dynamic' ? 'purple' : 'blue'}>
                      {wl.watchlist_type}
                    </Label>
                  </Td>
                  <Td dataLabel="Resources"><Badge isRead>{wl.resource_count}</Badge></Td>
                  <Td dataLabel="Updated" style={{ fontSize: '0.8rem' }}>
                    {new Date(wl.updated_at).toLocaleDateString()}
                  </Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}>
                    <ActionsColumn items={[
                      { title: 'Edit', onClick: () => openEdit(wl) },
                      { isSeparator: true },
                      { title: 'Delete', onClick: () => setConfirmDelete(wl) },
                    ]} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </PageSection>

      {/* Create modal */}
      <Modal
        variant={ModalVariant.small}
        title="Create Watchlist"
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setCreateError(''); }}
        actions={[
          <Button key="create" variant="primary" isDisabled={!newName.trim() || creating} isLoading={creating} onClick={handleCreate}>Create</Button>,
          <Button key="cancel" variant="link" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}>Cancel</Button>,
        ]}
      >
        {createError && <Alert variant="danger" isInline title={createError} style={{ marginBottom: '1rem' }} />}
        <Form>
          <FormGroup label="Name" isRequired fieldId="wl-name">
            <TextInput id="wl-name" value={newName} onChange={(_e, v) => setNewName(v)} placeholder="e.g. Production VMs" autoFocus />
          </FormGroup>
          <FormGroup label="Description" fieldId="wl-desc">
            <TextInput id="wl-desc" value={newDesc} onChange={(_e, v) => setNewDesc(v)} placeholder="Optional description" />
          </FormGroup>
        </Form>
      </Modal>

      {/* Delete modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete watchlist?"
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        actions={[
          <Button key="ok" variant="danger" isLoading={deleting} isDisabled={deleting} onClick={handleDelete}>Delete</Button>,
          <Button key="no" variant="link" onClick={() => setConfirmDelete(null)}>Cancel</Button>,
        ]}
      >
        {confirmDelete && <p>Delete <strong>{confirmDelete.name}</strong>? This will not delete the resources themselves.</p>}
      </Modal>

      {/* Edit modal */}
      <Modal
        variant={ModalVariant.small}
        title={'Edit: ' + (editWl?.name ?? '')}
        isOpen={!!editWl}
        onClose={() => setEditWl(null)}
        actions={[
          <Button key="save" variant="primary" isLoading={editSaving} isDisabled={!editName.trim() || editSaving} onClick={handleEditSave}>Save</Button>,
          <Button key="cancel" variant="link" onClick={() => setEditWl(null)}>Cancel</Button>,
        ]}
      >
        <Form>
          <FormGroup label="Name" isRequired fieldId="wl-edit-name">
            <TextInput id="wl-edit-name" value={editName} onChange={(_e, v) => setEditName(v)} />
          </FormGroup>
          <FormGroup label="Description" fieldId="wl-edit-desc">
            <TextInput id="wl-edit-desc" value={editDesc} onChange={(_e, v) => setEditDesc(v)} />
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}

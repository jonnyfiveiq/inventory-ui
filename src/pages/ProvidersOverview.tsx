import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Bullseye, Button, Checkbox, Form, FormGroup,
  Label, Modal, ModalVariant, PageSection,
  SearchInput, Spinner, TextInput, Title,
  Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
import {
  CalendarAltIcon, PlusCircleIcon, SyncAltIcon, UploadIcon,
} from '@patternfly/react-icons';
import { ActionsColumn, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api/client';
import type { Provider, ProviderPlugin, PaginatedResponse } from '../api/client';
import { SchedulesModal } from '../components/SchedulesModal';
import { ProviderGraphModal } from '../components/ProviderGraphModal';
import { usePolling } from '../hooks/usePolling';
import { vendorDisplayName, normalizeVendor } from '../utils/vendors';

const statusColor = (s: string | null) =>
  s === 'completed' ? 'green' as const
  : s === 'failed'  ? 'red'   as const
  : (s === 'running' || s === 'pending') ? 'blue' as const
  : 'grey' as const;

const vendorColor = (v: string): 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'grey' => {
  const map: Record<string, 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'grey'> = {
    vmware: 'blue', amazon: 'orange', aws: 'orange',
    google: 'green', gcp: 'green',
    azure: 'cyan', microsoft: 'cyan',
    redhat: 'purple', openstack: 'purple', openshift: 'purple',
  };
  return map[v.toLowerCase()] ?? 'grey';
};


interface AddState {
  step: 1 | 2;
  file: File | null;
  uploading: boolean;
  uploadError: string;
  uploadedPlugin: ProviderPlugin | null;
  name: string;
  endpoint: string;
  infrastructure: string;
  enabled: boolean;
  username: string;
  password: string;
  validateCerts: boolean;
  saving: boolean;
  saveError: string;
}

const defaultAddState = (): AddState => ({
  step: 1,
  file: null,
  uploading: false,
  uploadError: '',
  uploadedPlugin: null,
  name: '',
  endpoint: '',
  infrastructure: 'private_cloud',
  enabled: true,
  username: '',
  password: '',
  validateCerts: true,
  saving: false,
  saveError: '',
});

export default function ProvidersOverview() {
  const navigate = useNavigate();
  const fetchAll = useCallback(() => api.listProviders('page_size=200'), []);
  const { data, loading, refresh } = usePolling<PaginatedResponse<Provider>>(fetchAll, 15000);
  const providers = data?.results ?? [];

  const [schedulesFor, setSchedulesFor] = useState<Provider | null>(null);
  const [collecting, setCollecting] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [editProvider, setEditProvider] = useState<Provider | null>(null);
  const [editForm, setEditForm] = useState<Partial<Provider>>({});
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addState, setAddState] = useState<AddState>(defaultAddState());

  const [provSearch, setProvSearch] = useState('');

  const handleCollect = async (p: Provider) => {
    setCollecting((s) => new Set(s).add(p.id));
    try { await api.triggerCollection(p.id); }
    catch (e) { console.error(e); }
    finally {
      setCollecting((s) => { const n = new Set(s); n.delete(p.id); return n; });
      refresh();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id; setConfirmDelete(null);
    setDeleting((s) => new Set(s).add(id));
    try { await api.deleteProvider(id); refresh(); }
    catch (e) { console.error(e); }
    finally { setDeleting((s) => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const openEdit = (p: Provider) => {
    setEditProvider(p); setEditForm({ name: p.name, endpoint: p.endpoint, enabled: p.enabled });
  };
  const saveEdit = async () => {
    if (!editProvider) return; setEditSaving(true);
    try { await api.updateProvider(editProvider.id, editForm); setEditProvider(null); refresh(); }
    catch (e) { console.error(e); }
    finally { setEditSaving(false); }
  };


  // -- Add Provider: step 1 (upload plugin) --
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAddState((s) => ({ ...s, file, uploadError: '', uploadedPlugin: null }));
  };

  const handleUpload = async (force = false) => {
    if (!addState.file) return;
    setAddState((s) => ({ ...s, uploading: true, uploadError: '' }));
    try {
      const result = await api.uploadPlugin(addState.file, force);
      setAddState((s) => ({
        ...s, uploading: false, uploadedPlugin: result.plugin,
        name: result.plugin.name ?? '', step: 2,
      }));
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { detail?: string }; message?: string };
      setAddState((s) => ({
        ...s, uploading: false,
        uploadError: e.data?.detail ?? e.message ?? 'Upload failed.',
      }));
    }
  };

  // -- Add Provider: step 2 (create provider) --
  const handleCreateProvider = async () => {
    if (!addState.uploadedPlugin) return;
    setAddState((s) => ({ ...s, saving: true, saveError: '' }));
    try {
      await api.createProvider({
        name: addState.name,
        vendor: addState.uploadedPlugin.vendor,
        provider_type: addState.uploadedPlugin.provider_type,
        infrastructure: addState.infrastructure,
        endpoint: addState.endpoint,
        enabled: addState.enabled,
        organization: 1,
        connection_config: addState.username
          ? { username: addState.username, password: addState.password, validate_certs: addState.validateCerts }
          : {},
      });
      setShowAdd(false);
      setAddState(defaultAddState());
      refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setAddState((s) => ({ ...s, saving: false, saveError: e.message ?? 'Failed to create provider.' }));
    }
  };

  const closeAdd = () => { setShowAdd(false); setAddState(defaultAddState()); };

  const rowActions = (p: Provider) => [
    { title: collecting.has(p.id) ? 'Collecting...' : 'Collect Now', isDisabled: !p.enabled || collecting.has(p.id), onClick: () => handleCollect(p) },
    { title: 'Edit', onClick: () => openEdit(p) },
    { title: 'Schedules', onClick: () => setSchedulesFor(p) },
    { isSeparator: true },
    { title: 'Delete', onClick: () => setConfirmDelete(p) },
  ];

  const filtered = providers.filter((p) => {
    if (!provSearch.trim()) return true;
    const q = provSearch.toLowerCase();
    const searchable = [p.name, p.vendor, p.provider_type, p.endpoint, p.enabled ? 'enabled' : 'disabled', p.last_collection_status, p.infrastructure].filter(Boolean);
    return searchable.some((s) => s.toLowerCase().includes(q));
  });

  const vendorCounts = providers.reduce<Record<string, number>>((acc, p) => {
    const k = normalizeVendor(p.vendor); acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});

  return (
    <>
      <PageSection variant="light" style={{ paddingBottom: '0.75rem' }}>
        <Title headingLevel="h1" size="2xl">Providers</Title>
        <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
          All configured providers across vendors
        </p>
        {Object.keys(vendorCounts).length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]).map(([v, count]) => (
              <Label key={v} color={vendorColor(v)} isCompact
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/inventory/vendors/' + v)}>
                {vendorDisplayName(v)} ({count})
              </Label>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem><Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowAdd(true)}>Add Provider</Button></ToolbarItem>
            <ToolbarItem><Button variant="plain" aria-label="Refresh" onClick={refresh}><SyncAltIcon /></Button></ToolbarItem>
            <ToolbarItem style={{ flex: 1 }}>
              <SearchInput
                placeholder="Filter providers… (name, vendor, endpoint, status)"
                value={provSearch}
                onChange={(_e, v) => setProvSearch(v)}
                onClear={() => setProvSearch('')}
                aria-label="Filter providers"
                style={{ maxWidth: '500px' }}
              />
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>
                {provSearch ? `${filtered.length} of ${providers.length}` : `${providers.length}`} provider{filtered.length !== 1 ? 's' : ''}
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {loading && !data ? (
          <Bullseye style={{ padding: '3rem' }}><Spinner size="xl" /></Bullseye>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
            {provSearch ? 'No providers match that filter.' : 'No providers configured yet.'}
          </div>
        ) : (
          <Table aria-label="All providers" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Vendor</Th>
                <Th>Resources</Th>
                <Th>Status</Th>
                <Th>Last Collection</Th>
                <Th>Schedules</Th>
                <Th screenReaderText="Graph" />
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((p) => (
                <Tr key={p.id} style={{ cursor: 'pointer' }}
                    onRowClick={() => navigate('/inventory/vendors/' + p.vendor.toLowerCase())}>
                  <Td dataLabel="Name"><strong>{p.name}</strong></Td>
                  <Td dataLabel="Vendor">
                    <Label isCompact color={vendorColor(p.vendor)}>{vendorDisplayName(p.vendor)}</Label>
                  </Td>
                  <Td dataLabel="Resources">{p.resource_count ?? 0}</Td>
                  <Td dataLabel="Status">
                    <Label isCompact color={p.enabled ? 'green' : 'grey'}>{p.enabled ? 'Enabled' : 'Disabled'}</Label>
                  </Td>
                  <Td dataLabel="Last Collection">
                    {p.last_collection_status
                      ? <Label isCompact color={statusColor(p.last_collection_status)}>{p.last_collection_status}</Label>
                      : <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>Never</span>}
                  </Td>
                  <Td dataLabel="Schedules">
                    {(p.schedule_count ?? 0) > 0
                      ? <Label isCompact color="blue" icon={<CalendarAltIcon />}>{p.schedule_count} schedule{p.schedule_count !== 1 ? 's' : ''}</Label>
                      : <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>None</span>}
                  </Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}>
                    <ProviderGraphModal providerId={p.id} providerName={p.name} />
                  </Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}>
                    <ActionsColumn items={rowActions(p)} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </PageSection>

      {schedulesFor && (
        <SchedulesModal providerId={schedulesFor.id} providerName={schedulesFor.name}
          isOpen onClose={() => { setSchedulesFor(null); refresh(); }} />
      )}

      <Modal variant={ModalVariant.small} title="Delete provider?" isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        actions={[
          <Button key="ok" variant="danger" onClick={handleDeleteConfirm}>Delete</Button>,
          <Button key="no" variant="link" onClick={() => setConfirmDelete(null)}>Cancel</Button>,
        ]}>
        {confirmDelete && <p>Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>}
      </Modal>

      <Modal variant={ModalVariant.medium} title={'Edit: ' + (editProvider?.name ?? '')}
        isOpen={!!editProvider} onClose={() => setEditProvider(null)}
        actions={[
          <Button key="s" variant="primary" isLoading={editSaving} isDisabled={editSaving} onClick={saveEdit}>Save</Button>,
          <Button key="c" variant="link" isDisabled={editSaving} onClick={() => setEditProvider(null)}>Cancel</Button>,
        ]}>
        <Form>
          <FormGroup label="Name" isRequired fieldId="en">
            <TextInput id="en" value={editForm.name ?? ''} onChange={(_e, v) => setEditForm((f) => ({ ...f, name: v }))} />
          </FormGroup>
          <FormGroup label="Endpoint" isRequired fieldId="ee">
            <TextInput id="ee" value={editForm.endpoint ?? ''} onChange={(_e, v) => setEditForm((f) => ({ ...f, endpoint: v }))} />
          </FormGroup>
          <FormGroup fieldId="enabled">
            <Checkbox id="enabled" label="Enabled" isChecked={editForm.enabled ?? true}
              onChange={(_e, v) => setEditForm((f) => ({ ...f, enabled: v }))} />
          </FormGroup>
        </Form>
      </Modal>

      {/* Add Provider modal - Step 1: Upload Plugin */}
      <Modal variant={ModalVariant.medium} title="Add Provider — Step 1: Upload Plugin"
        isOpen={showAdd && addState.step === 1} onClose={closeAdd}
        actions={[
          <Button key="upload" variant="primary" icon={<UploadIcon />}
            isLoading={addState.uploading} isDisabled={!addState.file || addState.uploading}
            onClick={() => handleUpload(false)}>Upload Plugin</Button>,
          <Button key="cancel" variant="link" onClick={closeAdd}>Cancel</Button>,
        ]}>
        <Form>
          <p style={{ marginBottom: '1rem' }}>
            Select a provider plugin archive (<code>.tar.gz</code>, <code>.tgz</code>, or <code>.zip</code>).
          </p>
          <FormGroup label="Plugin archive" isRequired fieldId="plugin-file">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}
                isDisabled={addState.uploading}>Browse...</Button>
              <span style={{ color: addState.file ? 'inherit' : 'var(--pf-v5-global--Color--200)' }}>
                {addState.file ? addState.file.name : 'No file selected'}
              </span>
              <input ref={fileInputRef} type="file"
                accept="application/gzip,application/x-gzip,application/x-tar,application/zip,.zip,.tgz,.tar.gz,.tar"
                style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          </FormGroup>
          {addState.uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Spinner size="md" /> <span>Uploading and installing plugin...</span>
            </div>
          )}
          {addState.uploadError && (
            <Alert variant="danger" isInline title={addState.uploadError}
              actionLinks={addState.uploadError.includes('already installed')
                ? <Button variant="link" isInline onClick={() => handleUpload(true)}>Overwrite existing plugin</Button>
                : undefined} />
          )}
        </Form>
      </Modal>

      {/* Add Provider modal - Step 2: Configure */}
      <Modal variant={ModalVariant.medium} title="Add Provider — Step 2: Configure"
        isOpen={showAdd && addState.step === 2} onClose={closeAdd}
        actions={[
          <Button key="back" variant="secondary"
            onClick={() => setAddState((s) => ({ ...s, step: 1 }))}
            isDisabled={addState.saving}>Back</Button>,
          <Button key="create" variant="primary" isLoading={addState.saving}
            isDisabled={!addState.name || !addState.endpoint || addState.saving}
            onClick={handleCreateProvider}>Create Provider</Button>,
          <Button key="cancel" variant="link" onClick={closeAdd}>Cancel</Button>,
        ]}>
        <Form>
          {addState.uploadedPlugin && (
            <Alert variant="success" isInline style={{ marginBottom: '1rem' }}
              title={`Plugin installed: ${addState.uploadedPlugin.vendor} / ${addState.uploadedPlugin.provider_type} v${addState.uploadedPlugin.version}`} />
          )}
          <FormGroup label="Name" isRequired fieldId="add-name">
            <TextInput id="add-name" value={addState.name}
              onChange={(_e, v) => setAddState((s) => ({ ...s, name: v }))}
              placeholder="e.g. Production vCenter" />
          </FormGroup>
          <FormGroup label="Endpoint" isRequired fieldId="add-endpoint">
            <TextInput id="add-endpoint" value={addState.endpoint}
              onChange={(_e, v) => setAddState((s) => ({ ...s, endpoint: v }))}
              placeholder="e.g. https://vcenter.example.com" />
          </FormGroup>
          <FormGroup label="Infrastructure" isRequired fieldId="add-infra">
            <select id="add-infra" value={addState.infrastructure}
              onChange={(e) => setAddState((s) => ({ ...s, infrastructure: e.target.value }))}
              style={{ width: '100%', height: '36px', padding: '0 8px',
                border: '1px solid var(--pf-v5-global--BorderColor--100)',
                borderRadius: '3px', background: 'var(--pf-v5-global--BackgroundColor--100)',
                color: 'var(--pf-v5-global--Color--100)' }}>
              <option value="private_cloud">Private Cloud</option>
              <option value="public_cloud">Public Cloud</option>
              <option value="on_premise">On Premise</option>
              <option value="networking">Networking</option>
              <option value="storage">Storage</option>
            </select>
          </FormGroup>
          <FormGroup label="Username" fieldId="add-username">
            <TextInput id="add-username" value={addState.username}
              onChange={(_e, v) => setAddState((s) => ({ ...s, username: v }))}
              placeholder="admin" />
          </FormGroup>
          <FormGroup label="Password" fieldId="add-password">
            <TextInput id="add-password" type="password" value={addState.password}
              onChange={(_e, v) => setAddState((s) => ({ ...s, password: v }))} />
          </FormGroup>
          <FormGroup fieldId="add-enabled">
            <Checkbox id="add-enabled" label="Enable this provider"
              isChecked={addState.enabled}
              onChange={(_e, checked) => setAddState((s) => ({ ...s, enabled: checked }))} />
          </FormGroup>
          <FormGroup fieldId="add-verify-ssl">
            <Checkbox id="add-verify-ssl" label="Verify SSL certificate"
              isChecked={addState.validateCerts}
              onChange={(_e, checked) => setAddState((s) => ({ ...s, validateCerts: checked }))}
              description="Disable for self-signed certificates" />
          </FormGroup>
          {addState.saveError && <Alert variant="danger" isInline title={addState.saveError} />}
        </Form>
      </Modal>
    </>
  );
}

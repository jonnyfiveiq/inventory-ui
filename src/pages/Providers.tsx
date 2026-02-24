import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Bullseye,
  Checkbox,
  Form,
  FormGroup,
  Label,
  Modal,
  ModalVariant,
  PageSection,
  Spinner,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { PlusCircleIcon, SyncAltIcon, UploadIcon } from '@patternfly/react-icons';
import {
  ActionsColumn,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
} from '@patternfly/react-table';
import { api } from '../api/client';
import { ProviderGraphModal } from '../components/ProviderGraphModal';
import type { Provider, ProviderPlugin, PaginatedResponse } from '../api/client';
import { usePolling } from '../hooks/usePolling';

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
  validate_certs: boolean;
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
  validate_certs: true,
  saving: false,
  saveError: '',
});

export default function ProvidersPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collecting, setCollecting] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);
  const [editProvider, setEditProvider] = useState<Provider | null>(null);
  const [editForm, setEditForm] = useState<Partial<Provider>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addState, setAddState] = useState<AddState>(defaultAddState());

  const fetchProviders = useCallback(() => api.listProviders(), []);
  const { data, loading, refresh } = usePolling<PaginatedResponse<Provider>>(fetchProviders, 10000);
  const providers = data?.results ?? [];

  // ?? Collect ??

  const handleCollect = async (providerId: string) => {
    setCollecting((prev) => new Set(prev).add(providerId));
    try {
      const run = await api.triggerCollection(providerId);
      navigate('/collection-runs/' + run.id);
    } catch (e) {
      console.error('Failed to trigger collection:', e);
    } finally {
      setCollecting((prev) => { const n = new Set(prev); n.delete(providerId); return n; });
    }
  };

  // ?? Delete ??

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await api.deleteProvider(id);
      refresh();
    } catch (e) {
      console.error('Failed to delete provider:', e);
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  // ?? Edit ??

  const openEdit = (p: Provider) => {
    setEditProvider(p);
    setEditForm({ name: p.name, endpoint: p.endpoint, enabled: p.enabled });
  };

  const handleEditSave = async () => {
    if (!editProvider) return;
    setSaving(true);
    try {
      await api.updateProvider(editProvider.id, editForm);
      setEditProvider(null);
      refresh();
    } catch (e) {
      console.error('Failed to update provider:', e);
    } finally {
      setSaving(false);
    }
  };

  // ?? Add: step 1 Ñ upload plugin ??

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
        ...s,
        uploading: false,
        uploadedPlugin: result.plugin,
        name: result.plugin.name ?? '',
        step: 2,
      }));
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { detail?: string }; message?: string };
      setAddState((s) => ({
        ...s,
        uploading: false,
        uploadError: e.data?.detail ?? e.message ?? 'Upload failed.',
      }));
    }
  };

  // ?? Add: step 2 Ñ create provider ??

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
          ? { username: addState.username, password: addState.password, validate_certs: addState.validate_certs }
          : { validate_certs: addState.validate_certs },
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

  // ?? Row actions ??

  const rowActions = (p: Provider) => [
    {
      title: collecting.has(p.id) ? 'Collecting...' : 'Collect Now',
      isDisabled: !p.enabled || collecting.has(p.id),
      onClick: () => handleCollect(p.id),
    },
    { title: 'Edit', onClick: () => openEdit(p) },
    { isSeparator: true },
    {
      title: <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>Delete</span>,
      isDisabled: deleting.has(p.id),
      onClick: () => setConfirmDelete(p),
    },
  ];

  const statusColor = (status: string | null) => {
    if (status === 'completed') return 'green' as const;
    if (status === 'failed') return 'red' as const;
    if (status === 'running' || status === 'pending') return 'blue' as const;
    return 'grey' as const;
  };

  // ?? Render ??

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">Providers</Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Infrastructure providers configured for inventory collection.
        </p>
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowAdd(true)}>
                Add Provider
              </Button>
            </ToolbarItem>
            <ToolbarItem>
              <Button variant="plain" onClick={refresh} aria-label="Refresh">
                <SyncAltIcon /> Refresh
              </Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>{data?.count ?? 0} providers</span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {loading && !data ? (
          <Bullseye><Spinner size="xl" /></Bullseye>
        ) : (
          <Table aria-label="Providers" variant="compact">
            <Thead>
              <Tr>
                <Th width={25}>Name</Th>
                <Th width={10}>Vendor</Th>
                <Th width={10}>Type</Th>
                <Th width={20}>Endpoint</Th>
                <Th width={10}>Enabled</Th>
                <Th width={15}>Last Collection</Th>
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {providers.map((p) => (
                <Tr key={p.id}>
                  <Td dataLabel="Name"><strong>{p.name}</strong></Td>
                  <Td dataLabel="Vendor">{p.vendor}</Td>
                  <Td dataLabel="Type">{p.provider_type}</Td>
                  <Td dataLabel="Endpoint"><code>{p.endpoint}</code></Td>
                  <Td dataLabel="Enabled">
                    <Label color={p.enabled ? 'green' : 'grey'}>{p.enabled ? 'Yes' : 'No'}</Label>
                  </Td>
                  <Td dataLabel="Last Collection">
                    {p.last_collection_status
                      ? <Label color={statusColor(p.last_collection_status)}>{p.last_collection_status}</Label>
                      : '-'}
                  </Td>
                  <Td isActionCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ProviderGraphModal providerId={p.id} providerName={p.name} />
                      <ActionsColumn items={rowActions(p)} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </PageSection>

      {/* ?? Add Provider modal (step 1: upload) ?? */}
      <Modal
        variant={ModalVariant.medium}
        title="Add Provider Ñ Step 1: Upload Plugin"
        isOpen={showAdd && addState.step === 1}
        onClose={closeAdd}
        actions={[
          <Button
            key="upload"
            variant="primary"
            icon={<UploadIcon />}
            isLoading={addState.uploading}
            isDisabled={!addState.file || addState.uploading}
            onClick={() => handleUpload(false)}
          >
            Upload Plugin
          </Button>,
          <Button key="cancel" variant="link" onClick={closeAdd}>Cancel</Button>,
        ]}
      >
        <Form>
          <p style={{ marginBottom: '1rem' }}>
            Select a provider plugin archive (<code>.tar.gz</code>, <code>.tgz</code>, or <code>.zip</code>).
            The plugin will be installed into the inventory service before you configure the provider.
          </p>
          <FormGroup label="Plugin archive" isRequired fieldId="plugin-file">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                isDisabled={addState.uploading}
              >
                Browse...
              </Button>
              <span style={{ color: addState.file ? 'inherit' : 'var(--pf-v5-global--Color--200)' }}>
                {addState.file ? addState.file.name : 'No file selected'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/gzip,application/x-gzip,application/x-tar,application/zip,application/x-zip-compressed,.zip,.tgz,.tar.gz,.tar"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </FormGroup>
          {addState.uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Spinner size="md" /> <span>Uploading and installing plugin...</span>
            </div>
          )}
          {addState.uploadError && (
            <Alert
              variant="danger"
              isInline
              title={addState.uploadError}
              actionLinks={
                addState.uploadError.includes('already installed') ? (
                  <Button variant="link" isInline onClick={() => handleUpload(true)}>
                    Overwrite existing plugin
                  </Button>
                ) : undefined
              }
            />
          )}
        </Form>
      </Modal>

      {/* ?? Add Provider modal (step 2: configure) ?? */}
      <Modal
        variant={ModalVariant.medium}
        title="Add Provider Ñ Step 2: Configure"
        isOpen={showAdd && addState.step === 2}
        onClose={closeAdd}
        actions={[
          <Button
            key="back"
            variant="secondary"
            onClick={() => setAddState((s) => ({ ...s, step: 1 }))}
            isDisabled={addState.saving}
          >
            Back
          </Button>,
          <Button
            key="create"
            variant="primary"
            isLoading={addState.saving}
            isDisabled={!addState.name || !addState.endpoint || addState.saving}
            onClick={handleCreateProvider}
          >
            Create Provider
          </Button>,
          <Button key="cancel" variant="link" onClick={closeAdd}>Cancel</Button>,
        ]}
      >
        <Form>
          {addState.uploadedPlugin && (
            <Alert
              variant="success"
              isInline
              style={{ marginBottom: '1rem' }}
              title={`Plugin installed: ${addState.uploadedPlugin.vendor} / ${addState.uploadedPlugin.provider_type} v${addState.uploadedPlugin.version}`}
            />
          )}
          <FormGroup label="Name" isRequired fieldId="add-name">
            <TextInput
              id="add-name"
              value={addState.name}
              onChange={(_e, v) => setAddState((s) => ({ ...s, name: v }))}
              placeholder="e.g. Production vCenter"
            />
          </FormGroup>
          <FormGroup label="Endpoint" isRequired fieldId="add-endpoint">
            <TextInput
              id="add-endpoint"
              value={addState.endpoint}
              onChange={(_e, v) => setAddState((s) => ({ ...s, endpoint: v }))}
              placeholder="e.g. https://vcenter.example.com"
            />
          </FormGroup>
          <FormGroup label="Infrastructure" isRequired fieldId="add-infrastructure">
            <select
              id="add-infrastructure"
              value={addState.infrastructure}
              onChange={(e) => setAddState((s) => ({ ...s, infrastructure: e.target.value }))}
              style={{ width: '100%', height: '36px', padding: '0 8px', border: '1px solid var(--pf-v5-global--BorderColor--100)', borderRadius: '3px', background: 'var(--pf-v5-global--BackgroundColor--100)', color: 'var(--pf-v5-global--Color--100)' }}
            >
              <option value="private_cloud">Private Cloud</option>
              <option value="public_cloud">Public Cloud</option>
              <option value="on_premise">On Premise</option>
              <option value="networking">Networking</option>
              <option value="storage">Storage</option>
            </select>
          </FormGroup>
          <FormGroup label="Username" fieldId="add-username">
            <TextInput
              id="add-username"
              value={addState.username}
              onChange={(_e, v) => setAddState((s) => ({ ...s, username: v }))}
              placeholder="admin"
            />
          </FormGroup>
          <FormGroup label="Password" fieldId="add-password">
            <TextInput
              id="add-password"
              type="password"
              value={addState.password}
              onChange={(_e, v) => setAddState((s) => ({ ...s, password: v }))}
            />
          </FormGroup>
          <FormGroup fieldId="add-validate-certs">
            <Checkbox
              id="add-validate-certs"
              label="Verify SSL certificate (validate_certs)"
              isChecked={addState.validate_certs}
              onChange={(_e, checked) => setAddState((s) => ({ ...s, validate_certs: checked }))}
            />
          </FormGroup>
          <FormGroup fieldId="add-enabled">
            <Checkbox
              id="add-enabled"
              label="Enable this provider"
              isChecked={addState.enabled}
              onChange={(_e, checked) => setAddState((s) => ({ ...s, enabled: checked }))}
            />
          </FormGroup>
          {addState.saveError && (
            <Alert variant="danger" isInline title={addState.saveError} />
          )}
        </Form>
      </Modal>

      {/* ?? Delete confirmation ?? */}
      <Modal
        variant={ModalVariant.small}
        title="Delete provider?"
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        actions={[
          <Button key="confirm" variant="danger" onClick={handleDeleteConfirm}>Delete</Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDelete(null)}>Cancel</Button>,
        ]}
      >
        {confirmDelete && (
          <p>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>
        )}
      </Modal>

      {/* ?? Edit modal ?? */}
      <Modal
        variant={ModalVariant.medium}
        title={`Edit provider: ${editProvider?.name ?? ''}`}
        isOpen={!!editProvider}
        onClose={() => setEditProvider(null)}
        actions={[
          <Button key="save" variant="primary" isLoading={saving} isDisabled={saving} onClick={handleEditSave}>Save</Button>,
          <Button key="cancel" variant="link" isDisabled={saving} onClick={() => setEditProvider(null)}>Cancel</Button>,
        ]}
      >
        <Form>
          <FormGroup label="Name" isRequired fieldId="edit-name">
            <TextInput
              id="edit-name"
              value={editForm.name ?? ''}
              onChange={(_e, v) => setEditForm((f) => ({ ...f, name: v }))}
            />
          </FormGroup>
          <FormGroup label="Endpoint" isRequired fieldId="edit-endpoint">
            <TextInput
              id="edit-endpoint"
              value={editForm.endpoint ?? ''}
              onChange={(_e, v) => setEditForm((f) => ({ ...f, endpoint: v }))}
            />
          </FormGroup>
          <FormGroup fieldId="edit-enabled">
            <Checkbox
              id="edit-enabled"
              label="Enabled"
              isChecked={editForm.enabled ?? true}
              onChange={(_e, checked) => setEditForm((f) => ({ ...f, enabled: checked }))}
            />
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}

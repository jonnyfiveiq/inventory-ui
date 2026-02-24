import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Badge, Breadcrumb, BreadcrumbItem,
  Bullseye, Button, Checkbox, Form, FormGroup,
  Label, Modal, ModalVariant, PageSection,
  Spinner, TextInput, Title,
  Toolbar, ToolbarContent, ToolbarItem,
  ToggleGroup, ToggleGroupItem,
} from '@patternfly/react-core';
import {
  CalendarAltIcon, PlusCircleIcon, SyncAltIcon, TopologyIcon,
} from '@patternfly/react-icons';
import { ActionsColumn, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api/client';
import type { Provider, Resource, ProviderPlugin, PaginatedResponse } from '../api/client';
import { SchedulesModal } from '../components/SchedulesModal';
import { ProviderGraphModal } from '../components/ProviderGraphModal';
import { ResourceTagEditor } from '../components/ResourceTagEditor';
import { usePolling } from '../hooks/usePolling';

import { vendorDisplayName, vendorAliases, normalizeVendor } from '../utils/vendors';

export { vendorDisplayName };

const statusColor = (s: string | null) =>
  s === 'completed' ? 'green' as const
  : s === 'failed'  ? 'red'   as const
  : (s === 'running' || s === 'pending') ? 'blue' as const
  : 'grey' as const;

interface AddState {
  step: 1 | 2;
  file: File | null; uploading: boolean; uploadError: string; uploadedPlugin: ProviderPlugin | null;
  name: string; endpoint: string; infrastructure: string; enabled: boolean;
  username: string; password: string; saving: boolean; saveError: string;
}
const blankAdd = (): AddState => ({
  step: 1, file: null, uploading: false, uploadError: '', uploadedPlugin: null,
  name: '', endpoint: '', infrastructure: 'private_cloud', enabled: true,
  username: '', password: '', validateCerts: true, saving: false, saveError: '',
});

type ViewMode = 'providers' | 'resources';

export default function VendorPage() {
  const { vendor } = useParams<{ vendor: string }>();
  const vendorName = vendorDisplayName(vendor ?? '');

  const [view, setView]               = useState<ViewMode>('providers');
  const [drillProvider, setDrillProvider] = useState<Provider | null>(null);
  const [tagEditorResource, setTagEditorResource] = useState<Resource | null>(null);
  const [schedulesFor, setSchedulesFor] = useState<Provider | null>(null);

  useEffect(() => { setView('providers'); setDrillProvider(null); }, [vendor]);

  const fetchProviders = useCallback(
    () => api.listProviders('page_size=200'),
    [],
  );
  const { data: provData, loading: provLoading, refresh: refreshProv } =
    usePolling<PaginatedResponse<Provider>>(fetchProviders, 15000);
  const aliases = vendorAliases(vendor ?? '');
  const providers = (provData?.results ?? []).filter(
    (p) => aliases.includes(p.vendor.toLowerCase())
  );

  const [resources, setResources] = useState<Resource[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError]     = useState('');

  const loadResources = useCallback(async (provId?: string) => {
    setResLoading(true); setResError('');
    try {
      const params = provId ? 'provider=' + provId + '&page_size=500' : 'page_size=500';
      const all = await api.listResources(params);
      if (!provId) {
        const ids = new Set(providers.map((p) => p.id));
        setResources(all.results.filter((r) => ids.has(r.provider)));
      } else {
        setResources(all.results);
      }
    } catch (e: unknown) {
      setResError((e as { message?: string }).message ?? 'Failed to load resources.');
    } finally { setResLoading(false); }
  }, [providers]);

  useEffect(() => {
    if (view === 'resources') loadResources(drillProvider?.id);
  }, [view, drillProvider, vendor]);

  const [collecting,setCollecting] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);
  const [deleting, setDeleting]           = useState<Set<string>>(new Set());
  const [editProvider, setEditProvider]   = useState<Provider | null>(null);
  const [editForm, setEditForm]           = useState<Partial<Provider>>({});
  const [editSaving, setEditSaving]       = useState(false);
  const [showAdd, setShowAdd]             = useState(false);
  const [addState, setAddState]           = useState<AddState>(blankAdd());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCollect = async (p: Provider) => {
    setCollecting((s) => new Set(s).add(p.id));
    try { await api.triggerCollection(p.id); }
    catch (e) { console.error(e); }
    finally {
      setCollecting((s) => { const n = new Set(s); n.delete(p.id); return n; });
      refreshProv();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id; setConfirmDelete(null);
    setDeleting((s) => new Set(s).add(id));
    try { await api.deleteProvider(id); refreshProv(); }
    catch (e) { console.error(e); }
    finally { setDeleting((s) => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const openEdit = (p: Provider) => {
    setEditProvider(p); setEditForm({ name: p.name, endpoint: p.endpoint, enabled: p.enabled });
  };
  const saveEdit = async () => {
    if (!editProvider) return; setEditSaving(true);
    try { await api.updateProvider(editProvider.id, editForm); setEditProvider(null); refreshProv(); }
    catch (e) { console.error(e); }
    finally { setEditSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAddState((s) => ({ ...s, file, uploadError: '', uploadedPlugin: null }));
  };
  const handleUpload = async (force = false) => {
    if (!addState.file) return;
    setAddState((s) => ({ ...s, uploading: true, uploadError: '' }));
    try {
      const r = await api.uploadPlugin(addState.file, force);
      setAddState((s) => ({ ...s, uploading: false, uploadedPlugin: r.plugin, name: r.plugin.name ?? '', step: 2 }));
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string }; message?: string };
      setAddState((s) => ({ ...s, uploading: false, uploadError: e.data?.detail ?? e.message ?? 'Upload failed.' }));
    }
  };
  const handleCreate = async () => {
    if (!addState.uploadedPlugin) return;
    setAddState((s) => ({ ...s, saving: true, saveError: '' }));
    try {
      await api.createProvider({
        name: addState.name, vendor: addState.uploadedPlugin.vendor,
        provider_type: addState.uploadedPlugin.provider_type,
        infrastructure: addState.infrastructure, endpoint: addState.endpoint,
        enabled: addState.enabled, organization: 1,
        connection_config: addState.username ? { username: addState.username, password: addState.password, validate_certs: addState.validateCerts } : { validate_certs: addState.validateCerts },
      });
      setShowAdd(false); setAddState(blankAdd()); refreshProv();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setAddState((s) => ({ ...s, saving: false, saveError: e.message ?? 'Failed to create provider.' }));
    }
  };

  const rowActions = (p: Provider) => [
    { title: collecting.has(p.id) ? 'Collecting...' : 'Collect Now', isDisabled: !p.enabled || collecting.has(p.id), onClick: () => handleCollect(p) },
    { title: 'Edit', onClick: () => openEdit(p) },
    { title: (<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CalendarAltIcon />Schedules{(p.schedule_count ?? 0) > 0 && <Badge isRead style={{ marginLeft: '0.25rem' }}>{p.schedule_count}</Badge>}</span>), onClick: () => setSchedulesFor(p) },
    { isSeparator: true },
    { title: <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>Delete</span>, isDisabled: deleting.has(p.id), onClick: () => setConfirmDelete(p) },
  ];

  const selStyle: React.CSSProperties = {
    width: '100%', height: '36px', padding: '0 8px',
    border: '1px solid var(--pf-v5-global--BorderColor--100)',
    borderRadius: '3px', background: 'var(--pf-v5-global--BackgroundColor--100)',
    color: 'var(--pf-v5-global--Color--100)',
  };

  const breadcrumb = drillProvider ? (
    <Breadcrumb style={{ marginBottom: '0.5rem' }}>
      <BreadcrumbItem style={{ cursor: 'pointer' }} onClick={() => { setDrillProvider(null); setView('providers'); }}>{vendorName}</BreadcrumbItem>
      <BreadcrumbItem isActive>{drillProvider.name}</BreadcrumbItem>
    </Breadcrumb>
  ) : null;

  const ProvidersTable = (
    <>
      <Toolbar><ToolbarContent>
        <ToolbarItem><Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setShowAdd(true)}>Add Provider</Button></ToolbarItem>
        <ToolbarItem><Button variant="plain" aria-label="Refresh" onClick={refreshProv}><SyncAltIcon /></Button></ToolbarItem>
        <ToolbarItem align={{ default: 'alignRight' }}>
          <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>{providers.length} provider{providers.length !== 1 ? 's' : ''}</span>
        </ToolbarItem>
      </ToolbarContent></Toolbar>
      {provLoading && !provData ? <Bullseye style={{ padding: '3rem' }}><Spinner size="xl" /></Bullseye>
        : providers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>No {vendorName} providers configured. <Button variant="link" isInline onClick={() => setShowAdd(true)}>Add one now</Button></div>
        ) : (
          <Table aria-label={vendorName + ' providers'} variant="compact">
            <Thead><Tr><Th>Name</Th><Th>Endpoint</Th><Th>Status</Th><Th>Last Collection</Th><Th>Schedules</Th><Th screenReaderText="Graph" /><Th screenReaderText="Actions" /></Tr></Thead>
            <Tbody>
              {providers.map((p) => (
                <Tr key={p.id} style={{ cursor: 'pointer' }} onRowClick={() => { setDrillProvider(p); setView('resources'); }}>
                  <Td dataLabel="Name"><strong>{p.name}</strong></Td>
                  <Td dataLabel="Endpoint"><code style={{ fontSize: '0.8rem' }}>{p.endpoint}</code></Td>
                  <Td dataLabel="Status"><Label isCompact color={p.enabled ? 'green' : 'grey'}>{p.enabled ? 'Enabled' : 'Disabled'}</Label></Td>
                  <Td dataLabel="Last Collection">{p.last_collection_status ? <Label isCompact color={statusColor(p.last_collection_status)}>{p.last_collection_status}</Label> : <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>Never</span>}</Td>
                  <Td dataLabel="Schedules">{(p.schedule_count ?? 0) > 0 ? <Label isCompact color="blue" icon={<CalendarAltIcon />}>{p.schedule_count} schedule{p.schedule_count !== 1 ? 's' : ''}</Label> : <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>None</span>}</Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}><ProviderGraphModal providerId={p.id} providerName={p.name} /></Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}><ActionsColumn items={rowActions(p)} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
    </>
  );

  const ResourcesTable = (
    <>
      <Toolbar><ToolbarContent>
        {drillProvider && (
          <ToolbarItem>
            <Button
              variant="primary"
              icon={<SyncAltIcon />}
              isLoading={collecting.has(drillProvider.id)}
              isDisabled={!drillProvider.enabled || collecting.has(drillProvider.id)}
              onClick={() => handleCollect(drillProvider)}
            >
              {collecting.has(drillProvider.id) ? 'Collecting...' : 'Collect Now'}
            </Button>
          </ToolbarItem>
        )}
        <ToolbarItem><Button variant="plain" aria-label="Refresh" onClick={() => loadResources(drillProvider?.id)}><SyncAltIcon /></Button></ToolbarItem>
        <ToolbarItem align={{ default: 'alignRight' }}><span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>{resources.length} resource{resources.length !== 1 ? 's' : ''}{drillProvider && <> on <strong>{drillProvider.name}</strong></>}</span></ToolbarItem>
      </ToolbarContent></Toolbar>
      {resError && <Alert variant="danger" isInline title={resError} style={{ marginBottom: '1rem' }} />}
      {resLoading ? <Bullseye style={{ padding: '3rem' }}><Spinner size="xl" /></Bullseye>
        : resources.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>No resources found. Run a collection first.</div>
        : (
          <Table aria-label="Resources" variant="compact">
            <Thead><Tr><Th>Name</Th><Th>Tags</Th><Th>Provider</Th><Th>State</Th><Th>Power</Th><Th>Region</Th><Th screenReaderText="Actions" /></Tr></Thead>
            <Tbody>
              {resources.map((r) => (
                <Tr key={r.id}>
                  <Td dataLabel="Name"><strong>{r.name}</strong></Td>
                  <Td dataLabel="Tags">
                    {(r.tags ?? []).length === 0
                      ? <span style={{ fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>&#x2014;</span>
                      : <LabelGroup numLabels={5} isCompact>
                          {(r.tags ?? []).map(t => (
                            <Label key={t.id} isCompact
                              color={
                                t.namespace === 'type' && t.key === 'category' ? 'blue' :
                                t.namespace === 'type' && t.key === 'resource_type' ? 'cyan' :
                                t.namespace === 'type' && t.key === 'infrastructure' ? 'purple' : 'grey'
                              }>
                              {t.value ? t.key + '=' + t.value : t.key}
                            </Label>
                          ))}
                        </LabelGroup>}
                  </Td>
                  <Td dataLabel="Provider" style={{ fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>{r.provider_name}</Td>
                  <Td dataLabel="State">{r.state || '\u2014'}</Td>
                  <Td dataLabel="Power">{r.power_state ? <Label isCompact color={r.power_state === 'on' ? 'green' : 'grey'}>{r.power_state}</Label> : '\u2014'}</Td>
                  <Td dataLabel="Region" style={{ fontSize: '0.8rem' }}>{r.region || '\u2014'}</Td>
                  <Td isActionCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ProviderGraphModal providerId={r.provider} providerName={r.provider_name} resourceId={r.id} resourceName={r.name} />
                      <ActionsColumn items={[{ title: 'Manage Tags', onClick: () => setTagEditorResource(r) }]} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
    </>
  );

  const TagEditorModal = tagEditorResource ? (
    <ResourceTagEditor
      resourceId={tagEditorResource.id}
      resourceName={tagEditorResource.name}
      initialTags={tagEditorResource.tags ?? []}
      isOpen={true}
      onClose={() => setTagEditorResource(null)}
      onChange={(tags) => {
        setResources((prev) => prev.map((x) => x.id === tagEditorResource.id ? { ...x, tags } : x));
      }}
    />
  ) : null;

  const title = drillProvider ? drillProvider.name : vendorName;
  const subtitle = drillProvider ? vendorName + ' \u00b7 Resources'
    : view === 'resources' ? 'All resources across ' + vendorName + ' providers' : '';

  return (
    <>
      <PageSection variant="light" style={{ paddingBottom: '0.75rem' }}>
        {breadcrumb}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <Title headingLevel="h1" size="2xl">{title}</Title>
            {subtitle && <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>{subtitle}</p>}
          </div>
          {!drillProvider && (
            <ToggleGroup aria-label="View mode">
              <ToggleGroupItem text="Providers" isSelected={view === 'providers'} onChange={() => setView('providers')} />
              <ToggleGroupItem text="Resources" isSelected={view === 'resources'} onChange={() => { setDrillProvider(null); setView('resources'); }} />
            </ToggleGroup>
          )}
        </div>
      </PageSection>
      <PageSection>{view === 'providers' ? ProvidersTable : ResourcesTable}</PageSection>

      {schedulesFor && <SchedulesModal providerId={schedulesFor.id} providerName={schedulesFor.name} isOpen onClose={() => { setSchedulesFor(null); refreshProv(); }} />}

      <Modal variant={ModalVariant.small} title="Delete provider?" isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
             actions={[<Button key="ok" variant="danger" onClick={handleDeleteConfirm}>Delete</Button>, <Button key="no" variant="link" onClick={() => setConfirmDelete(null)}>Cancel</Button>]}>
        {confirmDelete && <p>Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>}
      </Modal>

      <Modal variant={ModalVariant.medium} title={'Edit: ' + (editProvider?.name ?? '')} isOpen={!!editProvider} onClose={() => setEditProvider(null)}
             actions={[<Button key="s" variant="primary" isLoading={editSaving} isDisabled={editSaving} onClick={saveEdit}>Save</Button>, <Button key="c" variant="link" isDisabled={editSaving} onClick={() => setEditProvider(null)}>Cancel</Button>]}>
        <Form>
          <FormGroup label="Name" isRequired fieldId="en"><TextInput id="en" value={editForm.name ?? ''} onChange={(_e, v) => setEditForm((f) => ({ ...f, name: v }))} /></FormGroup>
          <FormGroup label="Endpoint" isRequired fieldId="ee"><TextInput id="ee" value={editForm.endpoint ?? ''} onChange={(_e, v) => setEditForm((f) => ({ ...f, endpoint: v }))} /></FormGroup>
          <FormGroup fieldId="enabled"><Checkbox id="enabled" label="Enabled" isChecked={editForm.enabled ?? true} onChange={(_e, v) => setEditForm((f) => ({ ...f, enabled: v }))} /></FormGroup>
        </Form>
      </Modal>

      <Modal variant={ModalVariant.medium}
        title={addState.step === 1 ? 'Add Provider \u2014 Step 1: Upload Plugin' : 'Add Provider \u2014 Step 2: Configure'}
        isOpen={showAdd} onClose={() => { setShowAdd(false); setAddState(blankAdd()); }}
        actions={addState.step === 1 ? [
          <Button key="up" variant="primary" isLoading={addState.uploading} isDisabled={!addState.file || addState.uploading} onClick={() => handleUpload(false)}>Upload Plugin</Button>,
          <Button key="c" variant="link" onClick={() => { setShowAdd(false); setAddState(blankAdd()); }}>Cancel</Button>,
        ] : [
          <Button key="bk" variant="secondary" isDisabled={addState.saving} onClick={() => setAddState((s) => ({ ...s, step: 1 }))}>Back</Button>,
          <Button key="cr" variant="primary" isLoading={addState.saving} isDisabled={!addState.name || !addState.endpoint || addState.saving} onClick={handleCreate}>Create Provider</Button>,
          <Button key="c" variant="link" onClick={() => { setShowAdd(false); setAddState(blankAdd()); }}>Cancel</Button>,
        ]}
      >
        {addState.step === 1 ? (
          <Form>
            <p style={{ marginBottom: '1rem' }}>Select a provider plugin archive (<code>.tar.gz</code> or <code>.zip</code>).</p>
            <FormGroup label="Plugin archive" isRequired fieldId="pf">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Button variant="secondary" isDisabled={addState.uploading} onClick={() => fileInputRef.current?.click()}>Browse...</Button>
                <span style={{ color: addState.file ? 'inherit' : 'var(--pf-v5-global--Color--200)' }}>{addState.file ? addState.file.name : 'No file selected'}</span>
                <input ref={fileInputRef} id="pf" type="file" accept=".zip,.tgz,.tar.gz,application/gzip,application/zip" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
            </FormGroup>
            {addState.uploading && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Spinner size="md" /> Uploading and installing plugin...</div>}
            {addState.uploadError && <Alert variant="danger" isInline title={addState.uploadError} actionLinks={addState.uploadError.includes('already installed') ? <Button variant="link" isInline onClick={() => handleUpload(true)}>Overwrite</Button> : undefined} />}
          </Form>
        ) : (
          <Form>
            {addState.uploadedPlugin && <Alert variant="success" isInline style={{ marginBottom: '1rem' }} title={'Plugin: ' + addState.uploadedPlugin.vendor + ' / ' + addState.uploadedPlugin.provider_type + ' v' + addState.uploadedPlugin.version} />}
            <FormGroup label="Name" isRequired fieldId="an"><TextInput id="an" value={addState.name} placeholder="e.g. Production vCenter" onChange={(_e, v) => setAddState((s) => ({ ...s, name: v }))} /></FormGroup>
            <FormGroup label="Endpoint" isRequired fieldId="ae"><TextInput id="ae" value={addState.endpoint} placeholder="https://vcenter.example.com" onChange={(_e, v) => setAddState((s) => ({ ...s, endpoint: v }))} /></FormGroup>
            <FormGroup label="Infrastructure" isRequired fieldId="ai"><select id="ai" value={addState.infrastructure} style={selStyle} onChange={(e) => setAddState((s) => ({ ...s, infrastructure: e.target.value }))}><option value="private_cloud">Private Cloud</option><option value="public_cloud">Public Cloud</option><option value="on_premise">On Premise</option><option value="networking">Networking</option><option value="storage">Storage</option></select></FormGroup>
            <FormGroup label="Username" fieldId="au"><TextInput id="au" value={addState.username} placeholder="admin" onChange={(_e, v) => setAddState((s) => ({ ...s, username: v }))} /></FormGroup>
            <FormGroup label="Password" fieldId="ap"><TextInput id="ap" type="password" value={addState.password} onChange={(_e, v) => setAddState((s) => ({ ...s, password: v }))} /></FormGroup>
            <FormGroup fieldId="ap-verify-ssl"><Checkbox id="ap-verify-ssl" label="Verify SSL certificate" isChecked={addState.validateCerts} onChange={(_e, checked) => setAddState((s) => ({ ...s, validateCerts: checked }))} description="Disable for self-signed certificates" /></FormGroup>
            <FormGroup fieldId="aen"><Checkbox id="aen" label="Enable this provider" isChecked={addState.enabled} onChange={(_e, v) => setAddState((s) => ({ ...s, enabled: v }))} /></FormGroup>
            {addState.saveError && <Alert variant="danger" isInline title={addState.saveError} />}
          </Form>
        )}
      </Modal>
      {TagEditorModal}
    </>
  );
}

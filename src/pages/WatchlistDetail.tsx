import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Badge, Breadcrumb, BreadcrumbItem, Bullseye, Button,
  Label, LabelGroup, Modal, ModalVariant,
  PageSection, SearchInput, Spinner, Title, ClipboardCopy,
  Toolbar, ToolbarContent, ToolbarItem,
} from '@patternfly/react-core';
import { SyncAltIcon, CodeIcon, CopyIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api/client';
import type { Resource, Watchlist } from '../api/client';
import { ProviderGraphModal } from '../components/ProviderGraphModal';
import { ResourceTagEditor } from '../components/ResourceTagEditor';

export default function WatchlistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Spotlight search
  const [search, setSearch] = useState('');

  // Remove confirmation
  const [confirmRemove, setConfirmRemove] = useState<Resource | null>(null);
  const [removing, setRemoving] = useState(false);

  // Tag editor
  const [tagEditorResource, setTagEditorResource] = useState<Resource | null>(null);

  // JSON modal
  const [showJson, setShowJson] = useState(false);
  const [jsonData, setJsonData] = useState<string>('');
  const [jsonLoading, setJsonLoading] = useState(false);
  const [copied, setCopied] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [wl, res] = await Promise.all([
        api.getWatchlist(id),
        api.getWatchlistResources(id, 'page_size=500'),
      ]);
      setWatchlist(wl);
      setResources(res.results);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to load watchlist.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRemove = async () => {
    if (!confirmRemove || !id) return;
    setRemoving(true);
    try {
      await api.removeFromWatchlist(id, [confirmRemove.id]);
      setResources((prev) => prev.filter((r) => r.id !== confirmRemove.id));
      setConfirmRemove(null);
    } catch (e) {
      console.error(e);
    } finally {
      setRemoving(false);
    }
  };

  const apiEndpoint = `/api/inventory/v1/watchlists/${id ?? ''}/resources/`;
  const curlCmd = `curl -s 'http://localhost:44926${apiEndpoint}' -H 'Authorization: Basic <credentials>'`;

  const handleShowJson = async () => {
    if (!id) return;
    setShowJson(true);
    setJsonLoading(true);
    setCopied('');
    try {
      const data = await api.getWatchlistResources(id, 'page_size=500');
      setJsonData(JSON.stringify(data, null, 2));
    } catch (e) {
      setJsonData('Error: ' + String(e));
    } finally {
      setJsonLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  // Spotlight filter — match across all visible fields
  const filtered = resources.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const searchable = [
      r.name, r.vendor_type, r.resource_type_slug, r.resource_type_name,
      r.state, r.power_state, r.region, r.os_name, r.os_type,
      r.fqdn, r.flavor, r.cloud_tenant, r.provider_name,
      ...(r.ip_addresses ?? []),
      ...(r.tags ?? []).map((t) => t.key + '=' + t.value),
      ...(r.tags ?? []).map((t) => t.value),
    ].filter(Boolean);
    return searchable.some((s) => s.toLowerCase().includes(q));
  });

  if (loading && !watchlist) {
    return <Bullseye style={{ marginTop: '4rem' }}><Spinner size="xl" /></Bullseye>;
  }

  return (
    <>
      <PageSection variant="light" style={{ paddingBottom: '0.75rem' }}>
        <Breadcrumb style={{ marginBottom: '0.5rem' }}>
          <BreadcrumbItem style={{ cursor: 'pointer' }} onClick={() => navigate('/watchlists')}>
            Watchlists
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{watchlist?.name ?? '...'}</BreadcrumbItem>
        </Breadcrumb>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <Title headingLevel="h1" size="2xl">{watchlist?.name}</Title>
            {watchlist?.description && (
              <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
                {watchlist.description}
              </p>
            )}
            <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>
              {resources.length} resource{resources.length !== 1 ? 's' : ''}
              {watchlist?.watchlist_type === 'dynamic' && (
                <Label isCompact color="purple" style={{ marginLeft: '0.5rem' }}>dynamic</Label>
              )}
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection>
        {error && <Alert variant="danger" isInline title={error} style={{ marginBottom: '1rem' }} />}

        <Toolbar>
          <ToolbarContent>
            <ToolbarItem style={{ flex: 1, maxWidth: '400px' }}>
              <SearchInput
                placeholder="Filter resources... (name, type, IP, OS, tag, region)"
                value={search}
                onChange={(_e, v) => setSearch(v)}
                onClear={() => setSearch('')}
                aria-label="Filter resources"
              />
            </ToolbarItem>
            <ToolbarItem>
              <Button variant="plain" aria-label="Refresh" onClick={loadData}><SyncAltIcon /></Button>
            </ToolbarItem>
            <ToolbarItem>
              <Button variant="secondary" icon={<CodeIcon />} onClick={handleShowJson}>JSON</Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>
                {search ? `${filtered.length} of ${resources.length}` : `${resources.length}`} resource{filtered.length !== 1 ? 's' : ''}
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {resources.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
            No resources in this watchlist yet. Use the Add to Watchlist action on any resource to add it.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
            No resources match that filter.
          </div>
        ) : (
          <Table aria-label="Watchlist resources" variant="compact">
            <Thead>
              <Tr>
                <Th width={20}>Name</Th>
                <Th>Tags</Th>
                <Th>Provider</Th>
                <Th>State</Th>
                <Th width={10}>Power</Th>
                <Th>Region</Th>
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((r) => (
                <Tr key={r.id}>
                  <Td dataLabel="Name"><Button variant="link" isInline onClick={() => navigate('/resources/' + r.id)} style={{ fontWeight: 600 }}>{r.name}</Button></Td>
                  <Td dataLabel="Tags">
                    {(r.tags ?? []).length === 0
                      ? <span style={{ fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>{'-'}</span>
                      : <LabelGroup numLabels={5} isCompact>
                          {(r.tags ?? []).map((t) => (
                            <Label key={t.id} isCompact
                              color={
                                t.namespace === 'type' && t.key === 'infrastructure_bucket' ? 'blue' :
                                t.namespace === 'type' && t.key === 'device_type' ? 'cyan' :
                                t.namespace === 'type' && t.key === 'infrastructure_type' ? 'purple' : 'grey'
                              }>
                              {t.value ? t.key + '=' + t.value : t.key}
                            </Label>
                          ))}
                        </LabelGroup>}
                  </Td>
                  <Td dataLabel="Provider" style={{ fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>
                    {r.provider_name}
                  </Td>
                  <Td dataLabel="State">{r.state || '-'}</Td>
                  <Td dataLabel="Power">
                    {r.power_state
                      ? <Label isCompact color={r.power_state === 'on' ? 'green' : 'grey'}>{r.power_state}</Label>
                      : '-'}
                  </Td>
                  <Td dataLabel="Region" style={{ fontSize: '0.8rem' }}>{r.region || '-'}</Td>
                  <Td isActionCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ProviderGraphModal providerId={r.provider} providerName={r.provider_name} resourceId={r.id} resourceName={r.name} />
                      <ActionsColumn items={[
                        { title: 'Manage Tags', onClick: () => setTagEditorResource(r) },
                        { isSeparator: true },
                        { title: 'Remove from Watchlist', onClick: () => setConfirmRemove(r) },
                      ]} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </PageSection>

      {/* Remove confirmation */}
      <Modal
        variant={ModalVariant.small}
        title="Remove from watchlist?"
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        actions={[
          <Button key="ok" variant="danger" isLoading={removing} isDisabled={removing} onClick={handleRemove}>Remove</Button>,
          <Button key="no" variant="link" onClick={() => setConfirmRemove(null)}>Cancel</Button>,
        ]}
      >
        {confirmRemove && (
          <p>Remove <strong>{confirmRemove.name}</strong> from <strong>{watchlist?.name}</strong>? The resource itself will not be deleted.</p>
        )}
      </Modal>

      {/* Tag editor */}
      {tagEditorResource && (
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
      )}
      {/* JSON modal */}
      <Modal
        variant={ModalVariant.medium}
        title={`API Response — ${watchlist?.name ?? 'Watchlist'}`}
        isOpen={showJson}
        onClose={() => setShowJson(false)}
        actions={[
          <Button key="close" variant="primary" onClick={() => setShowJson(false)}>Close</Button>,
        ]}
      >
        {jsonLoading ? (
          <Bullseye style={{ padding: '2rem' }}><Spinner size="lg" /></Bullseye>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <strong style={{ fontSize: '0.85rem' }}>REST Endpoint</strong>
                <Button variant="plain" aria-label="Copy endpoint" onClick={() => copyToClipboard(curlCmd, 'endpoint')} style={{ padding: '0.2rem' }}>
                  <CopyIcon />{copied === 'endpoint' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--pf-v5-global--success-color--100)' }}>Copied!</span>}
                </Button>
              </div>
              <pre style={{ background: 'var(--pf-v5-global--BackgroundColor--200)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{curlCmd}</pre>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <strong style={{ fontSize: '0.85rem' }}>JSON Response</strong>
                <Button variant="plain" aria-label="Copy JSON" onClick={() => copyToClipboard(jsonData, 'json')} style={{ padding: '0.2rem' }}>
                  <CopyIcon />{copied === 'json' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--pf-v5-global--success-color--100)' }}>Copied!</span>}
                </Button>
              </div>
              <pre style={{ background: 'var(--pf-v5-global--BackgroundColor--200)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.78rem', overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{jsonData}</pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

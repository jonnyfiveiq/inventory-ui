import { useCallback, useState } from 'react';
import {
  Alert,
  Badge,
  Bullseye,
  Button,
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  FileUpload,
  Flex,
  FlexItem,
  FormGroup,
  Label,
  Modal,
  ModalVariant,
  PageSection,
  Progress,
  ProgressVariant,
  Spinner,
  Split,
  SplitItem,
  Tab,
  Tabs,
  TabTitleText,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  CubesIcon,
  ExclamationCircleIcon,
  FileIcon,
  InProgressIcon,
  OutlinedClockIcon,
  SearchIcon,
  SyncAltIcon,
  TimesCircleIcon,
  TrashIcon,
  UploadIcon,
} from '@patternfly/react-icons';
import { ActionsColumn, Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api/client';
import type { MetricsImportRecord, PendingMatchRecord, HostMappingRecord } from '../api/client';
import { usePolling } from '../hooks/usePolling';

/* ── Helpers ───────────────────────────────────────────────────────── */

function StatusLabel({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Label color="green" icon={<CheckCircleIcon />} isCompact>Completed</Label>;
    case 'processing':
      return <Label color="blue" icon={<InProgressIcon />} isCompact>Processing</Label>;
    case 'failed':
      return <Label color="red" icon={<ExclamationCircleIcon />} isCompact>Failed</Label>;
    case 'pending':
    default:
      return <Label color="grey" icon={<OutlinedClockIcon />} isCompact>Pending</Label>;
  }
}

function MatchScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge style={{ backgroundColor: 'var(--pf-v5-global--success-color--100)' }}>{score}%</Badge>;
  if (score >= 50) return <Badge style={{ backgroundColor: 'var(--pf-v5-global--warning-color--100)' }}>{score}%</Badge>;
  if (score > 0) return <Badge style={{ backgroundColor: 'var(--pf-v5-global--danger-color--100)', color: '#fff' }}>{score}%</Badge>;
  return <Badge isRead>0%</Badge>;
}

function formatDate(iso: string | null) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Upload Section ──────────────────────────────────────────────── */

function UploadSection({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    try {
      const result = await api.uploadMetricsImport(file, sourceLabel || undefined);
      setUploadSuccess(
        `Uploaded "${result.filename}" \u2014 ${result.stats.unique_hosts ?? 0} hosts found, ` +
        `${result.stats.auto_matched ?? 0} auto-matched, ${result.stats.pending_review ?? 0} pending review.`
      );
      setFile(null);
      setFilename('');
      setSourceLabel('');
      onUploaded();
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Upload failed.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card isCompact>
      <CardTitle>
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem><UploadIcon /></FlexItem>
          <FlexItem>Upload Metrics Tarball</FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {uploadError && <Alert variant="danger" isInline title={uploadError} style={{ marginBottom: '1rem' }} />}
        {uploadSuccess && <Alert variant="success" isInline title={uploadSuccess} style={{ marginBottom: '1rem' }} />}
        <Split hasGutter>
          <SplitItem isFilled>
            <FormGroup label="Metrics tarball" fieldId="mi-file">
              <FileUpload
                id="mi-file"
                type="simple"
                value={file as unknown as string}
                filename={filename}
                filenamePlaceholder="Drag a .tar.gz or .zip file here or click to browse"
                browseButtonText="Browse"
                onFileInputChange={(_e, f) => { setFile(f); setFilename(f.name); }}
                onClearClick={() => { setFile(null); setFilename(''); }}
                isLoading={uploading}
                dropzoneProps={{
                  accept: { 'application/gzip': ['.tar.gz', '.tgz'], 'application/x-tar': ['.tar'], 'application/zip': ['.zip'] },
                }}
              />
            </FormGroup>
          </SplitItem>
          <SplitItem style={{ minWidth: '220px' }}>
            <FormGroup label="Source label" fieldId="mi-source" helperText="e.g. Production Controller">
              <TextInput
                id="mi-source"
                value={sourceLabel}
                onChange={(_e, v) => setSourceLabel(v)}
                placeholder="AAP instance name"
              />
            </FormGroup>
          </SplitItem>
          <SplitItem style={{ alignSelf: 'flex-end', paddingBottom: '0.25rem' }}>
            <Button
              variant="primary"
              isDisabled={!file || uploading}
              isLoading={uploading}
              onClick={handleUpload}
            >
              Upload &amp; Process
            </Button>
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
}

/* ── Stats Summary ─────────────────────────────────────────────── */

function StatsSummary({ imp }: { imp: MetricsImportRecord }) {
  const s = imp.stats;
  const total = s.unique_hosts ?? 0;
  const matched = (s.auto_matched ?? 0) + (imp.matched_count ?? 0);
  const pctMatched = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Progress
        value={pctMatched}
        title="Match rate"
        variant={pctMatched >= 75 ? ProgressVariant.success : pctMatched >= 40 ? ProgressVariant.warning : ProgressVariant.danger}
        measureLocation="outside"
        label={`${matched} / ${total} hosts matched (${pctMatched}%)`}
        style={{ marginBottom: '1rem' }}
      />
      <DescriptionList isHorizontal isCompact columnModifier={{ default: '3Col' }}>
        <DescriptionListGroup>
          <DescriptionListTerm>CSVs found</DescriptionListTerm>
          <DescriptionListDescription>{s.csvs_found ?? 0}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>CSV rows</DescriptionListTerm>
          <DescriptionListDescription>{(s.total_csv_rows ?? 0).toLocaleString()}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Unique hosts</DescriptionListTerm>
          <DescriptionListDescription>{s.unique_hosts ?? 0}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Auto-matched</DescriptionListTerm>
          <DescriptionListDescription>
            <Badge isRead>{s.auto_matched ?? 0}</Badge>
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Pending review</DescriptionListTerm>
          <DescriptionListDescription>
            <Badge style={imp.pending_count > 0 ? { backgroundColor: 'var(--pf-v5-global--warning-color--100)' } : {}}>{imp.pending_count ?? s.pending_review ?? 0}</Badge>
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Unmatched</DescriptionListTerm>
          <DescriptionListDescription>
            <Badge isRead>{s.unmatched ?? 0}</Badge>
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Records created</DescriptionListTerm>
          <DescriptionListDescription>{s.automation_records_created ?? 0}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Learned mapping hits</DescriptionListTerm>
          <DescriptionListDescription>{s.learned_mapping_hits ?? 0}</DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    </div>
  );
}

/* ── Review Queue (Pending Matches) ──────────────────────────────── */

function ReviewQueue({ importId, onResolved }: { importId: string; onResolved: () => void }) {
  const fetchMatches = useCallback(
    () => api.listPendingMatches(`metrics_import=${importId}&page_size=200`),
    [importId]
  );
  const { data, loading, refresh } = usePolling(fetchMatches, 15000);
  const matches: PendingMatchRecord[] = data?.results ?? [];
  const pending = matches.filter((m) => m.status === 'pending');
  const resolved = matches.filter((m) => m.status !== 'pending');

  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [bulkAction, setBulkAction] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const resolve = async (id: string, action: 'approve' | 'reject' | 'ignore') => {
    setResolving((prev) => ({ ...prev, [id]: true }));
    try {
      await api.resolvePendingMatch(id, action);
      refresh();
      onResolved();
    } catch (e) {
      console.error('Resolve failed:', e);
    } finally {
      setResolving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const bulkApproveAll = async () => {
    setBulkAction(true);
    try {
      const approveIds = pending.filter((m) => m.candidate_resource).map((m) => m.id);
      if (approveIds.length > 0) {
        await api.bulkResolvePendingMatches(approveIds, 'approve');
      }
      const ignoreIds = pending.filter((m) => !m.candidate_resource).map((m) => m.id);
      if (ignoreIds.length > 0) {
        await api.bulkResolvePendingMatches(ignoreIds, 'ignore');
      }
      refresh();
      onResolved();
    } catch (e) {
      console.error('Bulk resolve failed:', e);
    } finally {
      setBulkAction(false);
    }
  };

  const filtered = pending.filter(
    (m) =>
      !searchFilter ||
      m.aap_host_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (m.candidate_resource_name || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading && !data) {
    return <Bullseye style={{ padding: '2rem' }}><Spinner size="lg" /></Bullseye>;
  }

  return (
    <>
      {pending.length > 0 && (
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <TextInput
                type="search"
                placeholder="Filter by hostname..."
                value={searchFilter}
                onChange={(_e, v) => setSearchFilter(v)}
                customIcon={<SearchIcon />}
                style={{ minWidth: '250px' }}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Tooltip content="Approve all matches with a candidate, ignore those without">
                <Button
                  variant="secondary"
                  isLoading={bulkAction}
                  isDisabled={bulkAction || pending.length === 0}
                  onClick={bulkApproveAll}
                >
                  Approve all ({pending.filter((m) => m.candidate_resource).length})
                </Button>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
                {pending.length} pending &middot; {resolved.length} resolved
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      )}

      {pending.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={CheckCircleIcon} />
          <Title headingLevel="h4" size="lg">All reviewed</Title>
          <EmptyStateBody>
            {resolved.length > 0
              ? `All ${resolved.length} match${resolved.length !== 1 ? 'es have' : ' has'} been resolved.`
              : 'No pending matches for this import.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Pending matches" variant="compact">
          <Thead>
            <Tr>
              <Th width={25}>AAP Host</Th>
              <Th width={25}>Candidate Resource</Th>
              <Th width={15}>Match Reason</Th>
              <Th width={10}>Score</Th>
              <Th width={10}>Events</Th>
              <Th width={15}>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((m) => (
              <Tr key={m.id}>
                <Td dataLabel="AAP Host">
                  <strong>{m.aap_host_name}</strong>
                </Td>
                <Td dataLabel="Candidate Resource">
                  {m.candidate_resource ? (
                    <span>
                      {m.candidate_resource_name}
                      {m.candidate_resource_type && (
                        <Label isCompact color="blue" style={{ marginLeft: '0.5rem' }}>{m.candidate_resource_type}</Label>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--pf-v5-global--Color--200)', fontStyle: 'italic' }}>No candidate found</span>
                  )}
                </Td>
                <Td dataLabel="Reason">
                  <span style={{ fontSize: '0.85rem' }}>{m.match_reason || '\u2014'}</span>
                </Td>
                <Td dataLabel="Score"><MatchScoreBadge score={m.match_score} /></Td>
                <Td dataLabel="Events">
                  {(m.raw_data as Record<string, unknown>)?.total_events?.toString() ?? '\u2014'}
                </Td>
                <Td dataLabel="Actions">
                  <Flex>
                    {m.candidate_resource && (
                      <FlexItem>
                        <Button
                          variant="link"
                          isSmall
                          isDisabled={resolving[m.id]}
                          isLoading={resolving[m.id]}
                          icon={<CheckCircleIcon color="var(--pf-v5-global--success-color--100)" />}
                          onClick={() => resolve(m.id, 'approve')}
                        >
                          Approve
                        </Button>
                      </FlexItem>
                    )}
                    <FlexItem>
                      <Button
                        variant="link"
                        isSmall
                        isDanger
                        isDisabled={resolving[m.id]}
                        icon={<TimesCircleIcon />}
                        onClick={() => resolve(m.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="plain"
                        isSmall
                        isDisabled={resolving[m.id]}
                        onClick={() => resolve(m.id, 'ignore')}
                      >
                        Ignore
                      </Button>
                    </FlexItem>
                  </Flex>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Resolved matches */}
      {resolved.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <Title headingLevel="h4" size="md" style={{ marginBottom: '0.5rem' }}>
            Resolved ({resolved.length})
          </Title>
          <Table aria-label="Resolved matches" variant="compact">
            <Thead>
              <Tr>
                <Th>AAP Host</Th>
                <Th>Resource</Th>
                <Th>Status</Th>
                <Th>Resolved</Th>
              </Tr>
            </Thead>
            <Tbody>
              {resolved.map((m) => (
                <Tr key={m.id}>
                  <Td>{m.aap_host_name}</Td>
                  <Td>{m.resolved_resource_name || m.candidate_resource_name || '\u2014'}</Td>
                  <Td>
                    {m.status === 'approved' && <Label color="green" isCompact>Approved</Label>}
                    {m.status === 'rejected' && <Label color="red" isCompact>Rejected</Label>}
                    {m.status === 'ignored' && <Label color="grey" isCompact>Ignored</Label>}
                  </Td>
                  <Td style={{ fontSize: '0.8rem' }}>{formatDate(m.resolved_at)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </>
  );
}

/* ── Host Mappings (Learned Mappings) ──────────────────────────── */

function LearnedMappings() {
  const fetchMappings = useCallback(() => api.listHostMappings('page_size=200'), []);
  const { data, loading, refresh } = usePolling(fetchMappings, 30000);
  const mappings: HostMappingRecord[] = data?.results ?? [];
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.deleteHostMapping(id);
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  if (loading && !data) {
    return <Bullseye style={{ padding: '2rem' }}><Spinner size="lg" /></Bullseye>;
  }

  if (mappings.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={CubesIcon} />
        <Title headingLevel="h4" size="lg">No learned mappings yet</Title>
        <EmptyStateBody>
          When you approve a pending match, the host-to-resource mapping is saved here so future imports auto-match.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Table aria-label="Learned mappings" variant="compact">
      <Thead>
        <Tr>
          <Th width={30}>AAP Host Name</Th>
          <Th width={25}>Resource</Th>
          <Th width={20}>Source Label</Th>
          <Th width={15}>Created</Th>
          <Th screenReaderText="Actions" />
        </Tr>
      </Thead>
      <Tbody>
        {mappings.map((m) => (
          <Tr key={m.id}>
            <Td><strong>{m.aap_host_name}</strong></Td>
            <Td>{m.resource_name}</Td>
            <Td>
              {m.source_label ? (
                <Label isCompact color="cyan">{m.source_label}</Label>
              ) : (
                <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>Global</span>
              )}
            </Td>
            <Td style={{ fontSize: '0.8rem' }}>{formatDate(m.created_at)}</Td>
            <Td isActionCell>
              <Button
                variant="plain"
                isSmall
                isDanger
                isLoading={deleting === m.id}
                isDisabled={deleting === m.id}
                onClick={() => handleDelete(m.id)}
                aria-label="Delete mapping"
              >
                <TrashIcon />
              </Button>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

/* ── Import Detail Modal ────────────────────────────────────────── */

function ImportDetail({
  imp,
  onClose,
  onChanged,
}: {
  imp: MetricsImportRecord;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Modal
      variant={ModalVariant.large}
      title={
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem><FileIcon /></FlexItem>
          <FlexItem>{imp.filename}</FlexItem>
          <FlexItem><StatusLabel status={imp.status} /></FlexItem>
        </Flex>
      }
      isOpen
      onClose={onClose}
    >
      <div style={{ marginBottom: '1rem' }}>
        <Split hasGutter>
          <SplitItem>
            <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
              Source: <strong>{imp.source_label || '\u2014'}</strong>
            </span>
          </SplitItem>
          <SplitItem>
            <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
              Uploaded: <strong>{formatDate(imp.uploaded_at)}</strong>
            </span>
          </SplitItem>
          <SplitItem>
            <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
              Processed: <strong>{formatDate(imp.processed_at)}</strong>
            </span>
          </SplitItem>
        </Split>
      </div>

      <StatsSummary imp={imp} />

      {imp.error_log && (
        <Alert variant="danger" isInline title="Processing errors" style={{ marginBottom: '1rem' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', maxHeight: '150px', overflow: 'auto' }}>
            {imp.error_log}
          </pre>
        </Alert>
      )}

      <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
        <Tab
          eventKey={0}
          title={
            <TabTitleText>
              Review Queue{' '}
              {imp.pending_count > 0 && (
                <Badge style={{ backgroundColor: 'var(--pf-v5-global--warning-color--100)' }}>{imp.pending_count}</Badge>
              )}
            </TabTitleText>
          }
        >
          <div style={{ paddingTop: '1rem' }}>
            <ReviewQueue importId={imp.id} onResolved={onChanged} />
          </div>
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>Learned Mappings</TabTitleText>}>
          <div style={{ paddingTop: '1rem' }}>
            <LearnedMappings />
          </div>
        </Tab>
      </Tabs>
    </Modal>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */

export default function MetricsImport() {
  const fetchImports = useCallback(() => api.listMetricsImports('page_size=50'), []);
  const { data, loading, refresh } = usePolling(fetchImports, 10000);
  const imports: MetricsImportRecord[] = data?.results ?? [];

  const [selectedImport, setSelectedImport] = useState<MetricsImportRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MetricsImportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.deleteMetricsImport(confirmDelete.id);
      setConfirmDelete(null);
      if (selectedImport?.id === confirmDelete.id) setSelectedImport(null);
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = async (imp: MetricsImportRecord) => {
    try {
      const fresh = await api.getMetricsImport(imp.id);
      setSelectedImport(fresh);
    } catch {
      setSelectedImport(imp);
    }
  };

  const refreshDetail = async () => {
    refresh();
    if (selectedImport) {
      try {
        const fresh = await api.getMetricsImport(selectedImport.id);
        setSelectedImport(fresh);
      } catch {
        /* keep stale */
      }
    }
  };

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">Metrics Import</Title>
        <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
          Upload metrics-utility tarballs from AAP to correlate automation history with inventory resources.
        </p>
      </PageSection>

      <PageSection>
        <UploadSection onUploaded={refresh} />
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Title headingLevel="h2" size="lg">Import History</Title>
            </ToolbarItem>
            <ToolbarItem>
              <Button variant="plain" aria-label="Refresh" onClick={refresh}><SyncAltIcon /></Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
                {imports.length} import{imports.length !== 1 ? 's' : ''}
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {loading && !data ? (
          <Bullseye style={{ padding: '3rem' }}><Spinner size="xl" /></Bullseye>
        ) : imports.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={UploadIcon} />
            <Title headingLevel="h4" size="lg">No imports yet</Title>
            <EmptyStateBody>
              Upload a metrics-utility tarball above to get started. The system will extract host data
              and match it against your inventory resources.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label="Metrics imports" variant="compact">
            <Thead>
              <Tr>
                <Th width={25}>Filename</Th>
                <Th width={15}>Source</Th>
                <Th width={10}>Status</Th>
                <Th width={10}>Hosts</Th>
                <Th width={10}>Matched</Th>
                <Th width={10}>Pending</Th>
                <Th width={12}>Uploaded</Th>
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {imports.map((imp) => (
                <Tr
                  key={imp.id}
                  style={{ cursor: 'pointer' }}
                  onRowClick={() => openDetail(imp)}
                  isHoverable
                >
                  <Td dataLabel="Filename"><strong>{imp.filename}</strong></Td>
                  <Td dataLabel="Source">
                    {imp.source_label ? (
                      <Label isCompact color="cyan">{imp.source_label}</Label>
                    ) : (
                      <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85rem' }}>{'\u2014'}</span>
                    )}
                  </Td>
                  <Td dataLabel="Status"><StatusLabel status={imp.status} /></Td>
                  <Td dataLabel="Hosts"><Badge isRead>{imp.stats.unique_hosts ?? 0}</Badge></Td>
                  <Td dataLabel="Matched">
                    <Badge isRead>{(imp.stats.auto_matched ?? 0) + (imp.matched_count ?? 0)}</Badge>
                  </Td>
                  <Td dataLabel="Pending">
                    {imp.pending_count > 0 ? (
                      <Badge style={{ backgroundColor: 'var(--pf-v5-global--warning-color--100)' }}>{imp.pending_count}</Badge>
                    ) : (
                      <Badge isRead>0</Badge>
                    )}
                  </Td>
                  <Td dataLabel="Uploaded" style={{ fontSize: '0.8rem' }}>{formatDate(imp.uploaded_at)}</Td>
                  <Td isActionCell onClick={(e) => e.stopPropagation()}>
                    <ActionsColumn items={[
                      { title: 'View details', onClick: () => openDetail(imp) },
                      { isSeparator: true },
                      { title: 'Delete', onClick: () => setConfirmDelete(imp) },
                    ]} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </PageSection>

      {/* Detail Modal */}
      {selectedImport && (
        <ImportDetail
          imp={selectedImport}
          onClose={() => setSelectedImport(null)}
          onChanged={refreshDetail}
        />
      )}

      {/* Delete Confirmation */}
      <Modal
        variant={ModalVariant.small}
        title="Delete import?"
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        actions={[
          <Button key="ok" variant="danger" isLoading={deleting} isDisabled={deleting} onClick={handleDelete}>Delete</Button>,
          <Button key="no" variant="link" onClick={() => setConfirmDelete(null)}>Cancel</Button>,
        ]}
      >
        {confirmDelete && (
          <p>
            Delete import <strong>{confirmDelete.filename}</strong>? This will also remove all associated
            pending matches. Automation records already created will not be deleted.
          </p>
        )}
      </Modal>
    </>
  );
}

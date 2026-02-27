import { useCallback, useEffect, useState } from 'react';
import { useParams } useNavigate } from 'react-router-dom';
import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
  PageSection,
  SearchInput,
  Spinner,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} Button, } from '@patternfly/react-core';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
} from '@patternfly/react-table';
import { api } from '../../api/client';
import type { Resource, ResourceType, ResourceCategory, ResourceDrift, DriftType } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';
import { DriftLabel, DriftModal } from '../../components/DriftModal';
import { CheckCircleIcon } from '@patternfly/react-icons';

// -- Drift state types -------------------------------------------------------

interface DriftInfo {
  types: DriftType[];
  events: ResourceDrift[];
}

// -- Drift badge + modal glue ------------------------------------------------

interface WithDriftProps {
  resource: Resource;
  driftInfo: DriftInfo | undefined;
}

function DriftCell({ resource, driftInfo }: WithDriftProps) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  if (!driftInfo || driftInfo.types.length === 0) return null;

  return (
    <>
      <DriftLabel
        driftTypes={driftInfo.types}
        onClick={() => setModalOpen(true)}
      />
      {modalOpen && (
        <DriftModal
          resourceId={resource.id}
          resourceName={resource.name}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// -- Automated badge --------------------------------------------------------
function AutomatedCell({ r }: { r: Resource }) {
  if (!r.is_automated) return <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>—</span>;
  return (
    <Label isCompact color="teal" icon={<CheckCircleIcon />}>
      {r.automation_count ?? 0}
    </Label>
  );
}

// -- Column layouts per category ---------------------------------------------

function ComputeRow({ r, driftInfo }: { r: Resource; driftInfo: DriftInfo | undefined }) {
  const powerColor = (s: string) =>
    s === 'on' || s === 'poweredOn' ? 'green' as const :
    s === 'off' || s === 'poweredOff' ? 'grey' as const : 'blue' as const;
  const stateColor = (s: string) =>
    s === 'active' || s === 'running' ? 'green' as const :
    s === 'error' || s === 'failed' ? 'red' as const :
    s === 'stopped' ? 'grey' as const : 'blue' as const;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name">
        <Button variant="link" isInline onClick={() => navigate('/resources/' + r.id)} style={{ fontWeight: 600 }}>{r.name}</Button>
        <DriftCell resource={r} driftInfo={driftInfo} />
      </Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Automated"><AutomatedCell r={r} /></Td>
      <Td dataLabel="Power">{r.power_state ? <Label color={powerColor(r.power_state)}>{r.power_state}</Label> : '-'}</Td>
      <Td dataLabel="CPUs">{r.cpu_count ?? '-'}</Td>
      <Td dataLabel="Memory">{r.memory_mb ? (r.memory_mb / 1024).toFixed(1) + ' GB' : '-'}</Td>
      <Td dataLabel="Disk">{r.disk_gb ? r.disk_gb + ' GB' : '-'}</Td>
      <Td dataLabel="IP Addresses">{r.ip_addresses?.length ? r.ip_addresses.join(', ') : '-'}</Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
    </Tr>
  );
}

function ComputeTable({ resources, driftMap }: { resources: Resource[]; driftMap: Map<string, DriftInfo> }) {
  return (
    <Table aria-label="Compute" variant="compact">
      <Thead><Tr>
        <Th width={20}>Name</Th>
        <Th>Type</Th>
        <Th>State</Th>
        <Th width={8}>Automated</Th>
        <Th width={10}>Power</Th>
        <Th>CPUs</Th>
        <Th>Memory</Th>
        <Th>Disk</Th>
        <Th width={15}>IP Addresses</Th>
        <Th width={10}>Region</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <ComputeRow key={r.id} r={r} driftInfo={driftMap.get(r.id)} />)}</Tbody>
    </Table>
  );
}

function StorageRow({ r, driftInfo }: { r: Resource; driftInfo: DriftInfo | undefined }) {
  const stateColor = (s: string) =>
    s === 'active' ? 'green' as const : s === 'error' ? 'red' as const : 'grey' as const;
  const props = r.properties as Record<string, number | string> ?? {};
  const capacityGb = props.capacity_gb as number ?? r.disk_gb;
  const freeGb = props.free_space_gb as number ?? null;
  const provPct = props.provisioned_pct as number ?? null;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name">
        <Button variant="link" isInline onClick={() => navigate('/resources/' + r.id)} style={{ fontWeight: 600 }}>{r.name}</Button>
        <DriftCell resource={r} driftInfo={driftInfo} />
      </Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Automated"><AutomatedCell r={r} /></Td>
      <Td dataLabel="Capacity">{capacityGb ? capacityGb + ' GB' : '-'}</Td>
      <Td dataLabel="Free Space">{freeGb != null ? freeGb + ' GB' : '-'}</Td>
      <Td dataLabel="Used">{freeGb != null && capacityGb ? (capacityGb - freeGb) + ' GB' : '-'}</Td>
      <Td dataLabel="Provisioned">{provPct != null ? provPct + '%' : '-'}</Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
    </Tr>
  );
}

function StorageTable({ resources, driftMap }: { resources: Resource[]; driftMap: Map<string, DriftInfo> }) {
  return (
    <Table aria-label="Storage" variant="compact">
      <Thead><Tr>
        <Th width={20}>Name</Th>
        <Th width={15}>Type</Th>
        <Th>State</Th>
        <Th width={8}>Automated</Th>
        <Th width={10}>Capacity</Th>
        <Th width={10}>Free Space</Th>
        <Th width={10}>Used</Th>
        <Th>Provisioned</Th>
        <Th width={15}>Region</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <StorageRow key={r.id} r={r} driftInfo={driftMap.get(r.id)} />)}</Tbody>
    </Table>
  );
}

function NetworkingRow({ r, driftInfo }: { r: Resource; driftInfo: DriftInfo | undefined }) {
  const stateColor = (s: string) =>
    s === 'active' ? 'green' as const : s === 'error' ? 'red' as const : 'grey' as const;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name">
        <Button variant="link" isInline onClick={() => navigate('/resources/' + r.id)} style={{ fontWeight: 600 }}>{r.name}</Button>
        <DriftCell resource={r} driftInfo={driftInfo} />
      </Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Automated"><AutomatedCell r={r} /></Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
      <Td dataLabel="Zone">{r.availability_zone || '-'}</Td>
      <Td dataLabel="Tenant">{r.cloud_tenant || '-'}</Td>
    </Tr>
  );
}

function NetworkingTable({ resources, driftMap }: { resources: Resource[]; driftMap: Map<string, DriftInfo> }) {
  return (
    <Table aria-label="Networking" variant="compact">
      <Thead><Tr>
        <Th width={25}>Name</Th>
        <Th width={20}>Type</Th>
        <Th width={10}>State</Th>
        <Th width={8}>Automated</Th>
        <Th width={15}>Region</Th>
        <Th width={15}>Zone</Th>
        <Th width={15}>Tenant</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <NetworkingRow key={r.id} r={r} driftInfo={driftMap.get(r.id)} />)}</Tbody>
    </Table>
  );
}

function GenericRow({ r, driftInfo }: { r: Resource; driftInfo: DriftInfo | undefined }) {
  const stateColor = (s: string) =>
    s === 'active' || s === 'running' ? 'green' as const :
    s === 'error' || s === 'failed' ? 'red' as const : 'grey' as const;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name">
        <Button variant="link" isInline onClick={() => navigate('/resources/' + r.id)} style={{ fontWeight: 600 }}>{r.name}</Button>
        <DriftCell resource={r} driftInfo={driftInfo} />
      </Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Automated"><AutomatedCell r={r} /></Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
      <Td dataLabel="First Discovered">{r.first_discovered_at ? new Date(r.first_discovered_at).toLocaleDateString() : '-'}</Td>
      <Td dataLabel="Last Seen">{r.last_seen_at ? new Date(r.last_seen_at).toLocaleDateString() : '-'}</Td>
    </Tr>
  );
}

function GenericTable({ resources, label, driftMap }: { resources: Resource[]; label: string; driftMap: Map<string, DriftInfo> }) {
  return (
    <Table aria-label={label} variant="compact">
      <Thead><Tr>
        <Th width={25}>Name</Th>
        <Th width={20}>Type</Th>
        <Th width={10}>State</Th>
        <Th width={8}>Automated</Th>
        <Th width={15}>Region</Th>
        <Th width={15}>First Discovered</Th>
        <Th width={15}>Last Seen</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <GenericRow key={r.id} r={r} driftInfo={driftMap.get(r.id)} />)}</Tbody>
    </Table>
  );
}

// -- Page --------------------------------------------------------------------

export default function InventoryList() {
  const { providerId, categorySlug } = useParams<{ providerId: string; categorySlug: string }>();
  const [category, setCategory] = useState<ResourceCategory | null>(null);
  const [typeIds, setTypeIds] = useState<Set<string> | null>(null);
  const [driftMap, setDriftMap] = useState<Map<string, DriftInfo>>(new Map());

  // Spotlight search
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!categorySlug) return;
    setCategory(null);
    setTypeIds(null);
    Promise.all([
      api.listResourceCategories(),
      api.listResourceTypes('page_size=200'),
    ]).then(([cats, types]) => {
      const cat = cats.results.find((c) => c.slug === categorySlug) ?? null;
      setCategory(cat);
      const ids = new Set(
        (types.results as ResourceType[])
          .filter((t) => t.category_slug === categorySlug)
          .map((t) => t.id)
      );
      setTypeIds(ids);
    });
  }, [categorySlug]);

  // Fetch drift summary for all resources in this provider (one bulk call)
  useEffect(() => {
    if (!providerId) return;
    api.listResourceDrift('resource__provider=' + providerId + '&page_size=500')
      .then((r) => {
        const map = new Map<string, DriftInfo>();
        for (const ev of r.results) {
          const existing = map.get(ev.resource) ?? { types: [], events: [] };
          if (!existing.types.includes(ev.drift_type)) {
            existing.types.push(ev.drift_type);
          }
          existing.events.push(ev);
          map.set(ev.resource, existing);
        }
        setDriftMap(map);
      })
      .catch(() => {
        // drift is non-critical; silently ignore errors
      });
  }, [providerId]);

  const fetchResources = useCallback(() => {
    if (!providerId) return Promise.resolve({ count: 0, next: null, previous: null, results: [] });
    return api.listResources('page_size=500');
  }, [providerId]);

  const { data, loading } = usePolling(fetchResources, 30000);

  const resources: Resource[] = (data?.results ?? []).filter(
    (r) => r.provider === providerId && (typeIds ? typeIds.has(r.resource_type) : true)
  );

  const driftCount = resources.filter((r) => driftMap.has(r.id)).length;
  const automatedCount = resources.filter((r) => r.is_automated).length;

  // Spotlight filter - matches across all visible fields
  const filtered = resources.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const searchable = [
      r.name, r.vendor_type, r.resource_type_slug, r.state, r.power_state,
      r.region, r.os_name, r.os_type, r.fqdn, r.flavor,
      r.cloud_tenant, r.availability_zone,
      ...(r.ip_addresses ?? []),
      ...(r.tags ?? []).map((t: { key: string; value?: string }) => t.key + '=' + (t.value ?? '')),
      r.cpu_count?.toString(), r.memory_mb?.toString(), r.disk_gb?.toString(),
    ].filter(Boolean);
    return searchable.some((s) => s!.toLowerCase().includes(q));
  });

  const categoryTitle = category?.name ?? categorySlug ?? 'Resources';

  if (loading && !data) {
    return <Bullseye style={{ marginTop: '4rem' }}><Spinner size="xl" /></Bullseye>;
  }

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">{categoryTitle}</Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          {search ? `${filtered.length} of ${resources.length}` : `${resources.length}`} {categoryTitle.toLowerCase()} discovered
          {automatedCount > 0 && (
            <Label
              color="teal"
              isCompact
              icon={<CheckCircleIcon />}
              style={{ marginLeft: '0.75rem' }}
            >
              {automatedCount} automated
            </Label>
          )}
          {driftCount > 0 && (
            <Label
              color="orange"
              isCompact
              style={{ marginLeft: '0.75rem' }}
            >
              {driftCount} with drift
            </Label>
          )}
          {loading && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>refreshing...</span>}
        </p>
      </PageSection>
      <PageSection>
        <Toolbar style={{ marginBottom: '1rem' }}>
          <ToolbarContent>
            <ToolbarItem style={{ flex: 1 }}>
              <SearchInput
                placeholder="Filter resources… (name, type, IP, OS, state, region)"
                value={search}
                onChange={(_e, v) => setSearch(v)}
                onClear={() => setSearch('')}
                aria-label="Filter resources"
                style={{ maxWidth: '500px' }}
              />
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.875rem' }}>
                {search ? `${filtered.length} of ${resources.length}` : `${resources.length}`} resource{filtered.length !== 1 ? 's' : ''}
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
        {filtered.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <Title headingLevel="h2" size="lg">{search ? 'No matching resources' : `No ${categoryTitle.toLowerCase()} found`}</Title>
            <EmptyStateBody>
              {search ? 'No resources match that filter. Try a different search term.' : 'Run a collection on this provider to discover resources.'}
            </EmptyStateBody>
          </EmptyState>
        ) : categorySlug === 'compute' ? (
          <ComputeTable resources={filtered} driftMap={driftMap} />
        ) : categorySlug === 'storage' ? (
          <StorageTable resources={filtered} driftMap={driftMap} />
        ) : categorySlug === 'networking' ? (
          <NetworkingTable resources={filtered} driftMap={driftMap} />
        ) : (
          <GenericTable resources={filtered} label={categoryTitle} driftMap={driftMap} />
        )}
      </PageSection>
    </>
  );
}

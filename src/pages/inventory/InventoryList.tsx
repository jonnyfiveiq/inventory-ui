import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
  PageSection,
  Spinner,
  Title,
} from '@patternfly/react-core';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
} from '@patternfly/react-table';
import { api } from '../../api/client';
import type { Resource, ResourceType, ResourceCategory } from '../../api/client';
import { usePolling } from '../../hooks/usePolling';

// ?? Column layouts per category ???????????????????????????????????????????

function ComputeRow({ r }: { r: Resource }) {
  const powerColor = (s: string) => s === 'on' || s === 'poweredOn' ? 'green' as const : s === 'off' || s === 'poweredOff' ? 'grey' as const : 'blue' as const;
  const stateColor = (s: string) => s === 'active' || s === 'running' ? 'green' as const : s === 'error' || s === 'failed' ? 'red' as const : s === 'stopped' ? 'grey' as const : 'blue' as const;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name"><strong>{r.name}</strong></Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Power">{r.power_state ? <Label color={powerColor(r.power_state)}>{r.power_state}</Label> : '-'}</Td>
      <Td dataLabel="CPUs">{r.cpu_count ?? '-'}</Td>
      <Td dataLabel="Memory">{r.memory_mb ? (r.memory_mb / 1024).toFixed(1) + ' GB' : '-'}</Td>
      <Td dataLabel="Disk">{r.disk_gb ? r.disk_gb + ' GB' : '-'}</Td>
      <Td dataLabel="IP Addresses">{r.ip_addresses?.length ? r.ip_addresses.join(', ') : '-'}</Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
    </Tr>
  );
}

function ComputeTable({ resources }: { resources: Resource[] }) {
  return (
    <Table aria-label="Compute" variant="compact">
      <Thead><Tr>
        <Th width={20}>Name</Th>
        <Th width={12}>Type</Th>
        <Th width={8}>State</Th>
        <Th width={10}>Power</Th>
        <Th width={5}>CPUs</Th>
        <Th width={8}>Memory</Th>
        <Th width={7}>Disk</Th>
        <Th width={15}>IP Addresses</Th>
        <Th width={10}>Region</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <ComputeRow key={r.id} r={r} />)}</Tbody>
    </Table>
  );
}

function StorageRow({ r }: { r: Resource }) {
  const stateColor = (s: string) => s === 'active' ? 'green' as const : s === 'error' ? 'red' as const : 'grey' as const;
  const props = r.properties as Record<string, number | string> ?? {};
  const capacityGb = props.capacity_gb as number ?? r.disk_gb;
  const freeGb = props.free_space_gb as number ?? null;
  const provPct = props.provisioned_pct as number ?? null;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name"><strong>{r.name}</strong></Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Capacity">{capacityGb ? capacityGb + ' GB' : '-'}</Td>
      <Td dataLabel="Free Space">{freeGb != null ? freeGb + ' GB' : '-'}</Td>
      <Td dataLabel="Used">{freeGb != null && capacityGb ? (capacityGb - freeGb) + ' GB' : '-'}</Td>
      <Td dataLabel="Provisioned">{provPct != null ? provPct + '%' : '-'}</Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
    </Tr>
  );
}

function StorageTable({ resources }: { resources: Resource[] }) {
  return (
    <Table aria-label="Storage" variant="compact">
      <Thead><Tr>
        <Th width={20}>Name</Th>
        <Th width={15}>Type</Th>
        <Th width={8}>State</Th>
        <Th width={10}>Capacity</Th>
        <Th width={10}>Free Space</Th>
        <Th width={10}>Used</Th>
        <Th width={12}>Provisioned</Th>
        <Th width={15}>Region</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <StorageRow key={r.id} r={r} />)}</Tbody>
    </Table>
  );
}

function NetworkingRow({ r }: { r: Resource }) {
  const stateColor = (s: string) => s === 'active' ? 'green' as const : s === 'error' ? 'red' as const : 'grey' as const;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name"><strong>{r.name}</strong></Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
      <Td dataLabel="Zone">{r.availability_zone || '-'}</Td>
      <Td dataLabel="Tenant">{r.cloud_tenant || '-'}</Td>
    </Tr>
  );
}

function NetworkingTable({ resources }: { resources: Resource[] }) {
  return (
    <Table aria-label="Networking" variant="compact">
      <Thead><Tr>
        <Th width={25}>Name</Th>
        <Th width={20}>Type</Th>
        <Th width={10}>State</Th>
        <Th width={15}>Region</Th>
        <Th width={15}>Zone</Th>
        <Th width={15}>Tenant</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <NetworkingRow key={r.id} r={r} />)}</Tbody>
    </Table>
  );
}

function GenericRow({ r }: { r: Resource }) {
  const stateColor = (s: string) => s === 'active' || s === 'running' ? 'green' as const : s === 'error' || s === 'failed' ? 'red' as const : 'grey' as const;
  return (
    <Tr key={r.id}>
      <Td dataLabel="Name"><strong>{r.name}</strong></Td>
      <Td dataLabel="Type">{r.vendor_type || r.resource_type_slug}</Td>
      <Td dataLabel="State">{r.state ? <Label color={stateColor(r.state)}>{r.state}</Label> : '-'}</Td>
      <Td dataLabel="Region">{r.region || '-'}</Td>
      <Td dataLabel="First Discovered">{r.first_discovered_at ? new Date(r.first_discovered_at).toLocaleDateString() : '-'}</Td>
      <Td dataLabel="Last Seen">{r.last_seen_at ? new Date(r.last_seen_at).toLocaleDateString() : '-'}</Td>
    </Tr>
  );
}

function GenericTable({ resources, label }: { resources: Resource[]; label: string }) {
  return (
    <Table aria-label={label} variant="compact">
      <Thead><Tr>
        <Th width={25}>Name</Th>
        <Th width={20}>Type</Th>
        <Th width={10}>State</Th>
        <Th width={15}>Region</Th>
        <Th width={15}>First Discovered</Th>
        <Th width={15}>Last Seen</Th>
      </Tr></Thead>
      <Tbody>{resources.map((r) => <GenericRow key={r.id} r={r} />)}</Tbody>
    </Table>
  );
}

// ?? Page ??????????????????????????????????????????????????????????????????

export default function InventoryList() {
  const { providerId, categorySlug } = useParams<{ providerId: string; categorySlug: string }>();
  const [category, setCategory] = useState<ResourceCategory | null>(null);
  const [typeIds, setTypeIds] = useState<Set<string> | null>(null);

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

  const fetchResources = useCallback(() => {
    if (!providerId) return Promise.resolve({ count: 0, next: null, previous: null, results: [] });
    return api.listResources('page_size=500');
  }, [providerId]);

  const { data, loading } = usePolling(fetchResources, 30000);

  const resources: Resource[] = (data?.results ?? []).filter((r) => r.provider === providerId &&
    (typeIds ? typeIds.has(r.resource_type) : true)
  );

  const categoryTitle = category?.name ?? categorySlug ?? 'Resources';

  if (loading && !data) {
    return <Bullseye style={{ marginTop: '4rem' }}><Spinner size="xl" /></Bullseye>;
  }

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">{categoryTitle}</Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          {resources.length} {categoryTitle.toLowerCase()} discovered
          {loading && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>refreshing...</span>}
        </p>
      </PageSection>
      <PageSection>
        {resources.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <Title headingLevel="h2" size="lg">No {categoryTitle.toLowerCase()} found</Title>
            <EmptyStateBody>
              Run a collection on this provider to discover resources.
            </EmptyStateBody>
          </EmptyState>
        ) : categorySlug === 'compute' ? (
          <ComputeTable resources={resources} />
        ) : categorySlug === 'storage' ? (
          <StorageTable resources={resources} />
        ) : categorySlug === 'networking' ? (
          <NetworkingTable resources={resources} />
        ) : (
          <GenericTable resources={resources} label={categoryTitle} />
        )}
      </PageSection>
    </>
  );
}
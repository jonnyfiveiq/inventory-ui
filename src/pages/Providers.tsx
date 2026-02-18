import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Bullseye,
  Label,
  PageSection,
  Spinner,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
} from '@patternfly/react-table';
import { api } from '../api/client';
import type { Provider, PaginatedResponse } from '../api/client';
import { usePolling } from '../hooks/usePolling';

export default function ProvidersPage() {
  const navigate = useNavigate();
  const [collecting, setCollecting] = useState<Set<string>>(new Set());

  const fetchProviders = useCallback(() => api.listProviders(), []);
  const { data, loading, refresh } = usePolling<PaginatedResponse<Provider>>(
    fetchProviders,
    10000
  );

  const providers = data?.results ?? [];

  const handleCollect = async (providerId: string) => {
    setCollecting((prev) => new Set(prev).add(providerId));
    try {
      const run = await api.triggerCollection(providerId);
      navigate('/collection-runs/' + run.id);
    } catch (e) {
      console.error('Failed to trigger collection:', e);
    } finally {
      setCollecting((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    }
  };

  const statusColor = (status: string | null) => {
    if (status === 'completed') return 'green' as const;
    if (status === 'failed') return 'red' as const;
    if (status === 'running' || status === 'pending') return 'blue' as const;
    return 'grey' as const;
  };

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
              <Button variant="plain" onClick={refresh} aria-label="Refresh">
                <SyncAltIcon /> Refresh
              </Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>
                {data?.count ?? 0} providers
              </span>
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
                <Th width={15}>Endpoint</Th>
                <Th width={10}>Enabled</Th>
                <Th width={15}>Last Collection</Th>
                <Th width={15}>Actions</Th>
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
                    {p.last_collection_status ? (
                      <Label color={statusColor(p.last_collection_status)}>{p.last_collection_status}</Label>
                    ) : '-'}
                  </Td>
                  <Td dataLabel="Actions">
                    <Button variant="secondary" size="sm" isLoading={collecting.has(p.id)} isDisabled={!p.enabled || collecting.has(p.id)} onClick={() => handleCollect(p.id)}>Collect Now</Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </PageSection>
    </>
  );
}

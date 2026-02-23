import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bullseye,
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  PageSection,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Spinner,
  Tooltip,
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
import type { CollectionRun, PaginatedResponse } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { StatusLabel, formatDuration, formatTimestamp } from '../components/StatusLabel';
import { ResourceStats } from '../components/ResourceStats';

export default function CollectionRunsPage() {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  const fetchRuns = useCallback(() => api.listCollectionRuns(), []);

  const { data, loading, refresh } = usePolling<PaginatedResponse<CollectionRun>>(
    fetchRuns,
    3000
  );

  const runs = data?.results ?? [];
  const hasActiveRuns = runs.some((r) => r.status === 'pending' || r.status === 'running');

  const handleCancel = async (runId: string) => {
    setCancelling((prev) => new Set(prev).add(runId));
    try {
      await api.cancelCollectionRun(runId);
      refresh();
    } catch {
    } finally {
      setCancelling((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  };

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">Collection Runs</Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Inventory collection tasks dispatched to the worker.
          {hasActiveRuns && ' Auto-refreshing every 3 seconds.'}
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
                {data?.count ?? 0} total runs
              </span>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {loading && !data ? (
          <Bullseye><Spinner size="xl" /></Bullseye>
        ) : runs.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <Title headingLevel="h2" size="lg">No collection runs yet</Title>
            <EmptyStateBody>Trigger a collection from the Providers page to see runs here.</EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="primary" onClick={() => navigate('/providers')}>Go to Providers</Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        ) : (
          <Table aria-label="Collection runs" variant="compact">
            <Thead>
              <Tr>
                <Th width={15}>Status</Th>
                <Th width={15}>Started</Th>
                <Th width={10}>Duration</Th>
                <Th width={30}>Resources</Th>
                <Th width={15}>Version</Th>
                <Th width={15}>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {runs.map((run) => (
                <Tr
                  key={run.id}
                  isClickable
                  onRowClick={() => navigate('/collection-runs/' + run.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Td dataLabel="Status"><StatusLabel status={run.status} /></Td>
                  <Td dataLabel="Started">{formatTimestamp(run.started_at)}</Td>
                  <Td dataLabel="Duration">{formatDuration(run.duration_seconds)}</Td>
                  <Td dataLabel="Resources"><ResourceStats run={run} compact /></Td>
                  <Td dataLabel="Version">{run.collector_version || '-'}</Td>
                  <Td dataLabel="Actions" onClick={(e) => e.stopPropagation()}>
                    {(run.status === 'pending' || run.status === 'running') && (
                      <Tooltip content="Cancel this collection run">
                        <Button variant="link" isDanger isLoading={cancelling.has(run.id)} onClick={() => handleCancel(run.id)}>Cancel</Button>
                      </Tooltip>
                    )}
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

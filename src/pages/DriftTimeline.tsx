import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, Bullseye, EmptyState, EmptyStateBody,
  EmptyStateVariant, Flex, FlexItem, Label, PageSection, Spinner, Title,
} from '@patternfly/react-core';
import {
  ArrowCircleUpIcon, CheckCircleIcon, ExclamationTriangleIcon, TrashIcon,
} from '@patternfly/react-icons';
import { api } from '../api/client';
import type { ResourceDrift, DriftType, DriftChange } from '../api/client';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

type DriftColor = 'orange' | 'red' | 'green';

const DRIFT_META: Record<DriftType, { color: DriftColor; icon: React.ReactElement; label: string }> = {
  modified: { color: 'orange', icon: <ExclamationTriangleIcon />, label: 'Modified' },
  deleted:  { color: 'red',    icon: <TrashIcon />,               label: 'Deleted'  },
  restored: { color: 'green',  icon: <ArrowCircleUpIcon />,        label: 'Restored' },
};

function DriftEvent({ event }: { event: ResourceDrift }) {
  const meta = DRIFT_META[event.drift_type];
  const changeEntries = Object.entries(event.changes);
  const borderColor = meta.color === 'orange' ? '#f0ab00' : meta.color === 'red' ? '#c9190b' : '#3e8635';
  return (
    <div style={{ marginBottom: '0.75rem', borderLeft: `3px solid ${borderColor}`, paddingLeft: '0.75rem' }}>
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem><Label color={meta.color} icon={meta.icon} isCompact>{meta.label}</Label></FlexItem>
        <FlexItem><span style={{ fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>detected {fmt(event.detected_at)}</span></FlexItem>
      </Flex>
      {event.drift_type === 'modified' && changeEntries.length > 0 && (
        <table style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)' }}>
            <th style={{ textAlign: 'left', padding: '2px 8px 2px 0', color: 'var(--pf-v5-global--Color--200)', fontWeight: 500 }}>Field</th>
            <th style={{ textAlign: 'left', padding: '2px 8px', color: 'var(--pf-v5-global--Color--200)', fontWeight: 500 }}>Before</th>
            <th style={{ textAlign: 'left', padding: '2px 0', color: 'var(--pf-v5-global--Color--200)', fontWeight: 500 }}>After</th>
          </tr></thead>
          <tbody>{changeEntries.map(([field, change]) => (
            <tr key={field}>
              <td style={{ padding: '3px 8px 3px 0', fontFamily: 'monospace', fontWeight: 600 }}>{field}</td>
              <td style={{ padding: '3px 8px', color: '#c9190b', fontFamily: 'monospace' }}>{fmtVal(change.from)}</td>
              <td style={{ padding: '3px 0', color: '#3e8635', fontFamily: 'monospace' }}>{fmtVal(change.to)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

function TimelineEntry({ runId, runStartedAt, events, isLast }: {
  runId: string; runStartedAt: string; events: ResourceDrift[]; isLast: boolean;
}) {
  const hasEvents = events.length > 0;
  const dotColor = hasEvents
    ? events.some(e => e.drift_type === 'deleted') ? '#c9190b'
    : events.some(e => e.drift_type === 'restored') ? '#3e8635'
    : '#f0ab00'
    : 'var(--pf-v5-global--BorderColor--100)';
  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: isLast ? 0 : '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: dotColor, border: `2px solid ${dotColor}`, flexShrink: 0, marginTop: 3 }} />
        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: 'var(--pf-v5-global--BorderColor--100)', marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : '0.5rem' }}>
        <div style={{ marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmt(runStartedAt)}</span>
          {!hasEvents && (
            <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>
              <CheckCircleIcon style={{ marginRight: 4, color: '#3e8635' }} /> No drift
            </span>
          )}
          <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--pf-v5-global--Color--200)' }}>
            {runId.slice(0, 8)}
          </span>
        </div>
        {events.map((e) => <DriftEvent key={e.id} event={e} />)}
      </div>
    </div>
  );
}

export default function DriftTimeline() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [driftEvents, setDriftEvents] = useState<ResourceDrift[]>([]);
  const [resourceName, setResourceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getResource(id),
      api.listResourceDrift('resource=' + id + '&page_size=200'),
    ])
      .then(([res, drift]) => {
        setResourceName(res.name);
        setDriftEvents(drift.results);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const runOrder: string[] = [];
  const byRun: Record<string, { startedAt: string; events: ResourceDrift[] }> = {};
  for (const ev of driftEvents) {
    if (!byRun[ev.collection_run]) {
      runOrder.push(ev.collection_run);
      byRun[ev.collection_run] = { startedAt: ev.collection_run_started_at, events: [] };
    }
    byRun[ev.collection_run].events.push(ev);
  }

  const modifiedCount = driftEvents.filter(e => e.drift_type === 'modified').length;
  const deletedCount  = driftEvents.filter(e => e.drift_type === 'deleted').length;
  const restoredCount = driftEvents.filter(e => e.drift_type === 'restored').length;

  return (
    <>
      <PageSection variant="light" style={{ paddingBottom: '0.75rem' }}>
        <Breadcrumb style={{ marginBottom: '0.5rem' }}>
          <BreadcrumbItem style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>Resources</BreadcrumbItem>
          <BreadcrumbItem style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>{resourceName || 'Resource'}</BreadcrumbItem>
          <BreadcrumbItem isActive>Drift Timeline</BreadcrumbItem>
        </Breadcrumb>
        <Title headingLevel="h1" size="2xl">Drift Timeline</Title>
        {resourceName && (
          <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
            {resourceName}
          </p>
        )}
        {!loading && !error && driftEvents.length > 0 && (
          <Flex spaceItems={{ default: 'spaceItemsMd' }} style={{ marginTop: '0.5rem' }}>
            {modifiedCount > 0 && <FlexItem><Label color="orange" icon={<ExclamationTriangleIcon />} isCompact>{modifiedCount} modified</Label></FlexItem>}
            {deletedCount > 0  && <FlexItem><Label color="red"    icon={<TrashIcon />}               isCompact>{deletedCount} deleted</Label></FlexItem>}
            {restoredCount > 0 && <FlexItem><Label color="green"  icon={<ArrowCircleUpIcon />}        isCompact>{restoredCount} restored</Label></FlexItem>}
          </Flex>
        )}
      </PageSection>
      <PageSection>
        {loading && <Bullseye style={{ padding: '3rem' }}><Spinner size="xl" /></Bullseye>}
        {error && (
          <EmptyState variant={EmptyStateVariant.sm}>
            <Title headingLevel="h3" size="md">Failed to load drift history</Title>
            <EmptyStateBody>{error}</EmptyStateBody>
          </EmptyState>
        )}
        {!loading && !error && driftEvents.length === 0 && (
          <EmptyState variant={EmptyStateVariant.sm}>
            <Title headingLevel="h3" size="md">No drift detected</Title>
            <EmptyStateBody>This resource has not changed between any collection runs.</EmptyStateBody>
          </EmptyState>
        )}
        {!loading && !error && runOrder.length > 0 && (
          <div style={{ maxWidth: '800px', padding: '0.5rem 0' }}>
            {runOrder.map((runId, idx) => (
              <TimelineEntry
                key={runId}
                runId={runId}
                runStartedAt={byRun[runId].startedAt}
                events={byRun[runId].events}
                isLast={idx === runOrder.length - 1}
              />
            ))}
          </div>
        )}
      </PageSection>
    </>
  );
}

import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, Button, Card, CardBody, CardTitle,
  CodeBlock, CodeBlockCode, DescriptionList, DescriptionListDescription,
  DescriptionListGroup, DescriptionListTerm, Divider, Flex, FlexItem,
  Grid, GridItem, PageSection, Progress, ProgressMeasureLocation,
  ProgressVariant, Spinner, Title, Bullseye,
} from '@patternfly/react-core';
import { api } from '../api/client';
import type { CollectionRun } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { StatusLabel, formatDuration, formatTimestamp } from '../components/StatusLabel';

export default function CollectionRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const fetchRun = useCallback(() => api.getCollectionRun(id!), [id]);
  const isActive = (r: CollectionRun | null) => r?.status === 'pending' || r?.status === 'running';
  const { data: run, loading, refresh } = usePolling<CollectionRun>(fetchRun, 2000);

  const handleCancel = async () => {
    if (!run) return;
    setCancelling(true);
    try { await api.cancelCollectionRun(run.id); refresh(); } catch {} finally { setCancelling(false); }
  };

  if (loading && !run) return <PageSection><Bullseye><Spinner size="xl" /></Bullseye></PageSection>;
  if (!run) return <PageSection><Title headingLevel="h1">Collection run not found</Title></PageSection>;

  const progressValue = run.status === 'completed' ? 100 : run.status === 'failed' || run.status === 'canceled' ? 100 : run.resources_found > 0 ? Math.min(95, run.resources_found * 5) : 10;
  const progressVariant = run.status === 'completed' ? undefined : run.status === 'failed' ? ProgressVariant.danger : run.status === 'canceled' ? ProgressVariant.warning : undefined;

  return (
    <>
      <PageSection variant="light">
        <Breadcrumb>
          <BreadcrumbItem to="#" onClick={(e) => { e.preventDefault(); navigate('/collection-runs'); }}>Collection Runs</BreadcrumbItem>
          <BreadcrumbItem isActive>{run.id.slice(0, 8)}...</BreadcrumbItem>
        </Breadcrumb>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }} style={{ marginTop: '1rem' }}>
          <FlexItem>
            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
              <FlexItem><Title headingLevel="h1" size="2xl">Collection Run</Title></FlexItem>
              <FlexItem><StatusLabel status={run.status} /></FlexItem>
              {isActive(run) && <FlexItem><Spinner size="md" /></FlexItem>}
            </Flex>
          </FlexItem>
          <FlexItem>{isActive(run) && <Button variant="danger" isLoading={cancelling} onClick={handleCancel}>Cancel Run</Button>}</FlexItem>
        </Flex>
      </PageSection>
      <PageSection>
        <Progress value={progressValue} title={isActive(run) ? 'Collecting... ' + run.resources_found + ' resources found' : run.status === 'completed' ? 'Completed - ' + run.resources_found + ' resources' : run.status} variant={progressVariant} measureLocation={ProgressMeasureLocation.outside} style={{ marginBottom: '1.5rem' }} />
        <Grid hasGutter>
          <GridItem md={6}>
            <Card><CardTitle>Run Details</CardTitle><CardBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup><DescriptionListTerm>Run ID</DescriptionListTerm><DescriptionListDescription><code>{run.id}</code></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Task UUID</DescriptionListTerm><DescriptionListDescription><code>{run.task_uuid}</code></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Collection type</DescriptionListTerm><DescriptionListDescription>{run.collection_type}</DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Collector version</DescriptionListTerm><DescriptionListDescription>{run.collector_version || '-'}</DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Started</DescriptionListTerm><DescriptionListDescription>{formatTimestamp(run.started_at)}</DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Completed</DescriptionListTerm><DescriptionListDescription>{formatTimestamp(run.completed_at)}</DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Duration</DescriptionListTerm><DescriptionListDescription>{formatDuration(run.duration_seconds)}</DescriptionListDescription></DescriptionListGroup>
              </DescriptionList>
            </CardBody></Card>
          </GridItem>
          <GridItem md={6}>
            <Card><CardTitle>Resources</CardTitle><CardBody>
              <DescriptionList isHorizontal columnModifier={{ default: '2Col' }}>
                <DescriptionListGroup><DescriptionListTerm>Found</DescriptionListTerm><DescriptionListDescription><strong style={{ fontSize: '1.5rem' }}>{run.resources_found}</strong></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Created</DescriptionListTerm><DescriptionListDescription><strong style={{ fontSize: '1.5rem', color: 'green' }}>{run.resources_created}</strong></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Updated</DescriptionListTerm><DescriptionListDescription><strong style={{ fontSize: '1.5rem', color: 'blue' }}>{run.resources_updated}</strong></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Removed</DescriptionListTerm><DescriptionListDescription><strong style={{ fontSize: '1.5rem' }}>{run.resources_removed}</strong></DescriptionListDescription></DescriptionListGroup>
              </DescriptionList>
            </CardBody></Card>
          </GridItem>
          {run.error_message && (
            <GridItem span={12}>
              <Card><CardTitle><span style={{ color: 'red' }}>Error</span></CardTitle><CardBody>
                <p style={{ marginBottom: '1rem' }}>{run.error_message}</p>
                {run.result_traceback && (<><Divider style={{ marginBottom: '1rem' }} /><CodeBlock><CodeBlockCode>{run.result_traceback}</CodeBlockCode></CodeBlock></>)}
              </CardBody></Card>
            </GridItem>
          )}
        </Grid>
      </PageSection>
    </>
  );
}

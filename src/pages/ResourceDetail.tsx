import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, Bullseye, Button,
  Card, CardBody, CardTitle,
  DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
  Flex, FlexItem, Label, LabelGroup, PageSection, Spinner, Title, Tabs, Tab, TabTitleText,
} from '@patternfly/react-core';
import {
  ArrowCircleUpIcon, AutomationIcon, CodeIcon, CopyIcon, ExclamationTriangleIcon, TrashIcon,
} from '@patternfly/react-icons';
import { api } from '../api/client';
import type { Resource, Tag, ResourceDrift } from '../api/client';
import AutomationTimeline from '../components/AutomationTimeline';

function fmt(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Val({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>{'\u2014'}</span>;
  if (typeof v === 'boolean') return <Label isCompact color={v ? 'green' : 'grey'}>{String(v)}</Label>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>none</span>;
    return <LabelGroup isCompact numLabels={10}>{v.map((x, i) => <Label key={i} isCompact>{String(x)}</Label>)}</LabelGroup>;
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>none</span>;
    return (
      <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  }
  const s = String(v);
  if (!s) return <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>{'\u2014'}</span>;
  return <>{s}</>;
}

function TagBadge({ t }: { t: Tag }) {
  const color =
    t.namespace === 'type' && t.key === 'infrastructure_bucket' ? 'blue' as const :
    t.namespace === 'type' && t.key === 'device_type' ? 'cyan' as const :
    t.namespace === 'type' && t.key === 'infrastructure_type' ? 'purple' as const : 'grey' as const;
  return <Label isCompact color={color}>{t.value ? `${t.key}=${t.value}` : t.key}</Label>;
}

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [driftEvents, setDriftEvents] = useState<ResourceDrift[]>([]);
  const [driftLoading, setDriftLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api.getResource(id)
      .then(setResource)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setDriftLoading(true);
    api.listResourceDrift('resource=' + id + '&page_size=50')
      .then((r) => setDriftEvents(r.results))
      .catch(() => {})
      .finally(() => setDriftLoading(false));
  }, [id]);

  if (loading) return <Bullseye style={{ marginTop: '4rem' }}><Spinner size="xl" /></Bullseye>;
  if (error || !resource) return (
    <PageSection><p style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>{error || 'Resource not found'}</p></PageSection>
  );

  const r = resource;

  const identity = [
    ['Name', r.name],
    ['Description', r.description],
    ['Resource Type', r.resource_type_name || r.resource_type_slug],
    ['Vendor Type', r.vendor_type],
    ['Provider', r.provider_name],
    ['EMS Ref', r.ems_ref],
    ['Canonical ID', r.canonical_id],
  ];

  const infra = [
    ['State', r.state],
    ['Power State', r.power_state],
    ['Region', r.region],
    ['Availability Zone', r.availability_zone],
    ['Cloud Tenant', r.cloud_tenant],
    ['Flavor', r.flavor],
  ];

  const compute = [
    ['CPU Count', r.cpu_count],
    ['Memory (MB)', r.memory_mb],
    ['Disk (GB)', r.disk_gb],
    ['OS Type', r.os_type],
    ['OS Name', r.os_name],
    ['Boot Time', fmt(r.boot_time)],
  ];

  const network = [
    ['IP Addresses', r.ip_addresses],
    ['FQDN', r.fqdn],
    ['MAC Addresses', r.mac_addresses],
  ];

  const ansible = [
    ['Ansible Host', r.ansible_host],
    ['Ansible Connection', r.ansible_connection],
    ['Inventory Group', r.inventory_group],
  ];

  const tracking = [
    ['First Discovered', fmt(r.first_discovered_at)],
    ['Last Seen', fmt(r.last_seen_at)],
    ['Seen Count', r.seen_count],
    ['EMS Created On', fmt(r.ems_created_on)],
    ['Is Deleted', r.is_deleted],
    ['Deleted At', fmt(r.deleted_at)],
  ];

  const renderSection = (title: string, fields: [string, unknown][]) => (
    <Card isCompact style={{ marginBottom: '1rem' }}>
      <CardTitle>{title}</CardTitle>
      <CardBody>
        <DescriptionList isHorizontal isCompact termWidth="180px">
          {fields.map(([label, value]) => (
            <DescriptionListGroup key={label}>
              <DescriptionListTerm>{label}</DescriptionListTerm>
              <DescriptionListDescription><Val v={value} /></DescriptionListDescription>
            </DescriptionListGroup>
          ))}
        </DescriptionList>
      </CardBody>
    </Card>
  );

  const hasDrift = driftEvents.length > 0;

  return (
    <>
      <PageSection variant="light" style={{ paddingBottom: '0.75rem' }}>
        <Breadcrumb style={{ marginBottom: '0.5rem' }}>
          <BreadcrumbItem style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>Resources</BreadcrumbItem>
          <BreadcrumbItem isActive>{r.name}</BreadcrumbItem>
        </Breadcrumb>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">{r.name}</Title>
          </FlexItem>
          {r.power_state && (
            <FlexItem>
              <Label isCompact color={r.power_state === 'on' ? 'green' : 'grey'}>{r.power_state}</Label>
            </FlexItem>
          )}
          {r.is_automated && (
            <FlexItem>
              <Label isCompact color="teal" icon={<AutomationIcon />}>
                {r.automation_count} automation{r.automation_count !== 1 ? 's' : ''}
              </Label>
            </FlexItem>
          )}
          {hasDrift && (
            <FlexItem>
              <Label isCompact color="orange" icon={<ExclamationTriangleIcon />}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/resources/${r.id}/drift`)}>
                {driftEvents.length} drift event{driftEvents.length !== 1 ? 's' : ''}
              </Label>
            </FlexItem>
          )}
        </Flex>
        <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
          {r.resource_type_name || r.resource_type_slug} &middot; {r.provider_name}
        </p>
      </PageSection>

      <PageSection>
        <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k as number)}>
          <Tab eventKey={0} title={<TabTitleText>Properties</TabTitleText>}>
            <div style={{ marginTop: '1rem' }}>
              {renderSection('Identity', identity)}
              {renderSection('Infrastructure', infra)}
              {renderSection('Compute', compute)}
              {renderSection('Network', network)}
              {renderSection('Ansible', ansible)}
              {renderSection('Tracking', tracking)}
              {Object.keys(r.vendor_identifiers ?? {}).length > 0 && renderSection('Vendor Identifiers', Object.entries(r.vendor_identifiers))}
              {Object.keys(r.properties ?? {}).length > 0 && renderSection('Custom Properties', Object.entries(r.properties))}
              {Object.keys(r.provider_tags ?? {}).length > 0 && renderSection('Provider Tags', Object.entries(r.provider_tags))}
            </div>
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>Tags ({(r.tags ?? []).length})</TabTitleText>}>
            <div style={{ marginTop: '1rem' }}>
              {(r.tags ?? []).length === 0 ? (
                <p style={{ color: 'var(--pf-v5-global--Color--200)' }}>No tags assigned.</p>
              ) : (
                <LabelGroup numLabels={50}>
                  {(r.tags ?? []).map((t) => <TagBadge key={t.id} t={t} />)}
                </LabelGroup>
              )}
            </div>
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>Automations ({r.automation_count ?? 0})</TabTitleText>}>
            <AutomationTimeline resourceId={r.id} resourceName={r.name} />
          </Tab>
        </Tabs>
      </PageSection>
    </>
  );
}

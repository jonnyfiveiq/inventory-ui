import { useEffect, useState } from 'react';
import {
  Bullseye, Card, CardBody, CardTitle,
  DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
  EmptyState, EmptyStateBody, EmptyStateVariant,
  Label, Spinner, Title, Flex, FlexItem, Tooltip,
} from '@patternfly/react-core';
import {
  Table, Thead, Tr, Th, Tbody, Td,
  ExpandableRowContent,
} from '@patternfly/react-table';
import {
  CheckCircleIcon, TimesCircleIcon, ClockIcon,
  LinkIcon, InfoCircleIcon,
} from '@patternfly/react-icons';
import { api } from '../api/client';
import type { AutomationRecord } from '../api/client';

function fmt(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function JobStatusLabel({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'successful' || s === 'ok')
    return <Label isCompact color="green" icon={<CheckCircleIcon />}>{status}</Label>;
  if (s === 'failed' || s === 'error')
    return <Label isCompact color="red" icon={<TimesCircleIcon />}>{status}</Label>;
  if (s === 'running' || s === 'pending' || s === 'waiting')
    return <Label isCompact color="blue" icon={<ClockIcon />}>{status}</Label>;
  return <Label isCompact color="grey">{status}</Label>;
}

interface Props {
  resourceId: string;
  resourceName?: string;
}

export default function AutomationTimeline({ resourceId }: Props) {
  const [records, setRecords] = useState<AutomationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    api.getResourceAutomations(resourceId, 'page_size=100')
      .then((r) => setRecords(r.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resourceId]);

  if (loading) return <Bullseye style={{ marginTop: '2rem' }}><Spinner size="lg" /></Bullseye>;

  if (records.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.lg}>
        <Title headingLevel="h3" size="lg">No automations detected</Title>
        <EmptyStateBody>
          No Ansible automation history has been correlated with this resource yet.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  // Summary stats
  const firstJob = records.reduce((a, b) =>
    (a.aap_job_started_at ?? '') < (b.aap_job_started_at ?? '') ? a : b
  );
  const lastJob = records.reduce((a, b) =>
    (a.aap_job_started_at ?? '') > (b.aap_job_started_at ?? '') ? a : b
  );
  const successCount = records.filter((r) => r.aap_job_status.toLowerCase() === 'successful').length;
  const failedCount = records.filter((r) => r.aap_job_status.toLowerCase() === 'failed').length;
  const uniqueJobs = new Set(records.map((r) => r.aap_job_name)).size;
  const sources = [...new Set(records.map((r) => r.source_name).filter(Boolean))];

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Summary card */}
      <Card isCompact style={{ marginBottom: '1rem' }}>
        <CardTitle>Automation Summary</CardTitle>
        <CardBody>
          <DescriptionList isHorizontal isCompact columnModifier={{ default: '3Col' }}>
            <DescriptionListGroup>
              <DescriptionListTerm>Total Runs</DescriptionListTerm>
              <DescriptionListDescription>
                <strong>{records.length}</strong>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Unique Jobs</DescriptionListTerm>
              <DescriptionListDescription>{uniqueJobs}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>AAP Source</DescriptionListTerm>
              <DescriptionListDescription>{sources.join(', ') || '\u2014'}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>First Automated</DescriptionListTerm>
              <DescriptionListDescription>
                {fmt(firstJob.aap_job_started_at)}
                <span style={{ color: 'var(--pf-v5-global--Color--200)', marginLeft: '0.5rem', fontSize: '0.82rem' }}>
                  {relativeTime(firstJob.aap_job_started_at)}
                </span>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Last Automated</DescriptionListTerm>
              <DescriptionListDescription>
                {fmt(lastJob.aap_job_started_at)}
                <span style={{ color: 'var(--pf-v5-global--Color--200)', marginLeft: '0.5rem', fontSize: '0.82rem' }}>
                  {relativeTime(lastJob.aap_job_started_at)}
                </span>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Success Rate</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <Label isCompact color="green">{successCount} passed</Label>
                  </FlexItem>
                  {failedCount > 0 && (
                    <FlexItem>
                      <Label isCompact color="red">{failedCount} failed</Label>
                    </FlexItem>
                  )}
                </Flex>
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>

      {/* Job history table */}
      <Card isCompact>
        <CardTitle>Automation History</CardTitle>
        <CardBody>
          <Table aria-label="Automation history" variant="compact">
            <Thead>
              <Tr>
                <Th />
                <Th width={22}>Job Name</Th>
                <Th width={10}>Status</Th>
                <Th width={10}>Match</Th>
                <Th width={13}>Started</Th>
                <Th width={13}>Finished</Th>
                <Th width={10}>AAP Host</Th>
                <Th width={12}>Source</Th>
              </Tr>
            </Thead>
            {records.map((rec, idx) => {
              const details = rec.automation_details || {};
              const matchReason = details.match_reason || '';
              const matchConf = details.match_confidence || 0;
              const corrKey = rec.correlation_key || '';
              const corrParts = corrKey.split(':');
              const corrType = corrParts[0];
              const corrValue = corrParts.slice(1).join(':');
              const isSmbios = corrType === 'smbios';

              const matchColor = matchConf >= 95 ? 'green' as const
                : matchConf >= 80 ? 'teal' as const
                : matchConf >= 50 ? 'orange' as const : 'grey' as const;
              const matchLabel = isSmbios ? 'SMBIOS' : corrType === 'hostname' ? 'Name' : corrType || 'Unknown';

              return (
                <Tbody key={rec.id} isExpanded={expandedRows.includes(rec.id)}>
                  <Tr>
                    <Td
                      expand={{
                        rowIndex: idx,
                        isExpanded: expandedRows.includes(rec.id),
                        onToggle: () => setExpandedRows((prev) =>
                          prev.includes(rec.id) ? prev.filter((x) => x !== rec.id) : [...prev, rec.id]
                        ),
                      }}
                    />
                    <Td dataLabel="Job Name">
                      <span style={{ fontWeight: 600 }}>{rec.aap_job_name || `Job #${rec.aap_job_id}`}</span>
                    </Td>
                    <Td dataLabel="Status">
                      <JobStatusLabel status={rec.aap_job_status} />
                    </Td>
                    <Td dataLabel="Match">
                      <Tooltip content={matchReason || 'No match details'}>
                        <Label isCompact color={matchColor} icon={<LinkIcon />}>
                          {matchLabel} ({matchConf}%)
                        </Label>
                      </Tooltip>
                    </Td>
                    <Td dataLabel="Started">{fmt(rec.aap_job_started_at)}</Td>
                    <Td dataLabel="Finished">{fmt(rec.aap_job_finished_at)}</Td>
                    <Td dataLabel="AAP Host">{rec.aap_host_name}</Td>
                    <Td dataLabel="Source">{rec.source_name || '\u2014'}</Td>
                  </Tr>
                  <Tr isExpanded={expandedRows.includes(rec.id)}>
                    <Td colSpan={8} noPadding>
                      <ExpandableRowContent>
                        <div style={{ padding: '1rem 1.5rem', background: 'var(--pf-v5-global--BackgroundColor--200)' }}>
                          <Title headingLevel="h4" size="md" style={{ marginBottom: '0.75rem' }}>
                            <InfoCircleIcon style={{ marginRight: '0.4rem' }} />
                            Correlation Details
                          </Title>
                          <DescriptionList isHorizontal isCompact termWidth="200px" columnModifier={{ default: '2Col' }}>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Match Strategy</DescriptionListTerm>
                              <DescriptionListDescription>{matchReason || '\u2014'}</DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Confidence</DescriptionListTerm>
                              <DescriptionListDescription>
                                <Label isCompact color={matchColor}>{matchConf}%</Label>
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Correlation Type</DescriptionListTerm>
                              <DescriptionListDescription>
                                <Label isCompact color={rec.correlation_type === 'direct' ? 'blue' : 'purple'}>
                                  {rec.correlation_type}
                                </Label>
                                {' \u2014 '}
                                {rec.correlation_type === 'direct'
                                  ? 'Host-level automation (SSH/WinRM)'
                                  : 'API/cloud-managed resource'}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Correlation Key</DescriptionListTerm>
                              <DescriptionListDescription>
                                <code style={{ fontSize: '0.85rem' }}>{corrKey}</code>
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            {isSmbios && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>How It Matched</DescriptionListTerm>
                                <DescriptionListDescription>
                                  <div style={{ fontSize: '0.88rem', lineHeight: '1.6' }}>
                                    <strong>Ansible Facts</strong>{' '}
                                    <code>ansible_machine_id</code> / <code>ansible_product_serial</code>
                                    {' \u2192 '}
                                    <strong>VMware</strong>{' '}
                                    <code>config.uuid</code> (SMBIOS/BIOS UUID)
                                    <br />
                                    <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>
                                      Value: <code>{corrValue}</code>
                                    </span>
                                  </div>
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                            {!isSmbios && corrType === 'hostname' && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>How It Matched</DescriptionListTerm>
                                <DescriptionListDescription>
                                  <div style={{ fontSize: '0.88rem' }}>
                                    <strong>AAP Host</strong> <code>{rec.aap_host_name}</code>
                                    {' matched '}
                                    <strong>Resource</strong> name/FQDN/ansible_host
                                  </div>
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                            {details.project_name && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>Project</DescriptionListTerm>
                                <DescriptionListDescription>{details.project_name}</DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                            {(details.ok !== undefined) && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>Task Results</DescriptionListTerm>
                                <DescriptionListDescription>
                                  <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                                    {details.ok > 0 && <FlexItem><Label isCompact color="green">{details.ok} ok</Label></FlexItem>}
                                    {details.changed > 0 && <FlexItem><Label isCompact color="orange">{details.changed} changed</Label></FlexItem>}
                                    {details.failures > 0 && <FlexItem><Label isCompact color="red">{details.failures} failures</Label></FlexItem>}
                                    {details.dark > 0 && <FlexItem><Label isCompact color="red">{details.dark} unreachable</Label></FlexItem>}
                                    {details.skipped > 0 && <FlexItem><Label isCompact color="grey">{details.skipped} skipped</Label></FlexItem>}
                                  </Flex>
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                          </DescriptionList>
                        </div>
                      </ExpandableRowContent>
                    </Td>
                  </Tr>
                </Tbody>
              );
            })}
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

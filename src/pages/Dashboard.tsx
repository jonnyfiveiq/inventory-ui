import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Bullseye, Card, CardBody, CardTitle, Gallery, GalleryItem,
  Label, PageSection, Spinner, Title, Tooltip,
} from '@patternfly/react-core';
import {
  CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon,
  ServerIcon, CloudIcon, CubesIcon,
} from '@patternfly/react-icons';
import * as d3 from 'd3';
import { api } from '../api/client';
import type {
  Provider, Resource, CollectionRun, ResourceDrift,
  PaginatedResponse,
} from '../api/client';
import { normalizeVendor, vendorDisplayName } from '../utils/vendors';
import { useNavigate } from 'react-router-dom';

/* ── colour palette ─────────────────────────────────────────────────────────── */
const VENDOR_COLORS: Record<string, string> = {
  vmware: '#1a73e8', aws: '#ff9900', azure: '#0078d4', gcp: '#34a853',
  openstack: '#ed1944', openshift: '#ee0000',
};
const vc = (v: string) => VENDOR_COLORS[normalizeVendor(v)] ?? '#6a6e73';

const STATE_COLORS: Record<string, string> = {
  active: '#3e8635', running: '#3e8635', on: '#3e8635',
  stopped: '#c9190b', off: '#c9190b', shutoff: '#c9190b',
  suspended: '#f0ab00', paused: '#f0ab00',
  archived: '#6a6e73', template: '#6a6e73', terminated: '#6a6e73',
};
const sc = (s: string) => STATE_COLORS[s?.toLowerCase()] ?? '#8a8d90';

/* ── tiny stat card ─────────────────────────────────────────────────────────── */
function StatCard({ title, value, icon, color, sub }: {
  title: string; value: number | string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card isCompact isFlat style={{ textAlign: 'center' }}>
      <CardBody>
        <div style={{ color, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
          {icon}{title}
        </div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.15rem' }}>{sub}</div>}
      </CardBody>
    </Card>
  );
}

/* ── D3 donut ───────────────────────────────────────────────────────────────── */
function Donut({ data, colorFn, size = 180, label }: {
  data: { key: string; value: number }[];
  colorFn: (k: string) => string;
  size?: number;
  label?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const w = size, h = size, r = Math.min(w, h) / 2 - 8;
    const g = svg.attr('width', w).attr('height', h)
      .append('g').attr('transform', `translate(${w / 2},${h / 2})`);
    const pie = d3.pie<{ key: string; value: number }>().value(d => d.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<{ key: string; value: number }>>().innerRadius(r * 0.55).outerRadius(r);
    const total = data.reduce((s, d) => s + d.value, 0);
    g.selectAll('path').data(pie(data)).enter().append('path')
      .attr('d', arc)
      .attr('fill', d => colorFn(d.data.key))
      .attr('stroke', 'var(--pf-v5-global--BackgroundColor--100)').attr('stroke-width', 2)
      .style('cursor', 'default')
      .append('title').text(d => `${d.data.key}: ${d.data.value} (${Math.round(d.data.value / total * 100)}%)`);
    g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em')
      .style('font-size', '1.5rem').style('font-weight', '700')
      .style('fill', 'var(--pf-v5-global--Color--100)').text(total);
    if (label) g.append('text').attr('text-anchor', 'middle').attr('dy', '1.4em')
      .style('font-size', '0.7rem').style('fill', 'var(--pf-v5-global--Color--200)').text(label);
  }, [data, colorFn, size, label]);
  return <svg ref={ref} />;
}

/* ── D3 heatmap (collections over last 8 weeks) ────────────────────────────── */
function CollectionHeatmap({ runs }: { runs: CollectionRun[] }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    // Build day counts for last 56 days
    const now = new Date();
    const days: { date: Date; count: number; failed: number }[] = [];
    for (let i = 55; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push({ date: d, count: 0, failed: 0 });
    }
    for (const r of runs) {
      const d = new Date(r.started_at); d.setHours(0, 0, 0, 0);
      const day = days.find(dd => dd.date.getTime() === d.getTime());
      if (day) { day.count++; if (r.status === 'failed') day.failed++; }
    }

    const cellSize = 22, gap = 5, weeks = 8, daysPerWeek = 7;
    const ml = 40, mt = 32;
    const w = ml + weeks * (cellSize + gap) + 10;
    const h = mt + daysPerWeek * (cellSize + gap) + 10;
    svg.attr('width', w).attr('height', h);

    const maxCount = d3.max(days, d => d.count) || 1;
    const color = d3.scaleSequential([0, maxCount], d3.interpolateGreens);
    const failColor = '#c9190b';

    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
    svg.selectAll('.dayLabel').data(dayLabels).enter().append('text')
      .attr('x', ml - 4).attr('y', (_, i) => mt + i * (cellSize + gap) + cellSize / 2 + 4)
      .attr('text-anchor', 'end').style('font-size', '0.6rem')
      .style('fill', 'var(--pf-v5-global--Color--200)').text(d => d);

    svg.selectAll('rect').data(days).enter().append('rect')
      .attr('x', (_, i) => ml + Math.floor(i / 7) * (cellSize + gap))
      .attr('y', (_, i) => mt + (i % 7) * (cellSize + gap))
      .attr('width', cellSize).attr('height', cellSize)
      .attr('rx', 3)
      .attr('fill', d => d.count === 0 ? 'var(--pf-v5-global--BackgroundColor--200)' : d.failed > 0 ? failColor : color(d.count))
      .style('cursor', 'default')
      .append('title').text(d => {
        const dateStr = d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `${dateStr}: ${d.count} collection${d.count !== 1 ? 's' : ''}${d.failed ? ` (${d.failed} failed)` : ''}`;
      });

    // Week labels (month start)
    const weekStarts = days.filter((_, i) => i % 7 === 0);
    svg.selectAll('.weekLabel').data(weekStarts).enter().append('text')
      .attr('x', (_, i) => ml + i * (cellSize + gap) + cellSize / 2)
      .attr('y', mt - 6).attr('text-anchor', 'middle')
      .style('font-size', '0.65rem').style('fill', 'var(--pf-v5-global--Color--200)')
      .text((d, i) => i % 2 === 0 ? d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
  }, [runs]);
  return <svg ref={ref} />;
}

/* ── D3 horizontal bar chart ────────────────────────────────────────────────── */
function ResourceTypeBar({ data }: { data: { key: string; value: number }[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !containerRef.current || data.length === 0) return;
    const svg = d3.select(ref.current); svg.selectAll('*').remove();
    const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 10);
    const containerW = containerRef.current.clientWidth;
    const ml = Math.min(240, containerW * 0.42), mr = 45, mt = 8, mb = 8;
    const barH = 24, gap = 6;
    const h = mt + sorted.length * (barH + gap) + mb;
    const w = containerW;
    const maxV = d3.max(sorted, d => d.value) || 1;
    const x = d3.scaleLinear([0, maxV], [0, w - ml - mr]);
    svg.attr('width', w).attr('height', h);
    const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);
    const bars = g.selectAll('g').data(sorted).enter().append('g')
      .attr('transform', (_, i) => `translate(0,${i * (barH + gap)})`);
    bars.append('rect').attr('width', d => x(d.value)).attr('height', barH)
      .attr('rx', 3).attr('fill', '#0066cc').attr('opacity', 0.8);
    bars.append('text').attr('x', -6).attr('y', barH / 2 + 5)
      .attr('text-anchor', 'end').style('font-size', '0.75rem')
      .style('fill', 'var(--pf-v5-global--Color--100)')
      .text(d => { const max = Math.floor(ml / 7); return d.key.length > max ? d.key.slice(0, max - 1) + '\u2026' : d.key; });
    bars.append('text').attr('x', d => x(d.value) + 6).attr('y', barH / 2 + 5)
      .style('font-size', '0.78rem').style('font-weight', '600')
      .style('fill', 'var(--pf-v5-global--Color--100)').text(d => d.value);
  }, [data]);
  return <div ref={containerRef} style={{ width: '100%' }}><svg ref={ref} style={{ display: 'block', width: '100%' }} /></div>;
}

/* ── Mini sparkline ─────────────────────────────────────────────────────────── */
function Sparkline({ values, color = '#0066cc', width = 140, height = 36 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || values.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);
    const x = d3.scaleLinear([0, values.length - 1], [4, width - 4]);
    const y = d3.scaleLinear([0, d3.max(values) || 1], [height - 4, 4]);
    const line = d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
    svg.append('path').datum(values).attr('d', line)
      .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);
  }, [values, color, width, height]);
  return <svg ref={ref} />;
}

/* ── main dashboard ─────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [drift, setDrift] = useState<ResourceDrift[]>([]);

  useEffect(() => {
    Promise.all([
      api.listProviders('page_size=200'),
      api.listResources('page_size=500'),
      api.listCollectionRuns(1),
      api.listResourceDrift('page_size=200'),
    ]).then(([p, r, c, d]) => {
      setProviders(p.results);
      setResources(r.results);
      setRuns(c.results);
      setDrift(d.results);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Bullseye style={{ padding: '6rem' }}><Spinner size="xl" /></Bullseye>;

  // ── derived data ──
  const enabledCount = providers.filter(p => p.enabled).length;
  const disabledCount = providers.length - enabledCount;
  const totalResources = resources.length;

  // Vendor breakdown
  const vendorData = Object.entries(
    resources.reduce<Record<string, number>>((a, r) => {
      const k = normalizeVendor(r.provider_name ? providers.find(p => p.id === r.provider)?.vendor ?? 'unknown' : 'unknown');
      a[k] = (a[k] || 0) + 1; return a;
    }, {})
  ).map(([key, value]) => ({ key: vendorDisplayName(key), value, raw: key }));

  // State breakdown
  const stateData = Object.entries(
    resources.reduce<Record<string, number>>((a, r) => {
      const s = r.state?.toLowerCase() || 'unknown'; a[s] = (a[s] || 0) + 1; return a;
    }, {})
  ).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);

  // Resource type breakdown
  const typeData = Object.entries(
    resources.reduce<Record<string, number>>((a, r) => {
      const t = r.resource_type_name || r.resource_type_slug || 'Unknown'; a[t] = (a[t] || 0) + 1; return a;
    }, {})
  ).map(([key, value]) => ({ key, value }));

  // Collection stats
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const runningRuns = runs.filter(r => r.status === 'running' || r.status === 'pending').length;

  // Collection runs per day (last 7 days sparkline)
  const now = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    return runs.filter(r => {
      const rd = new Date(r.started_at); rd.setHours(0, 0, 0, 0);
      return rd.getTime() === d.getTime();
    }).length;
  });

  // Drift stats
  const recentDrift = drift.length;
  const driftModified = drift.filter(d => d.drift_type === 'modified').length;
  const driftDeleted = drift.filter(d => d.drift_type === 'deleted').length;

  // Infrastructure breakdown
  const infraData = Object.entries(
    providers.reduce<Record<string, number>>((a, p) => {
      a[p.infrastructure] = (a[p.infrastructure] || 0) + 1; return a;
    }, {})
  ).map(([key, value]) => ({ key: key.replace(/_/g, ' '), value }));

  const INFRA_COLORS: Record<string, string> = {
    'public cloud': '#0066cc', 'private cloud': '#6753ac',
    networking: '#009596', storage: '#f0ab00',
  };

  return (
    <>
      <PageSection variant="light" style={{ paddingBottom: '0.5rem' }}>
        <Title headingLevel="h1" size="2xl">Dashboard</Title>
        <p style={{ marginTop: '0.25rem', color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9rem' }}>
          Inventory overview across all providers and resources
        </p>
      </PageSection>

      <PageSection>
        {/* ── Stat Cards ── */}
        <Gallery hasGutter minWidths={{ default: '160px' }} style={{ marginBottom: '1.5rem' }}>
          <GalleryItem>
            <StatCard title="Providers" value={providers.length} icon={<ServerIcon />}
              color="#0066cc" sub={`${enabledCount} enabled · ${disabledCount} disabled`} />
          </GalleryItem>
          <GalleryItem>
            <StatCard title="Resources" value={totalResources} icon={<CubesIcon />}
              color="#3e8635" sub={`${stateData.find(s => s.key === 'active')?.value ?? 0} active`} />
          </GalleryItem>
          <GalleryItem>
            <StatCard title="Collections" value={runs.length} icon={<CloudIcon />}
              color="#0066cc" sub={`${completedRuns} ok · ${failedRuns} failed · ${runningRuns} running`} />
          </GalleryItem>
          <GalleryItem>
            <StatCard title="Drift Events" value={recentDrift}
              icon={<ExclamationTriangleIcon />} color="#f0ab00"
              sub={`${driftModified} modified · ${driftDeleted} deleted`} />
          </GalleryItem>
          <GalleryItem>
            <Card isCompact isFlat style={{ textAlign: 'center' }}>
              <CardBody>
                <div style={{ fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)', marginBottom: '0.25rem' }}>
                  Collections (7d)
                </div>
                <Sparkline values={last7} />
              </CardBody>
            </Card>
          </GalleryItem>
        </Gallery>

        {/* ── Charts row ── */}
        <Gallery hasGutter minWidths={{ default: '280px' }} style={{ marginBottom: '1.5rem' }}>
          <GalleryItem>
            <Card isFullHeight>
              <CardTitle>Resources by Vendor</CardTitle>
              <CardBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <Donut data={vendorData} colorFn={k => {
                    const d = vendorData.find(v => v.key === k);
                    return d ? vc(d.raw) : '#6a6e73';
                  }} label="total" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {vendorData.sort((a, b) => b.value - a.value).map(d => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                        onClick={() => navigate('/inventory/vendors/' + d.raw)}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: vc(d.raw) }} />
                        <span style={{ fontSize: '0.82rem' }}>{d.key}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </GalleryItem>

          <GalleryItem>
            <Card isFullHeight>
              <CardTitle>Resources by State</CardTitle>
              <CardBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <Donut data={stateData} colorFn={sc} label="total" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {stateData.map(d => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: sc(d.key) }} />
                        <span style={{ fontSize: '0.82rem' }}>{d.key}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </GalleryItem>

          <GalleryItem>
            <Card isFullHeight>
              <CardTitle>Infrastructure Mix</CardTitle>
              <CardBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <Donut data={infraData} colorFn={k => INFRA_COLORS[k.toLowerCase()] ?? '#6a6e73'} size={150} label="providers" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {infraData.map(d => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: INFRA_COLORS[d.key.toLowerCase()] ?? '#6a6e73' }} />
                        <span style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{d.key}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </GalleryItem>
        </Gallery>

        {/* ── Heatmap + bar chart row ── */}
        <Gallery hasGutter minWidths={{ default: '380px' }}>
          <GalleryItem>
            <Card isFullHeight>
              <CardTitle>Collection Activity (8 weeks)</CardTitle>
              <CardBody>
                <CollectionHeatmap runs={runs} />
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircleIcon style={{ color: '#3e8635' }} /> Successful</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ExclamationCircleIcon style={{ color: '#c9190b' }} /> Failed</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 10, height: 10, background: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: 2, display: 'inline-block' }} /> No runs</span>
                </div>
              </CardBody>
            </Card>
          </GalleryItem>

          <GalleryItem>
            <Card isFullHeight>
              <CardTitle>Top Resource Types</CardTitle>
              <CardBody>
                <ResourceTypeBar data={typeData} />
              </CardBody>
            </Card>
          </GalleryItem>
        </Gallery>

        {/* ── Recent Drift ── */}
        {drift.length > 0 && (
          <Card style={{ marginTop: '1.5rem' }}>
            <CardTitle>Recent Drift Events</CardTitle>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {drift.slice(0, 8).map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem',
                    padding: '0.5rem 0.75rem', background: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: 6 }}>
                    <Label isCompact color={d.drift_type === 'deleted' ? 'red' : d.drift_type === 'modified' ? 'orange' : 'blue'}>
                      {d.drift_type}
                    </Label>
                    <strong>{d.resource_name}</strong>
                    <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>on {d.provider_name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)' }}>
                      {new Date(d.detected_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {d.drift_type === 'modified' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)' }}>
                        {Object.keys(d.changes).length} field{Object.keys(d.changes).length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </PageSection>
    </>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Button,
  Bullseye,
  Modal,
  ModalVariant,
  Spinner,
  Alert,
} from '@patternfly/react-core';
import { NetworkIcon } from '@patternfly/react-icons';
import * as d3 from 'd3';
import { api } from '../api/client';
import type { Resource, ResourceRelationship } from '../api/client';

// ── Resource type → colour mapping ──────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  virtual_machine: '#0066cc',
  hypervisor_host: '#3e8635',
  container_orchestration_platform: '#ec7a08',
  block_storage: '#a18fff',
  auto_scaling_group: '#009596',
  network: '#f4c145',
  default: '#8a8d90',
};

// ── Power-state fill variant ─────────────────────────────────────────────────
const POWER_ALPHA: Record<string, number> = {
  on: 1,
  running: 1,
  poweredOn: 1,
  off: 0.35,
  poweredOff: 0.35,
  suspended: 0.55,
  unknown: 0.45,
};

const RELATIONSHIP_COLOR: Record<string, string> = {
  runs_on: '#0066cc',
  attached_to: '#a18fff',
  member_of: '#009596',
  part_of: '#ec7a08',
  default: '#8a8d90',
};

const NODE_RADIUS: Record<string, number> = {
  container_orchestration_platform: 22,
  hypervisor_host: 18,
  auto_scaling_group: 16,
  block_storage: 14,
  virtual_machine: 12,
  default: 12,
};

// ── D3 simulation node/link types ────────────────────────────────────────────
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  resource_type_slug: string;
  power_state: string;
  state: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationship_type: string;
  id: string;
}

// ── Helper: fetch all pages of a paginated endpoint ─────────────────────────
async function fetchAll<T>(fetcher: (params: string) => Promise<{ count: number; results: T[]; next: string | null }>): Promise<T[]> {
  const first = await fetcher('page_size=200');
  const results: T[] = [...first.results];
  let remaining = first.count - first.results.length;
  let page = 2;
  while (remaining > 0) {
    const more = await fetcher('page_size=200&page=' + page);
    results.push(...more.results);
    remaining -= more.results.length;
    page++;
    if (more.results.length === 0) break;
  }
  return results;
}

// ── Graph legend ──────────────────────────────────────────────────────────────
function Legend() {
  const types = [
    { slug: 'container_orchestration_platform', label: 'Cluster' },
    { slug: 'hypervisor_host', label: 'Host' },
    { slug: 'auto_scaling_group', label: 'Pool' },
    { slug: 'block_storage', label: 'Storage' },
    { slug: 'virtual_machine', label: 'VM' },
  ];
  const rels = [
    { type: 'runs_on', label: 'runs_on' },
    { type: 'attached_to', label: 'attached_to' },
    { type: 'member_of', label: 'member_of' },
    { type: 'part_of', label: 'part_of' },
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      right: 12,
      background: 'rgba(21,21,21,0.88)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 11,
      color: '#fff',
      lineHeight: 1.8,
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Node types</div>
      {types.map(t => (
        <div key={t.slug} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={16} height={16}>
            <circle
              cx={8} cy={8}
              r={(NODE_RADIUS[t.slug] || 12) * 0.55}
              fill={TYPE_COLOR[t.slug] || TYPE_COLOR.default}
            />
          </svg>
          {t.label}
        </div>
      ))}
      <div style={{ fontWeight: 600, margin: '6px 0 4px' }}>Edges</div>
      {rels.map(r => (
        <div key={r.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={20} height={6}>
            <line x1={0} y1={3} x2={20} y2={3}
              stroke={RELATIONSHIP_COLOR[r.type] || RELATIONSHIP_COLOR.default}
              strokeWidth={2}
            />
          </svg>
          {r.label}
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
interface ProviderGraphModalProps {
  providerId: string;
  providerName: string;
  resourceId?: string;
  resourceName?: string;
  autoOpen?: boolean;
}

export function ProviderGraphModal({ providerId, providerName, resourceId, resourceName, autoOpen }: ProviderGraphModalProps) {
  const [open, setOpen] = useState(autoOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // ── Load data when modal opens ────────────────────────────────────────────
  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allResources = await fetchAll<Resource>(params =>
        api.listResources(params) as Promise<{ count: number; results: Resource[]; next: string | null }>
      );
      const resources = allResources.filter(r => r.provider === providerId);      const resourceSet = new Set(resources.map(r => r.id));
      let relationships: ResourceRelationship[] = [];
      if (resourceSet.size > 0) {
        const allRels = await fetchAll<ResourceRelationship>(params =>
          api.listResourceRelationships(params) as Promise<{ count: number; results: ResourceRelationship[]; next: string | null }>
        );
        relationships = allRels.filter(r => resourceSet.has(r.source) && resourceSet.has(r.target));
      }

      // If a specific resource is requested, filter to that resource and its direct neighbors only
      if (resourceId) {
        const directRels = relationships.filter(r => r.source === resourceId || r.target === resourceId);
        const neighborIds = new Set([resourceId]);
        directRels.forEach(r => { neighborIds.add(r.source as string); neighborIds.add(r.target as string); });
        const filteredResources = resources.filter(r => neighborIds.has(r.id));
        const simNodes: SimNode[] = filteredResources.map(r => ({
          id: r.id, name: r.name, resource_type_slug: r.resource_type_slug,
          power_state: r.power_state || 'unknown', state: r.state || 'unknown',
        }));
        const simLinks: SimLink[] = directRels.map(rel => ({
          id: rel.id, source: rel.source, target: rel.target, relationship_type: rel.relationship_type,
        }));
        setNodes(simNodes);
        setLinks(simLinks);
        return;
      }

      const simNodes: SimNode[] = resources.map(r => ({
        id: r.id,
        name: r.name,
        resource_type_slug: r.resource_type_slug,
        power_state: r.power_state || 'unknown',
        state: r.state || 'unknown',
      }));

      const simLinks: SimLink[] = relationships
        .filter(rel => resourceSet.has(rel.source) && resourceSet.has(rel.target))
        .map(rel => ({
          id: rel.id,
          source: rel.source,
          target: rel.target,
          relationship_type: rel.relationship_type,
        }));

      setNodes(simNodes);
      setLinks(simLinks);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (open) loadGraph();
    else {
      // Stop simulation on close
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    }
  }, [open, loadGraph]);

  // ── D3 rendering ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || loading || error || !svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 560;

    // Arrow markers per relationship type
    const defs = svg.append('defs');
    Object.entries(RELATIONSHIP_COLOR).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', 'arrow-' + type)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 18)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', color);
    });

    // Zoom container
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform.toString()));
    svg.call(zoom);

    // Deep-copy nodes/links so d3 can mutate them
    const simNodes: SimNode[] = nodes.map(n => ({ ...n }));
    const linkMap = new Map(simNodes.map(n => [n.id, n]));
    const simLinks: SimLink[] = links.map(l => ({
      ...l,
      source: linkMap.get(l.source as string) || l.source,
      target: linkMap.get(l.target as string) || l.target,
    }));

    // Simulation
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
        .id(d => d.id)
        .distance(90)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>()
        .radius(d => (NODE_RADIUS[d.resource_type_slug] || NODE_RADIUS.default) + 6));

    simulationRef.current = simulation;

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', d => RELATIONSHIP_COLOR[d.relationship_type] || RELATIONSHIP_COLOR.default)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7)
      .attr('marker-end', d => 'url(#arrow-' + (d.relationship_type in RELATIONSHIP_COLOR ? d.relationship_type : 'default') + ')');

    // Node groups
    const node = g.append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'grab')
      .call(
        (d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
        ) as any
      );

    // Node circles
    node.append('circle')
      .attr('r', d => NODE_RADIUS[d.resource_type_slug] || NODE_RADIUS.default)
      .attr('fill', d => TYPE_COLOR[d.resource_type_slug] || TYPE_COLOR.default)
      .attr('fill-opacity', d => POWER_ALPHA[d.power_state] ?? POWER_ALPHA[d.state] ?? 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Node labels
    node.append('text')
      .text(d => d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name)
      .attr('x', d => (NODE_RADIUS[d.resource_type_slug] || NODE_RADIUS.default) + 4)
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('fill', '#f0f0f0')
      .attr('pointer-events', 'none');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .style('position', 'fixed')
      .style('background', 'rgba(21,21,21,0.92)')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('display', 'none')
      .style('z-index', '9999');

    node
      .on('mouseover', (_event: MouseEvent, d: SimNode) => {
        tooltip
          .style('display', 'block')
          .html(`<b>${d.name}</b><br/>Type: ${d.resource_type_slug}<br/>State: ${d.power_state || d.state}`);
      })
      .on('mousemove', (event: MouseEvent) => {
        tooltip
          .style('left', (event.clientX + 12) + 'px')
          .style('top', (event.clientY - 28) + 'px');
      })
      .on('mouseout', () => tooltip.style('display', 'none'));

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);

      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [open, loading, error, nodes, links]);

  return (
    <>
      <Button
        variant="plain"
        title="View topology graph"
        onClick={() => setOpen(true)}
        icon={<NetworkIcon />}
      />

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        variant={ModalVariant.large}
        title={resourceId ? `Topology — ${resourceName || 'Resource'}` : `Topology — ${providerName}`}
        aria-label="Provider topology graph"
        actions={[
          <Button key="refresh" variant="secondary" onClick={loadGraph} isDisabled={loading}>
            Refresh
          </Button>,
          <Button key="close" variant="primary" onClick={() => setOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <div style={{ position: 'relative', width: '100%', height: 560, background: '#1b1d21', borderRadius: 4, overflow: 'hidden' }}>
          {loading && (
            <Bullseye style={{ height: '100%' }}>
              <Spinner size="xl" />
            </Bullseye>
          )}
          {error && !loading && (
            <div style={{ padding: 16 }}>
              <Alert variant="danger" title="Failed to load graph" isInline>
                {error}
              </Alert>
            </div>
          )}
          {!loading && !error && nodes.length === 0 && (
            <Bullseye style={{ height: '100%', color: '#8a8d90' }}>
              No resources found for this provider.
            </Bullseye>
          )}
          {!loading && !error && nodes.length > 0 && (
            <>
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                style={{ display: 'block' }}
              />
              <Legend />
              <div style={{
                position: 'absolute',
                top: 10,
                left: 12,
                fontSize: 11,
                color: '#6a6e73',
                pointerEvents: 'none',
              }}>
                {nodes.length} resources · {links.length} relationships · scroll to zoom · drag to pan
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

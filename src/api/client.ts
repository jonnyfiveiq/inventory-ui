const API_BASE = '/api/inventory/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  const creds = localStorage.getItem('inventory_creds');
  if (creds) {
    headers['Authorization'] = 'Basic ' + btoa(creds);
  }
  const res = await fetch(API_BASE + path, {
    ...options,
    headers,
  });
  if (options?.method === 'DELETE' && res.status === 204) {
    return undefined as T;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(res.status + ' ' + res.statusText + ': ' + text);
  }
  return res.json();
}

// ── Shared ────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Providers ─────────────────────────────────────────────────────────────────
export interface Provider {
  id: string;
  name: string;
  vendor: string;
  provider_type: string;
  infrastructure: string;
  endpoint: string;
  enabled: boolean;
  organization: number;
  credential_ref: string | null;
  connection_config: Record<string, unknown>;
  last_collection_status: string | null;
  last_refresh_at: string | null;
  schedule_count: number;
  created: string;
  modified: string;
}

// ── Collection Runs ───────────────────────────────────────────────────────────
export type CollectionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

export interface CollectionRun {
  id: string;
  provider: string;
  collection_type: string;
  status: CollectionStatus;
  started_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  task_uuid: string;
  resources_found: number;
  resources_created: number;
  resources_updated: number;
  resources_removed: number;
  resources_unchanged: number;
  error_message: string;
  result_traceback: string;
  collector_version: string;
  duration_seconds: number | null;
}

// ── Resources ─────────────────────────────────────────────────────────────────
export interface Resource {
  id: string;
  resource_type: string;
  resource_type_slug: string;
  resource_type_name: string;
  provider: string;
  provider_name: string;
  name: string;
  description: string;
  ems_ref: string;
  canonical_id: string;
  vendor_identifiers: Record<string, unknown>;
  vendor_type: string;
  state: string;
  power_state: string;
  region: string;
  availability_zone: string;
  cloud_tenant: string;
  flavor: string;
  ems_created_on: string | null;
  cpu_count: number | null;
  memory_mb: number | null;
  disk_gb: number | null;
  ip_addresses: string[];
  fqdn: string;
  mac_addresses: string[];
  os_type: string;
  os_name: string;
  boot_time: string | null;
  properties: Record<string, unknown>;
  provider_tags: Record<string, unknown>;
  ansible_host: string;
  ansible_connection: string;
  inventory_group: string;
  first_discovered_at: string;
  last_seen_at: string;
  seen_count: number;
  deleted_at: string | null;
  is_deleted: boolean;
  is_automated: boolean;
  automation_count: number;
  last_automated_at: string | null;
  organization: number;
  tags: Tag[];
}

export interface ResourceRelationship {
  id: string;
  source: string;
  source_name: string;
  target: string;
  target_name: string;
  relationship_type: string;
  properties: Record<string, unknown>;
}

export interface ResourceSighting {
  id: string;
  resource: string;
  resource_name: string;
  collection_run: string;
  seen_at: string;
  state: string;
  power_state: string;
  cpu_count: number | null;
  memory_mb: number | null;
  disk_gb: number | null;
  metrics: Record<string, unknown>;
}

// ── Drift ─────────────────────────────────────────────────────────────────────
export type DriftType = 'modified' | 'deleted' | 'restored';

export interface DriftChange {
  from: unknown;
  to: unknown;
}

export interface ResourceDrift {
  id: string;
  resource: string;
  resource_name: string;
  resource_type_slug: string;
  provider_name: string;
  collection_run: string;
  collection_run_started_at: string;
  previous_collection_run: string | null;
  previous_collection_run_started_at: string | null;
  drift_type: DriftType;
  detected_at: string;
  changes: Record<string, DriftChange>;
}

// ── Taxonomy ──────────────────────────────────────────────────────────────────
export interface ResourceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  resource_type_count: number;
}

export interface ResourceType {
  id: string;
  category: string;
  category_slug: string;
  category_name: string;
  slug: string;
  name: string;
  description: string;
  is_countable: boolean;
  long_term_strategic_value: boolean;
  short_term_opportunity: boolean;
  sort_order: number;
}

export interface VendorTypeMapping {
  id: string;
  vendor: string;
  vendor_resource_type: string;
  resource_type: string;
  resource_type_slug: string;
  ansible_collection: string;
  ansible_module: string;
  query_file_ref: string;
}

export interface PropertyDefinition {
  id: string;
  resource_type: string;
  resource_type_slug: string;
  key: string;
  name: string;
  description: string;
  value_type: string;
  required: boolean;
  example_value: string;
  vendor_scope: string;
}

// ── Provider Plugins ──────────────────────────────────────────────────────────
export interface ProviderPlugin {
  key: string;
  vendor: string;
  provider_type: string;
  name: string;
  version: string;
  description: string;
  configured_instances: number;
}

export interface PluginTestResult {
  provider_id: string;
  provider_name: string;
  plugin_key: string;
  success: boolean;
  message: string;
}

// ── Collection Schedules ──────────────────────────────────────────────────────
export interface CollectionSchedule {
  id: string;
  provider: string;
  name: string;
  cron_expression: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Tags ──────────────────────────────────────────────────────────────────────
export interface Tag {
  id: string;
  namespace: string;
  key: string;
  value: string;
  organization: number;
}

// ── Watchlists ────────────────────────────────────────────────────────────────
export interface Watchlist {
  id: string;
  name: string;
  description: string;
  watchlist_type: 'static' | 'dynamic';
  filter_query: Record<string, unknown>;
  organization: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  resource_count: number;
}

// ── API client ────────────────────────────────────────────────────────────────
export const api = {
  // Providers – full CRUD + collect
  listProviders: (params?: string) =>
    request<PaginatedResponse<Provider>>('/providers/' + (params ? '?' + params : '')),
  getProvider: (id: string) =>
    request<Provider>('/providers/' + id + '/'),
  createProvider: (data: Partial<Provider>) =>
    request<Provider>('/providers/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateProvider: (id: string, data: Partial<Provider>) =>
    request<Provider>('/providers/' + id + '/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteProvider: (id: string) =>
    request<void>('/providers/' + id + '/', { method: 'DELETE' }),
  triggerCollection: (providerId: string) =>
    request<CollectionRun>('/providers/' + providerId + '/collect/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),

  // Collection runs – read-only + cancel
  listCollectionRuns: (page = 1) =>
    request<PaginatedResponse<CollectionRun>>('/collection-runs/?page=' + page),
  getCollectionRun: (id: string) =>
    request<CollectionRun>('/collection-runs/' + id + '/'),
  cancelCollectionRun: (id: string) =>
    request<CollectionRun>('/collection-runs/' + id + '/cancel/', {
      method: 'POST',
    }),

  // Resources – read-only + sightings + history
  listResources: (params?: string) =>
    request<PaginatedResponse<Resource>>('/resources/' + (params ? '?' + params : '')),
  getResource: (id: string) =>
    request<Resource>('/resources/' + id + '/'),
  getResourceSightings: (id: string) =>
    request<PaginatedResponse<ResourceSighting>>('/resources/' + id + '/sightings/'),
  getResourceHistory: (id: string) =>
    request<PaginatedResponse<ResourceSighting>>('/resources/' + id + '/history/'),

  // Resource relationships – read-only
  listResourceRelationships: (params?: string) =>
    request<PaginatedResponse<ResourceRelationship>>('/resource-relationships/' + (params ? '?' + params : '')),
  getResourceRelationship: (id: string) =>
    request<ResourceRelationship>('/resource-relationships/' + id + '/'),

  // Taxonomy – read-only
  listResourceCategories: () =>
    request<PaginatedResponse<ResourceCategory>>('/resource-categories/'),
  getResourceCategory: (id: string) =>
    request<ResourceCategory>('/resource-categories/' + id + '/'),
  listResourceTypes: (params?: string) =>
    request<PaginatedResponse<ResourceType>>('/resource-types/' + (params ? '?' + params : '')),
  getResourceType: (id: string) =>
    request<ResourceType>('/resource-types/' + id + '/'),
  listVendorTypeMappings: (params?: string) =>
    request<PaginatedResponse<VendorTypeMapping>>('/vendor-type-mappings/' + (params ? '?' + params : '')),
  getVendorTypeMapping: (id: string) =>
    request<VendorTypeMapping>('/vendor-type-mappings/' + id + '/'),
  listPropertyDefinitions: (params?: string) =>
    request<PaginatedResponse<PropertyDefinition>>('/property-definitions/' + (params ? '?' + params : '')),
  getPropertyDefinition: (id: string) =>
    request<PropertyDefinition>('/property-definitions/' + id + '/'),

  // Provider plugins – list, retrieve, upload, uninstall, test, refresh
  listPlugins: () =>
    request<ProviderPlugin[]>('/provider-plugins/'),
  getPlugin: (key: string) =>
    request<ProviderPlugin>('/provider-plugins/' + key + '/'),
  deletePlugin: (key: string, force = false) =>
    request<{ detail: string; orphaned_instances: number }>('/provider-plugins/' + key + '/' + (force ? '?force=true' : ''), {
      method: 'DELETE',
    }),
  testPlugin: (key: string) =>
    request<{ results: PluginTestResult[] }>('/provider-plugins/' + key + '/test/', {
      method: 'POST',
    }),
  refreshPlugins: () =>
    request<{ detail: string; providers: ProviderPlugin[] }>('/provider-plugins/refresh/', {
      method: 'POST',
    }),

  // Drift – read-only
  getResourceDrift: (resourceId: string, params?: string) =>
    request<PaginatedResponse<ResourceDrift>>(
      '/resources/' + resourceId + '/drift/' + (params ? '?' + params : '')
    ),
  listResourceDrift: (params?: string) =>
    request<PaginatedResponse<ResourceDrift>>('/resource-drift/' + (params ? '?' + params : '')),

  // Schedules – full CRUD nested under a provider
  listSchedules: (providerId: string) =>
    request<PaginatedResponse<CollectionSchedule>>('/providers/' + providerId + '/schedules/'),
  getSchedule: (providerId: string, scheduleId: string) =>
    request<CollectionSchedule>('/providers/' + providerId + '/schedules/' + scheduleId + '/'),
  createSchedule: (providerId: string, data: Partial<CollectionSchedule>) =>
    request<CollectionSchedule>('/providers/' + providerId + '/schedules/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateSchedule: (providerId: string, scheduleId: string, data: Partial<CollectionSchedule>) =>
    request<CollectionSchedule>('/providers/' + providerId + '/schedules/' + scheduleId + '/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteSchedule: (providerId: string, scheduleId: string) =>
    request<void>('/providers/' + providerId + '/schedules/' + scheduleId + '/', { method: 'DELETE' }),

  // Tags – list + resource assignment
  listTags: (params?: string) =>
    request<PaginatedResponse<Tag>>('/tags/' + (params ? '?' + params : '')),
  getResourceTags: (resourceId: string) =>
    request<Tag[]>('/resources/' + resourceId + '/tags/'),
  setResourceTags: (resourceId: string, tags: Partial<Tag>[]) =>
    request<Tag[]>('/resources/' + resourceId + '/tags/set/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tags),
    }),
  addResourceTags: (resourceId: string, tags: Partial<Tag>[]) =>
    request<Tag[]>('/resources/' + resourceId + '/tags/add/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tags),
    }),
  removeResourceTags: (resourceId: string, tagIds: string[]) =>
    request<Tag[]>('/resources/' + resourceId + '/tags/remove/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagIds),
    }),

  uploadPlugin: (file: File, force = false): Promise<{ detail: string; plugin: ProviderPlugin }> => {
    const creds = localStorage.getItem('inventory_creds');
    const headers: Record<string, string> = {};
    if (creds) headers['Authorization'] = 'Basic ' + btoa(creds);
    const body = new FormData();
    body.append('plugin', file);
    return fetch(API_BASE + '/provider-plugins/upload/' + (force ? '?force=true' : ''), {
      method: 'POST',
      headers,
      body,
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.detail || res.statusText), { status: res.status, data: json });
      return json;
    });
  },

  // Watchlists — full CRUD + resource membership
  listWatchlists: (params?: string) =>
    request<PaginatedResponse<Watchlist>>('/watchlists/' + (params ? '?' + params : '')),
  getWatchlist: (id: string) =>
    request<Watchlist>('/watchlists/' + id + '/'),
  createWatchlist: (data: Partial<Watchlist>) =>
    request<Watchlist>('/watchlists/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateWatchlist: (id: string, data: Partial<Watchlist>) =>
    request<Watchlist>('/watchlists/' + id + '/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteWatchlist: (id: string) =>
    request<void>('/watchlists/' + id + '/', { method: 'DELETE' }),
  getWatchlistResources: (id: string, params?: string) =>
    request<PaginatedResponse<Resource>>('/watchlists/' + id + '/resources/' + (params ? '?' + params : '')),
  addToWatchlist: (id: string, resourceIds: string[]) =>
    request<{ detail: string }>('/watchlists/' + id + '/resources/add/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_ids: resourceIds }),
    }),
  removeFromWatchlist: (id: string, resourceIds: string[]) =>
    request<{ detail: string }>('/watchlists/' + id + '/resources/remove/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_ids: resourceIds }),
    }),

  // Automation Records - read-only
  listAutomationRecords: (params?: string) =>
    request<PaginatedResponse<AutomationRecord>>('/automation-records/' + (params ? '?' + params : '')),
  getResourceAutomations: (resourceId: string, params?: string) =>
    request<PaginatedResponse<AutomationRecord>>('/resources/' + resourceId + '/automations/' + (params ? '?' + params : '')),

  // Metrics Imports
  listMetricsImports: (params?: string) =>
    request<PaginatedResponse<MetricsImportRecord>>('/metrics-imports/' + (params ? '?' + params : '')),
  getMetricsImport: (id: string) =>
    request<MetricsImportRecord>('/metrics-imports/' + id + '/'),
  deleteMetricsImport: (id: string) =>
    request<void>('/metrics-imports/' + id + '/', { method: 'DELETE' }),
  uploadMetricsImport: (file: File, sourceLabel?: string): Promise<MetricsImportRecord> => {
    const creds = localStorage.getItem('inventory_creds');
    const headers: Record<string, string> = {};
    if (creds) headers['Authorization'] = 'Basic ' + btoa(creds);
    const body = new FormData();
    body.append('file', file);
    if (sourceLabel) body.append('source_label', sourceLabel);
    return fetch(API_BASE + '/metrics-imports/upload/', {
      method: 'POST',
      headers,
      body,
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.detail || res.statusText), { status: res.status, data: json });
      return json;
    });
  },

  // Pending Matches
  listPendingMatches: (params?: string) =>
    request<PaginatedResponse<PendingMatchRecord>>('/pending-matches/' + (params ? '?' + params : '')),
  resolvePendingMatch: (id: string, action: 'approve' | 'reject' | 'ignore', resourceId?: string) =>
    request<PendingMatchRecord>('/pending-matches/' + id + '/resolve/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(resourceId ? { resource_id: resourceId } : {}) }),
    }),
  bulkResolvePendingMatches: (ids: string[], action: 'approve' | 'reject' | 'ignore') =>
    request<{ resolved: number; errors: Array<{ id: string; error: string }> }>('/pending-matches/bulk-resolve/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    }),

  // Host Mappings
  listHostMappings: (params?: string) =>
    request<PaginatedResponse<HostMappingRecord>>('/host-mappings/' + (params ? '?' + params : '')),
  deleteHostMapping: (id: string) =>
    request<void>('/host-mappings/' + id + '/', { method: 'DELETE' }),
};


// ── Automation Records ────────────────────────────────────────────────────────
export interface AutomationRecord {
  id: string;
  resource: string;
  resource_name: string;
  resource_canonical_id: string;
  source_name: string;
  correlation_type: 'direct' | 'indirect';
  correlation_key: string;
  correlation_confidence: 'exact' | 'probable';
  aap_host_id: number | null;
  aap_host_name: string;
  aap_job_id: number;
  aap_job_name: string;
  aap_job_status: string;
  aap_job_started_at: string | null;
  aap_job_finished_at: string | null;
  aap_inventory_name: string;
  automation_details: Record<string, unknown>;
  synced_at: string;
  organization: number;
}


// ── Metrics Import ────────────────────────────────────────────────────────────
export interface MetricsImportRecord {
  id: string;
  filename: string;
  source_label: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stats: {
    csvs_found?: number;
    total_csv_rows?: number;
    unique_hosts?: number;
    auto_matched?: number;
    pending_review?: number;
    unmatched?: number;
    automation_records_created?: number;
    learned_mapping_hits?: number;
  };
  error_log: string;
  uploaded_at: string;
  processed_at: string | null;
  organization: number;
  pending_count: number;
  matched_count: number;
}

export interface PendingMatchRecord {
  id: string;
  metrics_import: string;
  aap_host_name: string;
  candidate_resource: string | null;
  candidate_resource_name: string;
  candidate_resource_type: string;
  match_reason: string;
  match_score: number;
  status: 'pending' | 'approved' | 'rejected' | 'ignored';
  resolved_resource: string | null;
  resolved_resource_name: string;
  raw_data: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
}

export interface HostMappingRecord {
  id: string;
  aap_host_name: string;
  source_label: string;
  resource: string;
  resource_name: string;
  created_at: string;
  organization: number;
}

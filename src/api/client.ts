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

// ?? Shared ????????????????????????????????????????????????????????????????

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ?? Providers ?????????????????????????????????????????????????????????????

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
  created: string;
  modified: string;
}

// ?? Collection Runs ???????????????????????????????????????????????????????

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

// ?? Resources ?????????????????????????????????????????????????????????????

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
  organization: number;
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

// ?? Taxonomy ??????????????????????????????????????????????????????????????

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

// ?? Provider Plugins ??????????????????????????????????????????????????????

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

// ?? API client ????????????????????????????????????????????????????????????

export const api = {

  // Providers Ñ full CRUD + collect
  listProviders: () =>
    request<PaginatedResponse<Provider>>('/providers/'),
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

  // Collection runs Ñ read-only + cancel
  listCollectionRuns: (page = 1) =>
    request<PaginatedResponse<CollectionRun>>('/collection-runs/?page=' + page),
  getCollectionRun: (id: string) =>
    request<CollectionRun>('/collection-runs/' + id + '/'),
  cancelCollectionRun: (id: string) =>
    request<CollectionRun>('/collection-runs/' + id + '/cancel/', {
      method: 'POST',
    }),

  // Resources Ñ read-only + sightings + history
  listResources: (params?: string) =>
    request<PaginatedResponse<Resource>>('/resources/' + (params ? '?' + params : '')),
  getResource: (id: string) =>
    request<Resource>('/resources/' + id + '/'),
  getResourceSightings: (id: string) =>
    request<PaginatedResponse<ResourceSighting>>('/resources/' + id + '/sightings/'),
  getResourceHistory: (id: string) =>
    request<PaginatedResponse<ResourceSighting>>('/resources/' + id + '/history/'),

  // Resource relationships Ñ read-only
  listResourceRelationships: (params?: string) =>
    request<PaginatedResponse<ResourceRelationship>>('/resource-relationships/' + (params ? '?' + params : '')),
  getResourceRelationship: (id: string) =>
    request<ResourceRelationship>('/resource-relationships/' + id + '/'),

  // Taxonomy Ñ read-only
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

  // Provider plugins Ñ list, retrieve, upload, uninstall, test, refresh
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
};

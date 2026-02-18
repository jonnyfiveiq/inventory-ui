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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(res.status + ' ' + res.statusText + ': ' + text);
  }

  return res.json();
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Provider {
  id: string;
  name: string;
  vendor: string;
  provider_type: string;
  infrastructure: string;
  endpoint: string;
  enabled: boolean;
  organization: number;
  last_collection_status: string | null;
  created: string;
  modified: string;
}

export type CollectionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled';

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

export interface Resource {
  id: string;
  resource_type: string;
  resource_type_slug: string;
  resource_type_name: string;
  provider: string;
  provider_name: string;
  name: string;
  ems_ref: string;
  state: string;
  power_state: string;
  cpu_count: number | null;
  memory_mb: number | null;
  disk_gb: number | null;
  ip_addresses: string[];
  os_name: string;
  first_discovered_at: string;
  last_seen_at: string;
  seen_count: number;
}

export const api = {
  listProviders: () =>
    request<PaginatedResponse<Provider>>('/providers/'),

  getProvider: (id: string) =>
    request<Provider>('/providers/' + id + '/'),

  triggerCollection: (providerId: string) =>
    request<CollectionRun>('/providers/' + providerId + '/collect/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),

  listCollectionRuns: (page = 1) =>
    request<PaginatedResponse<CollectionRun>>('/collection-runs/?page=' + page),

  getCollectionRun: (id: string) =>
    request<CollectionRun>('/collection-runs/' + id + '/'),

  cancelCollectionRun: (id: string) =>
    request<CollectionRun>('/collection-runs/' + id + '/cancel/', {
      method: 'POST',
    }),

  listResources: (params?: string) =>
    request<PaginatedResponse<Resource>>('/resources/' + (params ? '?' + params : '')),
};

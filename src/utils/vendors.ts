/**
 * Vendor normalization — maps variant vendor strings to a canonical key.
 * E.g. 'amazon' and 'aws' both map to 'aws'.
 */

const VENDOR_ALIASES: Record<string, string> = {
  amazon: 'aws',
  google: 'gcp',
  microsoft: 'azure',
  vsphere: 'vmware',
  redhat: 'openshift',
  kubernetes: 'openshift',
};

/** Return the canonical vendor key for a raw vendor string. */
export function normalizeVendor(raw: string): string {
  const lower = raw.toLowerCase();
  return VENDOR_ALIASES[lower] ?? lower;
}

/** Given a canonical vendor key, return all raw vendor strings that map to it. */
export function vendorAliases(canonical: string): string[] {
  const c = canonical.toLowerCase();
  const aliases = Object.entries(VENDOR_ALIASES)
    .filter(([, v]) => v === c)
    .map(([k]) => k);
  return [c, ...aliases];
}

const VENDOR_NAMES: Record<string, string> = {
  vmware: 'VMware', vsphere: 'VMware',
  aws: 'AWS', amazon: 'AWS',
  google: 'Google Cloud', gcp: 'Google Cloud',
  microsoft: 'Microsoft Azure', azure: 'Microsoft Azure',
  redhat: 'Red Hat', openstack: 'OpenStack',
  openshift: 'OpenShift', kubernetes: 'Kubernetes',
};

export function vendorDisplayName(v: string): string {
  return VENDOR_NAMES[v.toLowerCase()] ?? (v.charAt(0).toUpperCase() + v.slice(1));
}

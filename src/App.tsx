import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
  PageSidebar,
  PageSidebarBody,
  Badge,
  Button,
} from '@patternfly/react-core';

import LoginPage from './pages/Login';
import ProvidersPage from './pages/Providers';
import CollectionRunsPage from './pages/CollectionRuns';
import CollectionRunDetailPage from './pages/CollectionRunDetail';
import InventoryList from './pages/inventory/InventoryList';
import { api } from './api/client';
import type { Provider, ResourceCategory } from './api/client';

// ?? Dynamic inventory nav ?????????????????????????????????????????????????

interface CategoryCount {
  slug: string;
  name: string;
  count: number;
  sortOrder: number;
}

function ProviderNavSection({ provider }: { provider: Provider }) {
  const params = useParams();
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  
  useEffect(() => {
    // Fetch categories and resources in parallel
    // Use resource_type_slug on each resource to look up category via type slug map
    Promise.all([
      api.listResourceCategories(),
      api.listResourceTypes('page_size=200'),
      api.listResources('page_size=500'),
    ]).then(([cats, types, resources]) => {

      // Build slug -> category_slug map
      const typeSlugToCategory: Record<string, string> = {};
      for (const t of types.results) {
        typeSlugToCategory[t.slug] = t.category_slug;
      }

      // Count by category using resource_type_slug
      const counts: Record<string, number> = {};
      for (const r of resources.results.filter((x) => x.provider === provider.id)) {
        const catSlug = typeSlugToCategory[r.resource_type_slug];
        if (catSlug) counts[catSlug] = (counts[catSlug] ?? 0) + 1;
      }

      // Only show categories that have resources
      const items: CategoryCount[] = cats.results
        .filter((c) => (counts[c.slug] ?? 0) > 0)
        .map((c) => ({ slug: c.slug, name: c.name, count: counts[c.slug], sortOrder: c.sort_order }))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      setCategoryCounts(items);
    });
  }, [provider.id]);

  const isProviderActive = params.providerId === provider.id;

  return (
    <NavExpandable
      title={provider.name}
      isExpanded={isProviderActive}
      isActive={isProviderActive}
    >
      {categoryCounts.length === 0 ? (
        <NavItem style={{ opacity: 0.5, fontSize: '0.8rem', paddingLeft: '1.5rem', pointerEvents: 'none' }}>
          No resources collected yet
        </NavItem>
      ) : (
        categoryCounts.map((cat) => (
          <NavItem key={cat.slug} isActive={isProviderActive && params.categorySlug === cat.slug}>
            <NavLink to={`/inventory/${provider.id}/${cat.slug}`}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{cat.name}</span>
                <Badge isRead>{cat.count}</Badge>
              </span>
            </NavLink>
          </NavItem>
        ))
      )}
    </NavExpandable>
  );
}

function InventoryNav() {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    api.listProviders().then((r) => setProviders(r.results));
  }, []);

  if (providers.length === 0) return null;

  return (
    <>
      {providers.map((p) => (
        <ProviderNavSection key={p.id} provider={p} />
      ))}
    </>
  );
}

// ?? Main layout ???????????????????????????????????????????????????????????

function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('inventory_creds');
    navigate('/login');
  };

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <strong>Inventory Service</strong>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Button variant="plain" onClick={handleLogout} style={{ color: 'white', marginLeft: 'auto' }}>
          Log out
        </Button>
      </MastheadContent>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav aria-label="Global nav">
          <NavList>
            <NavItem>
              <NavLink to="/providers" className={({ isActive }) => isActive ? 'pf-m-current' : ''}>
                Providers
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink to="/collection-runs" className={({ isActive }) => isActive ? 'pf-m-current' : ''}>
                Collection Runs
              </NavLink>
            </NavItem>
          </NavList>
        </Nav>
        <Nav aria-label="Inventory nav" style={{ marginTop: '1rem' }}>
          <NavList>
            <NavItem style={{ pointerEvents: 'none', opacity: 0.5, fontSize: '0.7rem', letterSpacing: '0.08em', padding: '0.5rem 1rem' }}>
              INVENTORY
            </NavItem>
            <Routes>
              <Route path="*" element={<InventoryNav />} />
            </Routes>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page header={masthead} sidebar={sidebar}>
      <Routes>
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/collection-runs" element={<CollectionRunsPage />} />
        <Route path="/collection-runs/:id" element={<CollectionRunDetailPage />} />
        <Route path="/inventory/:providerId/:categorySlug" element={<InventoryList />} />
        <Route path="*" element={<Navigate to="/providers" replace />} />
      </Routes>
    </Page>
  );
}

// ?? Root ??????????????????????????????????????????????????????????????????

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('inventory_creds'));

  useEffect(() => {
    const check = () => setAuthed(!!localStorage.getItem('inventory_creds'));
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return (
    <BrowserRouter>
      {authed ? (
        <AppLayout />
      ) : (
        <Routes>
          <Route path="*" element={<LoginPage onLogin={() => setAuthed(true)} />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
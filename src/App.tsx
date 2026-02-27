import { useState, useEffect } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation,
} from 'react-router-dom';
import {
  Page, Masthead, MastheadMain, MastheadBrand, MastheadContent,
  Nav, NavList, NavItem, NavExpandable,
  PageSidebar, PageSidebarBody,
  Button,
} from '@patternfly/react-core';
import LoginPage from './pages/Login';
import CollectionRunsPage from './pages/CollectionRuns';
import CollectionRunDetailPage from './pages/CollectionRunDetail';
import VendorPage from './pages/VendorPage';
import ProvidersOverview from './pages/ProvidersOverview';
import Dashboard from './pages/Dashboard';
import WatchlistList from './pages/WatchlistList';
import WatchlistDetail from './pages/WatchlistDetail';
import DriftTimeline from './pages/DriftTimeline';
import MetricsImport from './pages/MetricsImport';
import ResourceDetail from './pages/ResourceDetail';
import { api } from './api/client';
import { normalizeVendor, vendorDisplayName } from './utils/vendors';

function VendorNav() {
  const [vendors, setVendors] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.listProviders('page_size=200').then((r) => {
      const normalized = new Set(r.results.map((p) => normalizeVendor(p.vendor)));
      setVendors(Array.from(normalized).sort());
    });
  }, []);

  const isActive = location.pathname.startsWith('/inventory/vendors');

  return (
    <NavExpandable
      title="Providers"
      isExpanded={true}
      isActive={isActive}
    >
      <NavItem isActive={location.pathname === '/inventory/providers'}>
        <NavLink to="/inventory/providers">Overview</NavLink>
      </NavItem>
      {vendors.map((v) => (
        <NavItem key={v} isActive={location.pathname === '/inventory/vendors/' + v}>
          <NavLink to={'/inventory/vendors/' + v}>{vendorDisplayName(v)}</NavLink>
        </NavItem>
      ))}
    </NavExpandable>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav>
          <NavList>
            <NavItem isActive={location.pathname === '/inventory/dashboard'}>
              <NavLink to="/inventory/dashboard">Dashboard</NavLink>
            </NavItem>
            <VendorNav />
            <NavItem isActive={location.pathname === '/collection-runs'}>
              <NavLink to="/collection-runs">Collection Runs</NavLink>
            </NavItem>
            <NavItem isActive={location.pathname.startsWith('/watchlists')}>
              <NavLink to="/watchlists">Watchlists</NavLink>
            </NavItem>
            <NavItem isActive={location.pathname.startsWith('/metrics-import')}>
              <NavLink to="/metrics-import">Metrics Import</NavLink>
            </NavItem>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page
      masthead={
        <Masthead>
          <MastheadMain>
            <MastheadBrand>
              <span style={{ color: 'white', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/inventory/dashboard')}>
                AAP Inventory
              </span>
            </MastheadBrand>
          </MastheadMain>
          <MastheadContent>
            <Button variant="plain" style={{ color: 'white' }} onClick={() => { localStorage.removeItem('inventory_creds'); window.location.reload(); }}>
              Logout
            </Button>
          </MastheadContent>
        </Masthead>
      }
      sidebar={sidebar}
    >
      <Routes>
        <Route path="/collection-runs" element={<CollectionRunsPage />} />
        <Route path="/collection-runs/:id" element={<CollectionRunDetailPage />} />
        <Route path="/inventory/dashboard" element={<Dashboard />} />
        <Route path="/inventory/providers" element={<ProvidersOverview />} />
        <Route path="/inventory/vendors/:vendor" element={<VendorPage />} />
        <Route path="/watchlists" element={<WatchlistList />} />
        <Route path="/watchlists/:id" element={<WatchlistDetail />} />
        <Route path="/resources/:id" element={<ResourceDetail />} />
        <Route path="/metrics-import" element={<MetricsImport />} />
        <Route path="/resources/:id/drift" element={<DriftTimeline />} />
        <Route path="*" element={<Navigate to="/inventory/dashboard" replace />} />
      </Routes>
    </Page>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('inventory_creds'));
  useEffect(() => {
    const sync = () => setAuthed(!!localStorage.getItem('inventory_creds'));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return (
    <BrowserRouter>
      {authed ? <AppLayout /> : (
        <Routes><Route path="*" element={<LoginPage onLogin={() => setAuthed(true)} />} /></Routes>
      )}
    </BrowserRouter>
  );
}

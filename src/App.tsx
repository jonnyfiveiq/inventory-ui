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

  const isActive = location.pathname.startsWith('/inventory');

  return (
    <NavExpandable
      title="Providers"
      isExpanded={true}
      isActive={isActive}
    >
      <NavItem isActive={location.pathname === '/inventory/providers'}>
        <NavLink to="/inventory/providers">All Providers</NavLink>
      </NavItem>
      {vendors.length === 0 ? (
        <NavItem style={{ opacity: 0.5, fontSize: '0.82rem', padding: '0.3rem 1rem 0.3rem 2rem', pointerEvents: 'none' }}>
          No providers yet
        </NavItem>
      ) : vendors.map((v) => {
        const active = location.pathname === '/inventory/vendors/' + v;
        return (
          <NavItem key={v} isActive={active}>
            <NavLink to={'/inventory/vendors/' + v}>{vendorDisplayName(v)}</NavLink>
          </NavItem>
        );
      })}
    </NavExpandable>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTaskMgmtActive = location.pathname.startsWith('/collection-runs');

  return (
    <Page
      header={
        <Masthead>
          <MastheadMain><MastheadBrand><strong>Inventory Service</strong></MastheadBrand></MastheadMain>
          <MastheadContent style={{ marginLeft: 'auto' }}>
            <Button variant="plain" style={{ color: 'white' }}
              onClick={() => { localStorage.removeItem('inventory_creds'); navigate('/login'); }}>Log out</Button>
          </MastheadContent>
        </Masthead>
      }
      sidebar={
        <PageSidebar>
          <PageSidebarBody>
            <Nav aria-label="Main navigation">
              <NavList>
                <NavItem>
                  <NavLink to="/inventory/dashboard" className={({ isActive }) => isActive ? 'pf-m-current' : ''}>Dashboard</NavLink>
                </NavItem>
                <NavItem style={{ pointerEvents: 'none', opacity: 0.45, fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1rem 1rem 0.25rem' }}>Inventory</NavItem>
                <Routes><Route path="*" element={<VendorNav />} /></Routes>
                <NavExpandable
                  title="Task Management"
                  groupId="task-management"
                  isActive={isTaskMgmtActive}
                  isExpanded={isTaskMgmtActive}
                >
                  <NavItem isActive={location.pathname.startsWith('/collection-runs')}>
                    <NavLink to="/collection-runs" className={({ isActive }) => isActive ? 'pf-m-current' : ''}>Collection Runs</NavLink>
                  </NavItem>
                </NavExpandable>
              </NavList>
            </Nav>
          </PageSidebarBody>
        </PageSidebar>
      }
    >
      <Routes>
        <Route path="/collection-runs" element={<CollectionRunsPage />} />
        <Route path="/collection-runs/:id" element={<CollectionRunDetailPage />} />
        <Route path="/inventory/dashboard" element={<Dashboard />} />
        <Route path="/inventory/providers" element={<ProvidersOverview />} />
        <Route path="/inventory/vendors/:vendor" element={<VendorPage />} />
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

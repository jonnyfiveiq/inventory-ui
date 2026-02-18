import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  Nav,
  NavList,
  NavItem,
  PageSidebar,
  PageSidebarBody,
  Button,
} from '@patternfly/react-core';

import LoginPage from './pages/Login';
import ProvidersPage from './pages/Providers';
import CollectionRunsPage from './pages/CollectionRuns';
import CollectionRunDetailPage from './pages/CollectionRunDetail';

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
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar}>
      <Routes>
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/collection-runs" element={<CollectionRunsPage />} />
        <Route path="/collection-runs/:id" element={<CollectionRunDetailPage />} />
        <Route path="*" element={<Navigate to="/providers" replace />} />
      </Routes>
    </Page>
  );
}

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

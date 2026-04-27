'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header collapsed={collapsed} />
      <main style={{
        marginLeft: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        paddingTop: 'var(--header-height)',
        transition: 'margin-left 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: '100vh',
      }}>
        <div style={{ padding: '24px', maxWidth: '1400px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

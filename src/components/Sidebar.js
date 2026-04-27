'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/leads', icon: '👥', label: 'Leads' },
  { href: '/pipeline', icon: '🔄', label: 'Pipeline' },
  { href: '/followups', icon: '📅', label: 'Follow-ups' },
  { href: '/deals', icon: '🤝', label: 'Deals' },
  { href: '/properties', icon: '🏠', label: 'Properties' },
  { href: '/documents', icon: '📄', label: 'Documents' },
];

import { useAuth } from '@/context/AuthContext';

export default function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();

  const isAdmin = userProfile?.role === 'admin';

  const currentNavItems = [
    ...navItems,
    ...(isAdmin ? [
      { href: '/analytics', icon: '📈', label: 'Analytics' },
      { href: '/team', icon: '👔', label: 'Team' }
    ] : [])
  ];

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <span>🏢</span>
        </div>
        {!collapsed && (
          <div className={styles.logoText}>
            <h2>RealCRM</h2>
            <span>Real Estate Manager</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        <span className={styles.navLabel}>{!collapsed && 'MAIN MENU'}</span>
        {currentNavItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
            title={item.label}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span className={styles.navText}>{item.label}</span>}
            {pathname === item.href && <div className={styles.activeIndicator} />}
          </Link>
        ))}
      </nav>

      <button className={styles.collapseBtn} onClick={onToggle}>
        <span>{collapsed ? '→' : '←'}</span>
      </button>
    </aside>
  );
}

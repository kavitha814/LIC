import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  ScanLine, 
  History, 
  Settings, 
  UserCheck,
  X
} from 'lucide-react';
import type { AppSettings } from '../types';

export type ActiveTab = 'dashboard' | 'policies' | 'customers' | 'ocr' | 'yearly' | 'audit' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  settings: AppSettings;
  policyCount: number;
  customerCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  settings,
  policyCount,
  customerCount,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'policies' as ActiveTab, label: 'Policy Register', icon: FileText, count: policyCount },
    { id: 'customers' as ActiveTab, label: 'Policyholders 360', icon: Users, count: customerCount },
    { id: 'ocr' as ActiveTab, label: 'Scan & Digitizer', icon: ScanLine, badge: 'OCR' },
    { id: 'audit' as ActiveTab, label: 'Audit Trail', icon: History },
    { id: 'settings' as ActiveTab, label: 'Settings & Backup', icon: Settings },
  ];

  const handleItemClick = (id: ActiveTab) => {
    onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div>
        <div style={{
          padding: '0 8px 16px 8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-dim)',
              fontWeight: 700,
              marginBottom: '2px'
            }}>
              Agency Portal
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-main)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {settings.agencyName}
            </div>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              className="only-mobile"
              onClick={onCloseMobile}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: 'var(--text-main)'
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? '#eff6ff' : 'transparent',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                  color: isActive ? '#1d4ed8' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '14px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} color={isActive ? '#2563eb' : 'currentColor'} />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    background: isActive ? '#2563eb' : 'var(--bg-elevated)',
                    color: isActive ? '#ffffff' : 'var(--text-dim)',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontWeight: 600
                  }}>
                    {item.count}
                  </span>
                )}

                {item.badge && (
                  <span style={{
                    fontSize: '10px',
                    background: '#fef3c7',
                    color: '#b45309',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Agent details footer badge */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <UserCheck size={14} color="#059669" />
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{settings.agentName}</span>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
          Code: <span className="mono-text" style={{ color: '#d97706', fontWeight: 600 }}>{settings.agentCode}</span>
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '2px' }}>
          Branch: {settings.branchCode}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="app-sidebar desktop-sidebar" style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        padding: '20px 14px',
        flexShrink: 0
      }}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {isOpenMobile && (
        <div 
          className="mobile-drawer-overlay"
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            className="mobile-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '82%',
              maxWidth: '310px',
              height: '100%',
              background: 'var(--bg-secondary)',
              boxShadow: '4px 0 24px rgba(15, 23, 42, 0.2)',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Menu,
  Camera
} from 'lucide-react';
import type { ActiveTab } from './Sidebar';

interface MobileNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenMenu?: () => void;
  onOpenScanCamera?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ 
  activeTab, 
  onSelectTab, 
  onOpenMenu,
  onOpenScanCamera
}) => {
  const items = [
    { id: 'dashboard' as ActiveTab, label: 'Home', icon: LayoutDashboard },
    { id: 'policies' as ActiveTab, label: 'Policies', icon: FileText },
    { id: 'ocr' as ActiveTab, label: 'Scan', icon: Camera, isCenter: true },
    { id: 'customers' as ActiveTab, label: 'Clients', icon: Users },
    { id: 'settings' as ActiveTab, label: 'Menu', icon: Menu, isMenuTrigger: true },
  ];

  return (
    <nav className="mobile-nav" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '62px',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      boxShadow: '0 -2px 12px rgba(15, 23, 42, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 999,
      padding: '0 4px',
      paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))'
    }}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        if (item.isCenter) {
          return (
            <button
              key={item.id}
              onClick={() => {
                if (onOpenScanCamera) {
                  onOpenScanCamera();
                } else {
                  onSelectTab(item.id);
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '50%',
                width: '46px',
                height: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                cursor: 'pointer',
                marginTop: '-18px',
                flexShrink: 0
              }}
              title="Scan Policy Document with Camera"
            >
              <Icon size={22} color="#ffffff" strokeWidth={2.4} />
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.isMenuTrigger && onOpenMenu) {
                onOpenMenu();
              } else {
                onSelectTab(item.id);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              color: isActive ? '#2563eb' : 'var(--text-dim)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              flex: 1,
              height: '100%'
            }}
          >
            <Icon size={19} color={isActive ? '#2563eb' : 'currentColor'} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

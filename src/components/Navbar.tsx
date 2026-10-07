import React, { useState } from 'react';
import { 
  Lock, 
  PlusCircle, 
  Menu
} from 'lucide-react';
import type { AppSettings } from '../types';
import { MobileOfflineModal } from './MobileOfflineModal';

interface NavbarProps {
  settings: AppSettings;
  maskSensitive: boolean;
  onToggleMask: () => void;
  onOpenNewPolicy: () => void;
  onOpenOCR: () => void;
  onLockApp: () => void;
  policyCount?: number;
  customerCount?: number;
  onDataRefresh?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  maskSensitive: _maskSensitive,
  onToggleMask: _onToggleMask,
  onOpenNewPolicy,
  onOpenOCR: _onOpenOCR,
  onLockApp,
  policyCount = 78,
  customerCount = 73,
  onDataRefresh,
  onOpenMobileMenu
}) => {
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  return (
    <>
      <header className="app-header" style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Left: Hamburger & Clean App Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onOpenMobileMenu && (
              <button
                type="button"
                className="only-mobile"
                onClick={onOpenMobileMenu}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '7px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Open menu drawer"
              >
                <Menu size={20} />
              </button>
            )}

            <div>
              <h1 style={{
                fontSize: '17px',
                fontWeight: 800,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
                margin: 0,
                whiteSpace: 'nowrap'
              }}>
                LIC Policy Manager
              </h1>
              <p className="no-mobile" style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
                {settings.agencyName} • Branch {settings.branchCode}
              </p>
            </div>
          </div>

          {/* Right: Clean, Minimal Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Add Policy Button */}
            <button 
              type="button" 
              id="navbar-add-policy-btn"
              className="btn btn-gold btn-sm"
              onClick={onOpenNewPolicy}
              style={{ padding: '6px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Add New Policy to Register"
            >
              <PlusCircle size={15} />
              <span>Add Policy</span>
            </button>

            {/* Lock App (Only if PIN protected) */}
            {settings.pinProtected && (
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={onLockApp}
                title="Lock Application"
                style={{ padding: '6px 8px' }}
              >
                <Lock size={14} color="#f43f5e" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Storage & Offline Info Modal */}
      <MobileOfflineModal 
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        policyCount={policyCount}
        customerCount={customerCount}
        onDataReset={onDataRefresh}
      />
    </>
  );
};

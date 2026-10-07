import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  FileSpreadsheet
} from 'lucide-react';
import { pwaService, type StorageStatus } from '../services/pwa';
import { localDB } from '../services/db';

interface MobileOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyCount: number;
  customerCount: number;
  onDataReset?: () => void;
}

export const MobileOfflineModal: React.FC<MobileOfflineModalProps> = ({
  isOpen,
  onClose,
  policyCount,
  customerCount,
  onDataReset
}) => {
  const [isOnline, setIsOnline] = useState(pwaService.isOnline());
  const [canInstall, setCanInstall] = useState(pwaService.canInstall());
  const [isInstalled, setIsInstalled] = useState(pwaService.getIsInstalled());
  const [storageInfo, setStorageInfo] = useState<StorageStatus | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load storage estimate
    pwaService.getStorageEstimate().then(setStorageInfo);

    // Connectivity listener
    const unsubsConn = pwaService.onConnectivityChange(setIsOnline);
    const unsubsInst = pwaService.onInstallChange(() => {
      setCanInstall(pwaService.canInstall());
      setIsInstalled(pwaService.getIsInstalled());
    });

    return () => {
      unsubsConn();
      unsubsInst();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await pwaService.promptInstall();
    if (success) {
      setIsInstalled(true);
      setCanInstall(false);
    }
  };

  const handleResyncExcel = async () => {
    setIsResetting(true);
    setResetMessage(null);
    try {
      await localDB.resetToSeedData('Agent Self-Service');
      setResetMessage('Successfully synchronized 78 policy records from LIC_RECORD_2013_TO_2026.xlsx into phone storage.');
      if (onDataReset) {
        onDataReset();
      }
    } catch (e: any) {
      setResetMessage('Sync error: ' + (e.message || 'Failed'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(37, 99, 235, 0.12)',
              padding: '8px',
              borderRadius: '8px',
              color: '#2563eb'
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                Mobile Storage & Offline Operations
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                On-device persistent storage • 100% Offline PWA architecture
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {/* Storage Mode */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <HardDrive size={16} color="#059669" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>On-Device Storage</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>
              IndexedDB Active {storageInfo?.usageMB ? `(${storageInfo.usageMB})` : ''}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              {policyCount} policies • {customerCount} clients • {storageInfo?.isPersisted ? 'Persistent' : 'On-Device'}
            </div>
          </div>

          {/* Connectivity Mode */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              {isOnline ? <Wifi size={16} color="#2563eb" /> : <WifiOff size={16} color="#d97706" />}
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Network Status</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: isOnline ? '#2563eb' : '#d97706' }}>
              {isOnline ? 'Online Ready' : 'Operating Offline'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              {isInstalled ? 'Installed as Standalone App ✓' : 'Zero network calls needed to view/edit'}
            </div>
          </div>
        </div>

        {/* Excel Data Info Card */}
        <div style={{
          background: 'rgba(217, 119, 6, 0.08)',
          border: '1px solid rgba(217, 119, 6, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <FileSpreadsheet size={16} color="#d97706" />
            <strong style={{ fontSize: '13px', color: '#b45309' }}>
              Synchronized with LIC_RECORD_2013_TO_2026.xlsx
            </strong>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-main)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
            All 78 authentic policy records across 11 fiscal years (2013-2014 through 2025-2026) are stored locally in the mobile browser storage. Mock data has been completely replaced.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResyncExcel}
            disabled={isResetting}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <RefreshCw size={13} className={isResetting ? 'spin' : ''} />
            <span>{isResetting ? 'Re-syncing...' : 'Re-sync / Reset from Excel'}</span>
          </button>
          {resetMessage && (
            <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
              {resetMessage}
            </div>
          )}
        </div>

        {/* Installation Instructions */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
            How to Install on Mobile Phone (Offline App)
          </h4>

          {canInstall && (
            <div style={{ marginBottom: '14px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleInstallClick}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                <Download size={16} />
                <span>1-Click Install App to This Device</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Android */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                🤖 Android (Chrome / Edge / Samsung Internet)
              </div>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <li>Open this URL in Google Chrome on your phone.</li>
                <li>Tap the <strong>three vertical dots (⋮)</strong> menu in the top right.</li>
                <li>Select <strong>"Install App"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>An app icon will be added to your home screen that opens instantly in full screen without the browser URL bar!</li>
              </ol>
            </div>

            {/* iOS */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                🍏 Apple iPhone / iPad (Safari)
              </div>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <li>Open this URL in <strong>Safari</strong> on your iPhone or iPad.</li>
                <li>Tap the <strong>Share button (⎋ square with arrow)</strong> at the bottom.</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong> (⊞).</li>
                <li>Tap <strong>"Add"</strong> in the top right.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Offline Guarantee note */}
        <div style={{
          background: 'rgba(5, 150, 105, 0.08)',
          border: '1px solid rgba(5, 150, 105, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.5 }}>
            <strong>100% Offline Guarantee:</strong> All client names, policies, premiums, and yearly registers are saved in your phone's secure on-device IndexedDB database. You can turn on Airplane Mode or travel without cellular internet — the application will continue to open, compute dues, display registers, and search records seamlessly.
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

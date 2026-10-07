import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  HardDrive, 
  Download, 
  Upload, 
  RefreshCcw, 
  CheckCircle, 
  Building2, 
  FileSpreadsheet,
  Bell,
  BellRing
} from 'lucide-react';
import type { AppSettings, Customer, Policy } from '../types';
import { localDB } from '../services/db';
import { downloadJSONFile, exportPoliciesToCSV } from '../services/export';
import { notificationService } from '../services/notifications';

interface SettingsViewProps {
  settings: AppSettings;
  policies: Policy[];
  customers: Customer[];
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  policies,
  customers,
  onSaveSettings,
  onRefreshData
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testNotifSent, setTestNotifSent] = useState(false);
  const [pendingNotifCount, setPendingNotifCount] = useState(0);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  useEffect(() => {
    notificationService.getPendingCount().then(setPendingNotifCount);
  }, []);

  const handleTestNotification = async () => {
    const success = await notificationService.sendImmediateTestNotification();
    if (success) {
      setTestNotifSent(true);
      setTimeout(() => setTestNotifSent(false), 4000);
    } else {
      alert('Notification permission was not granted. Please check phone notification settings.');
    }
  };

  const handleRescheduleDues = async () => {
    const count = await notificationService.scheduleDueNotifications(policies, formData.reminderDaysBefore || 7);
    setPendingNotifCount(count);
    setSaveMessage(`Successfully scheduled ${count} due date alerts on your phone!`);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  // Restore state
  const [restoreMessage, setRestoreMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveSettings(formData);
    setIsSaving(false);
    setSaveMessage('Agency settings updated successfully.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Export full JSON Backup
  const handleExportBackup = async () => {
    const backupJson = await localDB.exportFullBackup();
    const filename = `LIC_Policy_Manager_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    downloadJSONFile(filename, backupJson);
  };

  // Restore Backup
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await localDB.restoreFullBackup(text);
        if (res.success) {
          setRestoreMessage({ text: res.message });
          await onRefreshData();
        } else {
          setRestoreMessage({ text: res.message, isError: true });
        }
      } catch {
        setRestoreMessage({ text: 'Failed to read backup file.', isError: true });
      }
    };
    reader.readAsText(file);
  };

  // Reset to Seed
  const handleResetToSeed = async () => {
    if (window.confirm('Are you sure you want to re-sync all 78 authentic records from the Excel ledger? Any local modifications will be reset.')) {
      await localDB.resetToSeedData();
      await onRefreshData();
      setRestoreMessage({ text: 'Database re-synchronized with authentic 78 policy records from Excel ledger.' });
      setTimeout(() => setRestoreMessage(null), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="lic-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={22} color="#d97706" />
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Agency Configuration & Data Management
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Manage agency credentials, local security lock, and offline backup / recovery operations.
            </p>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>
        {/* Left Column: Agency Profile & Security */}
        <div className="lic-card">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="#3b82f6" />
            Agency & Branch Profile
          </h3>

          {saveMessage && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '12.5px',
              color: '#065f46',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle size={15} />
              <span>{saveMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Agency / Advisory Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.agencyName}
                onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Agent Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.agentName}
                  onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Agent Code</label>
                <input
                  type="text"
                  className="form-input mono-text"
                  value={formData.agentCode}
                  onChange={(e) => setFormData({ ...formData, agentCode: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Branch Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.branchCode}
                  onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Division</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.divisionName}
                  onChange={(e) => setFormData({ ...formData, divisionName: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contact Mobile</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contact Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>

            {/* Notification & Due Alerts Config */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} color="#d97706" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Mobile Due Date Alerts
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={formData.notificationsEnabled !== false}
                    onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Remind me</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="form-input"
                  style={{ width: '60px', padding: '4px 8px', textAlign: 'center' }}
                  value={formData.reminderDaysBefore || 7}
                  onChange={(e) => setFormData({ ...formData, reminderDaysBefore: parseInt(e.target.value) || 7 })}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>days before due date</span>
                
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestNotification}
                  style={{ marginLeft: 'auto', fontSize: '11px', padding: '4px 8px' }}
                  title="Test notification sound & banner on this device"
                >
                  <BellRing size={12} />
                  <span>Test Alert</span>
                </button>
              </div>

              {testNotifSent && (
                <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                  ✓ Test notification sent! Check your phone's notification shade.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #fef3c7', paddingTop: '8px' }}>
                <span style={{ fontSize: '11.5px', color: '#92400e' }}>
                  Active scheduled due alerts: <strong>{pendingNotifCount}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleRescheduleDues}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Reschedule Now
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="btn btn-gold" style={{ marginTop: '10px' }}>
              Save Agency Settings
            </button>
          </form>
        </div>

        {/* Right Column: Offline Data Backup, Restore & Export */}
        <div className="lic-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="#059669" />
              Offline Database & Data Portability
            </h3>

            {restoreMessage && (
              <div style={{
                background: restoreMessage.isError ? '#fff1f2' : '#ecfdf5',
                border: `1px solid ${restoreMessage.isError ? '#fecdd3' : '#a7f3d0'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '12.5px',
                color: restoreMessage.isError ? '#be123c' : '#065f46',
                marginBottom: '16px'
              }}>
                {restoreMessage.text}
              </div>
            )}

            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              fontSize: '12.5px',
              marginBottom: '18px'
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                Local IndexedDB Storage Status:
              </div>
              <div style={{ color: 'var(--text-dim)' }}>
                • Policies Registered: <strong style={{ color: 'var(--text-main)' }}>{policies.length}</strong>
              </div>
              <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>
                • Policyholders Stored: <strong style={{ color: 'var(--text-main)' }}>{customers.length}</strong>
              </div>
              <div style={{ color: '#059669', marginTop: '6px', fontWeight: 600 }}>
                ✓ Zero external server connection required. Completely local and private.
              </div>
            </div>

            {/* Action Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Export Full Backup */}
              <div style={{
                padding: '12px 14px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Full Real Database Backup</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                    Exports complete snapshot of all active policies, clients, and audit trails
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportBackup}
                >
                  <Download size={14} color="#2563eb" />
                  <span>Download Backup</span>
                </button>
              </div>

              {/* Restore Full Backup */}
              <div style={{
                padding: '12px 14px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Restore Database from Backup</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                    Upload previously exported JSON backup file
                  </div>
                </div>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Upload size={14} color="#059669" />
                  <span>Restore File</span>
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileRestore}
                  />
                </label>
              </div>

              {/* CSV Export Bundle */}
              <div style={{
                padding: '12px 14px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Export Spreadsheet (CSV)</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                    Export current active records directly to Excel-compatible CSV
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => exportPoliciesToCSV(policies, 'LIC_Policies')}
                >
                  <FileSpreadsheet size={14} color="#d97706" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reset / Re-sync Button */}
          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Re-sync from Excel Workbook (2013-2026)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Restore all 78 authentic policy records from LIC_RECORD_2013_TO_2026.xlsx across 11 annual sheets
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetToSeed}
              style={{ color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
            >
              <RefreshCcw size={13} />
              <span>Re-sync Excel Ledger</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

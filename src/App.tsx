import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, type ActiveTab } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { DashboardView } from './components/DashboardView';
import { PoliciesView } from './components/PoliciesView';
import { CustomersView } from './components/CustomersView';
import { OCRDigitizerView } from './components/OCRDigitizerView';
import { AuditTrailView } from './components/AuditTrailView';
import { SettingsView } from './components/SettingsView';
import { LockScreen } from './components/LockScreen';
import { SmartCameraScanner } from './components/SmartCameraScanner';
import { localDB } from './services/db';
import { notificationService } from './services/notifications';
import type { Policy, Customer, AuditLog, AppSettings, DashboardStats } from './types';
import { INITIAL_SETTINGS } from './data/seedData';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [stats, setStats] = useState<DashboardStats>({
    totalPolicies: 0,
    activePolicies: 0,
    totalSumAssured: 0,
    annualPremiumPortfolio: 0,
    duesNext30Days: 0,
    dueAmountNext30Days: 0,
    lapsedCount: 0,
    maturedCount: 0,
    totalCustomers: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [maskSensitive, setMaskSensitive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Cross-view navigation state
  const [selectedCustomerIdFor360, setSelectedCustomerIdFor360] = useState<string | null>(null);
  const [selectedPolicyForSchedule, setSelectedPolicyForSchedule] = useState<Policy | null>(null);
  const [isAddPolicyModalOpen, setIsAddPolicyModalOpen] = useState(false);
  const [targetCustomerForNewPolicy, setTargetCustomerForNewPolicy] = useState<Customer | null>(null);

  const handleOpenAddPolicy = (customer?: Customer | null) => {
    setSelectedPolicyForSchedule(null);
    setTargetCustomerForNewPolicy(customer || null);
    setIsAddPolicyModalOpen(true);
    setActiveTab('policies');
  };

  // Load all data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      const [fetchedPols, fetchedCusts, fetchedLogs, fetchedSettings, fetchedStats] = await Promise.all([
        localDB.getPolicies(),
        localDB.getCustomers(),
        localDB.getAuditLogs(),
        localDB.getSettings(),
        localDB.getDashboardStats()
      ]);

      setPolicies(fetchedPols);
      setCustomers(fetchedCusts);
      setAuditLogs(fetchedLogs);
      setSettings(fetchedSettings);
      setStats(fetchedStats);
      setMaskSensitive(fetchedSettings.maskSensitiveData);

      if (fetchedSettings.pinProtected && fetchedSettings.isLocked) {
        setIsLocked(true);
      }
    } catch (err) {
      console.error('Failed to load local data from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Schedule native push notifications for upcoming policy dues
  useEffect(() => {
    if (policies.length > 0 && settings.notificationsEnabled !== false) {
      notificationService.scheduleDueNotifications(policies, settings.reminderDaysBefore || 7);
    }
  }, [policies, settings.notificationsEnabled, settings.reminderDaysBefore]);

  // Policy Save Handler
  const handleSavePolicy = async (policy: Policy) => {
    await localDB.savePolicy(policy, settings.agentName);
    await refreshAllData();
  };

  // Policy Delete Handler
  const handleDeletePolicy = async (id: string) => {
    await localDB.deletePolicy(id, settings.agentName);
    await refreshAllData();
  };

  // Customer Save Handler
  const handleSaveCustomer = async (customer: Customer): Promise<Customer> => {
    const saved = await localDB.saveCustomer(customer, settings.agentName);
    await refreshAllData();
    return saved;
  };

  // Customer Delete Handler
  const handleDeleteCustomer = async (id: string) => {
    await localDB.deleteCustomer(id, settings.agentName);
    await refreshAllData();
  };

  // Settings Save Handler
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await localDB.saveSettings(newSettings, settings.agentName);
    setSettings(newSettings);
    await refreshAllData();
  };

  // Privacy mask toggle
  const handleToggleMask = () => {
    const nextVal = !maskSensitive;
    setMaskSensitive(nextVal);
    handleSaveSettings({ ...settings, maskSensitiveData: nextVal });
  };

  // Lock Application
  const handleLockApp = () => {
    setIsLocked(true);
    handleSaveSettings({ ...settings, isLocked: true });
  };

  // Unlock Application
  const handleUnlockApp = () => {
    setIsLocked(false);
    handleSaveSettings({ ...settings, isLocked: false });
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2563eb',
        fontSize: '15px',
        fontWeight: 600,
        gap: '12px'
      }}>
        <span>Initializing Local Policy Database...</span>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* PIN Lock Screen Modal if locked */}
      {isLocked && (
        <LockScreen settings={settings} onUnlock={handleUnlockApp} />
      )}

      {/* Desktop Sidebar & Mobile Drawer */}
      <Sidebar 
        activeTab={activeTab} 
        onSelectTab={setActiveTab}
        settings={settings}
        policyCount={policies.length}
        customerCount={customers.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-layout">
        <Navbar 
          settings={settings}
          maskSensitive={maskSensitive}
          onToggleMask={handleToggleMask}
          onOpenNewPolicy={() => handleOpenAddPolicy()}
          onOpenOCR={() => setActiveTab('ocr')}
          onLockApp={handleLockApp}
          policyCount={policies.length}
          customerCount={customers.length}
          onDataRefresh={refreshAllData}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="content-wrapper">
          {activeTab === 'dashboard' && (
            <DashboardView 
              stats={stats}
              policies={policies}
              customers={customers}
              settings={settings}
              maskSensitive={maskSensitive}
              onNavigate={setActiveTab}
              onOpenNewPolicy={() => handleOpenAddPolicy()}
              onOpenOCR={() => setActiveTab('ocr')}
              onViewPolicyDetails={(p) => {
                setSelectedPolicyForSchedule(p);
                setActiveTab('policies');
              }}
            />
          )}

          {(activeTab === 'policies' || activeTab === 'yearly') && (
            <PoliciesView 
              policies={policies}
              customers={customers}
              settings={settings}
              maskSensitive={maskSensitive}
              onSavePolicy={handleSavePolicy}
              onDeletePolicy={handleDeletePolicy}
              onSelectCustomer={(custId) => {
                setSelectedCustomerIdFor360(custId);
                setActiveTab('customers');
              }}
              initialSelectedPolicy={selectedPolicyForSchedule}
              isCreateOpen={isAddPolicyModalOpen}
              onCloseCreate={() => {
                setIsAddPolicyModalOpen(false);
                setTargetCustomerForNewPolicy(null);
              }}
              targetCustomer={targetCustomerForNewPolicy}
              onSaveCustomer={handleSaveCustomer}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView 
              customers={customers}
              policies={policies}
              settings={settings}
              maskSensitive={maskSensitive}
              onSaveCustomer={async (c) => { await handleSaveCustomer(c); }}
              onDeleteCustomer={handleDeleteCustomer}
              onAddPolicyForCustomer={(c) => {
                handleOpenAddPolicy(c);
              }}
              onSelectPolicy={(p) => {
                setSelectedPolicyForSchedule(p);
                setActiveTab('policies');
              }}
              initialSelectedCustomerId={selectedCustomerIdFor360}
            />
          )}

          {activeTab === 'ocr' && (
            <OCRDigitizerView 
              customers={customers}
              settings={settings}
              onSavePolicy={handleSavePolicy}
              onSaveCustomer={handleSaveCustomer}
              onSuccess={() => {
                setActiveTab('policies');
              }}
            />
          )}

          {activeTab === 'audit' && (
            <AuditTrailView auditLogs={auditLogs} />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              settings={settings}
              policies={policies}
              customers={customers}
              onSaveSettings={handleSaveSettings}
              onRefreshData={refreshAllData}
            />
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Bar */}
      <MobileNav 
        activeTab={activeTab} 
        onSelectTab={setActiveTab} 
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        onOpenScanCamera={() => setIsCameraScannerOpen(true)}
      />

      {/* Instant Smart Camera Policy Scanner */}
      <SmartCameraScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        policies={policies}
        customers={customers}
        settings={settings}
        onSavePolicy={handleSavePolicy}
        onSaveCustomer={handleSaveCustomer}
        onPolicyAdded={(newPol) => {
          setSelectedPolicyForSchedule(newPol);
          setActiveTab('policies');
        }}
      />
    </div>
  );
}

export default App;

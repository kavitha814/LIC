import type { Customer, Policy, AuditLog, AppSettings, ScannedDocument, DashboardStats } from '../types';
import { INITIAL_CUSTOMERS, INITIAL_POLICIES, INITIAL_SETTINGS, INITIAL_AUDIT_LOGS } from '../data/seedData';

// Clean up any demo mode storage or database remnants
try {
  localStorage.removeItem('lic_demo_mode_active');
  if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
    indexedDB.deleteDatabase('LIC_POLICY_MANAGER_DEMO_DB');
  }
} catch {
  // Ignore browser security quirks
}

const DB_NAME = 'LIC_POLICY_MANAGER_DB';
const DB_VERSION = 2;
const CURRENT_SEED_VERSION = 'LIC_EXCEL_2013_2026_V4';

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          const custStore = db.createObjectStore('customers', { keyPath: 'id' });
          custStore.createIndex('fullName', 'fullName', { unique: false });
          custStore.createIndex('mobile', 'mobile', { unique: false });
        }

        // Policies store
        let polStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('policies')) {
          polStore = db.createObjectStore('policies', { keyPath: 'id' });
          polStore.createIndex('policyNumber', 'policyNumber', { unique: true });
          polStore.createIndex('customerId', 'customerId', { unique: false });
          polStore.createIndex('commencementYear', 'commencementYear', { unique: false });
          polStore.createIndex('financialYear', 'financialYear', { unique: false });
          polStore.createIndex('status', 'status', { unique: false });
          polStore.createIndex('nextDueDate', 'nextDueDate', { unique: false });
        } else {
          polStore = (event.target as IDBOpenDBRequest).transaction!.objectStore('policies');
          if (!polStore.indexNames.contains('financialYear')) {
            polStore.createIndex('financialYear', 'financialYear', { unique: false });
          }
        }

        // Audit Logs store
        if (!db.objectStoreNames.contains('audit_logs')) {
          const logStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Scanned Documents store
        if (!db.objectStoreNames.contains('scanned_documents')) {
          const docStore = db.createObjectStore('scanned_documents', { keyPath: 'id' });
          docStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        await this.ensureSeedData(db);
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private async ensureSeedData(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      const tx = db.transaction(['customers', 'policies', 'settings', 'audit_logs'], 'readwrite');
      const custStore = tx.objectStore('customers');
      const polStore = tx.objectStore('policies');
      const setStore = tx.objectStore('settings');
      const logStore = tx.objectStore('audit_logs');

      const seedReq = setStore.get('seed_version');
      const countReq = polStore.count();

      seedReq.onsuccess = () => {
        countReq.onsuccess = () => {
          const currentVersion = seedReq.result?.value;
          const polCount = countReq.result || 0;
          const needsUpgrade = currentVersion !== CURRENT_SEED_VERSION || polCount === 0;

          if (needsUpgrade) {
            // Replace any previous mock or outdated data with authentic 78 records from Excel
            custStore.clear();
            polStore.clear();
            logStore.clear();

            INITIAL_CUSTOMERS.forEach((c) => custStore.put(c));
            INITIAL_POLICIES.forEach((p) => polStore.put(p));
            INITIAL_AUDIT_LOGS.forEach((l) => logStore.put(l));
            setStore.put({ key: 'app_settings', value: INITIAL_SETTINGS });
            setStore.put({ key: 'seed_version', value: CURRENT_SEED_VERSION });
          }
        };
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Don't block
    });
  }

  // Generic helper for transaction
  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
    const db = await this.open();
    const tx = db.transaction(storeName, mode);
    return { store: tx.objectStore(storeName), tx };
  }

  // --- CUSTOMERS ---
  async getCustomers(): Promise<Customer[]> {
    const { store } = await this.getStore('customers');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const { store } = await this.getStore('customers');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveCustomer(customer: Customer, user: string = 'Authorized Agent'): Promise<Customer> {
    const isNew = !customer.id;
    const toSave: Customer = {
      ...customer,
      id: customer.id || 'cust-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { store } = await this.getStore('customers', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.put(toSave);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Also update customer name on related policies if name changed
    if (!isNew) {
      const policies = await this.getPolicies();
      const updatedPols = policies.filter(p => p.customerId === toSave.id);
      for (const pol of updatedPols) {
        if (pol.customerName !== toSave.fullName || pol.customerMobile !== toSave.mobile) {
          pol.customerName = toSave.fullName;
          pol.customerMobile = toSave.mobile;
          await this.savePolicy(pol, user, false);
        }
      }
    }

    await this.logAudit({
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'CUSTOMER',
      entityId: toSave.id,
      entitySummary: `${isNew ? 'Added' : 'Updated'} Customer record: ${toSave.fullName} (${toSave.mobile})`,
      userName: user,
      userRole: 'Agent'
    });

    return toSave;
  }

  async deleteCustomer(id: string, user: string = 'Authorized Agent'): Promise<boolean> {
    const cust = await this.getCustomerById(id);
    const { store } = await this.getStore('customers', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (cust) {
      await this.logAudit({
        action: 'DELETE',
        entityType: 'CUSTOMER',
        entityId: id,
        entitySummary: `Deleted customer record: ${cust.fullName}`,
        userName: user,
        userRole: 'Agent'
      });
    }

    return true;
  }

  // --- POLICIES ---
  async getPolicies(): Promise<Policy[]> {
    const { store } = await this.getStore('policies');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a: Policy, b: Policy) => 
          new Date(b.dateOfCommencement).getTime() - new Date(a.dateOfCommencement).getTime()
        );
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getPolicyById(id: string): Promise<Policy | null> {
    const { store } = await this.getStore('policies');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async savePolicy(policy: Policy, user: string = 'Authorized Agent', shouldLog: boolean = true): Promise<Policy> {
    const isNew = !policy.id;
    const docYear = policy.dateOfCommencement 
      ? new Date(policy.dateOfCommencement).getFullYear() 
      : new Date().getFullYear();

    const toSave: Policy = {
      ...policy,
      id: policy.id || 'pol-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      commencementYear: docYear,
      createdAt: policy.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { store } = await this.getStore('policies', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.put(toSave);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (shouldLog) {
      await this.logAudit({
        action: isNew ? 'CREATE' : 'UPDATE',
        entityType: 'POLICY',
        entityId: toSave.id,
        entitySummary: `${isNew ? 'Registered' : 'Updated'} Policy #${toSave.policyNumber} (${toSave.planName}) for ${toSave.customerName || 'Customer'}`,
        userName: user,
        userRole: 'Agent',
        details: { sumAssured: toSave.sumAssured, premium: toSave.totalPremium, status: toSave.status }
      });
    }

    return toSave;
  }

  async deletePolicy(id: string, user: string = 'Authorized Agent'): Promise<boolean> {
    const pol = await this.getPolicyById(id);
    const { store } = await this.getStore('policies', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (pol) {
      await this.logAudit({
        action: 'DELETE',
        entityType: 'POLICY',
        entityId: id,
        entitySummary: `Deleted Policy record #${pol.policyNumber} (${pol.planName})`,
        userName: user,
        userRole: 'Agent'
      });
    }

    return true;
  }

  // --- AUDIT LOGS ---
  async getAuditLogs(): Promise<AuditLog[]> {
    const { store } = await this.getStore('audit_logs');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a: AuditLog, b: AuditLog) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const entry: AuditLog = {
        ...log,
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString()
      };
      const { store } = await this.getStore('audit_logs', 'readwrite');
      store.put(entry);
    } catch (e) {
      console.warn('Failed to write audit log:', e);
    }
  }

  // --- SETTINGS ---
  async getSettings(): Promise<AppSettings> {
    const { store } = await this.getStore('settings');
    return new Promise((resolve) => {
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value);
        } else {
          resolve(INITIAL_SETTINGS);
        }
      };
      req.onerror = () => resolve(INITIAL_SETTINGS);
    });
  }

  async saveSettings(settings: AppSettings, user: string = 'Authorized Agent'): Promise<void> {
    const { store } = await this.getStore('settings', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ key: 'app_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await this.logAudit({
      action: 'UPDATE',
      entityType: 'SYSTEM',
      entitySummary: 'Updated system & agency settings',
      userName: user,
      userRole: 'Admin'
    });
  }

  // --- SCANNED DOCUMENTS ---
  async getScannedDocuments(): Promise<ScannedDocument[]> {
    const { store } = await this.getStore('scanned_documents');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a: ScannedDocument, b: ScannedDocument) => 
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveScannedDocument(doc: ScannedDocument): Promise<ScannedDocument> {
    const { store } = await this.getStore('scanned_documents', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.put(doc);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return doc;
  }

  async deleteScannedDocument(id: string): Promise<boolean> {
    const { store } = await this.getStore('scanned_documents', 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  }

  // --- STATS CALCULATION ---
  async getDashboardStats(): Promise<DashboardStats> {
    const policies = await this.getPolicies();
    const customers = await this.getCustomers();

    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    let totalSumAssured = 0;
    let annualPremiumPortfolio = 0;
    let duesNext30Days = 0;
    let dueAmountNext30Days = 0;
    let activePolicies = 0;
    let lapsedCount = 0;
    let maturedCount = 0;

    for (const p of policies) {
      if (p.status === 'IN_FORCE') {
        activePolicies++;
        totalSumAssured += Number(p.sumAssured) || 0;

        // Calculate annualised equivalent premium
        let mult = 1;
        if (p.frequency === 'HALF_YEARLY') mult = 2;
        else if (p.frequency === 'QUARTERLY') mult = 4;
        else if (p.frequency === 'MONTHLY_NACH') mult = 12;
        else if (p.frequency === 'SINGLE_PREMIUM') mult = 0;
        annualPremiumPortfolio += (Number(p.totalPremium) || 0) * mult;

        // Check if nextDueDate is within next 30 days
        if (p.nextDueDate) {
          const dueDate = new Date(p.nextDueDate);
          if (dueDate >= now && dueDate <= thirtyDaysLater) {
            duesNext30Days++;
            dueAmountNext30Days += Number(p.totalPremium) || 0;
          }
        }
      } else if (p.status === 'LAPSED') {
        lapsedCount++;
      } else if (p.status === 'MATURED') {
        maturedCount++;
      }
    }

    return {
      totalPolicies: policies.length,
      activePolicies,
      totalSumAssured,
      annualPremiumPortfolio,
      duesNext30Days,
      dueAmountNext30Days,
      lapsedCount,
      maturedCount,
      totalCustomers: customers.length
    };
  }

  // --- BACKUP & RESTORE ---
  async exportFullBackup(): Promise<string> {
    const customers = await this.getCustomers();
    const policies = await this.getPolicies();
    const auditLogs = await this.getAuditLogs();
    const settings = await this.getSettings();
    const documents = await this.getScannedDocuments();

    const backupPayload = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      appName: 'LIC Policy Manager',
      totalRecords: {
        customers: customers.length,
        policies: policies.length,
        auditLogs: auditLogs.length,
        documents: documents.length
      },
      data: {
        customers,
        policies,
        auditLogs,
        settings,
        documents
      }
    };

    return JSON.stringify(backupPayload, null, 2);
  }

  async restoreFullBackup(jsonString: string, user: string = 'Authorized Agent'): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.data || !Array.isArray(parsed.data.customers) || !Array.isArray(parsed.data.policies)) {
        throw new Error('Invalid backup file format.');
      }

      const db = await this.open();
      const tx = db.transaction(['customers', 'policies', 'audit_logs', 'settings', 'scanned_documents'], 'readwrite');
      
      const custStore = tx.objectStore('customers');
      const polStore = tx.objectStore('policies');
      const logStore = tx.objectStore('audit_logs');
      const setStore = tx.objectStore('settings');
      const docStore = tx.objectStore('scanned_documents');

      // Clear existing
      custStore.clear();
      polStore.clear();
      logStore.clear();
      setStore.clear();
      docStore.clear();

      // Put restored records
      parsed.data.customers.forEach((c: Customer) => custStore.put(c));
      parsed.data.policies.forEach((p: Policy) => polStore.put(p));
      if (parsed.data.auditLogs) {
        parsed.data.auditLogs.forEach((l: AuditLog) => logStore.put(l));
      }
      if (parsed.data.settings) {
        setStore.put({ key: 'app_settings', value: parsed.data.settings });
      }
      if (parsed.data.documents) {
        parsed.data.documents.forEach((d: ScannedDocument) => docStore.put(d));
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      await this.logAudit({
        action: 'RESTORE',
        entityType: 'BACKUP',
        entitySummary: `Restored full database backup (${parsed.data.customers.length} customers, ${parsed.data.policies.length} policies)`,
        userName: user,
        userRole: 'Admin'
      });

      return {
        success: true,
        message: `Successfully restored ${parsed.data.customers.length} customers and ${parsed.data.policies.length} policies.`
      };
    } catch (e: any) {
      console.error('Backup restoration failed:', e);
      return { success: false, message: e.message || 'Restoration failed' };
    }
  }

  async resetToSeedData(user: string = 'Authorized Agent'): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['customers', 'policies', 'audit_logs', 'settings', 'scanned_documents'], 'readwrite');
    
    tx.objectStore('customers').clear();
    tx.objectStore('policies').clear();
    tx.objectStore('audit_logs').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('scanned_documents').clear();

    const custStore = tx.objectStore('customers');
    const polStore = tx.objectStore('policies');
    const logStore = tx.objectStore('audit_logs');
    const setStore = tx.objectStore('settings');

    INITIAL_CUSTOMERS.forEach(c => custStore.put(c));
    INITIAL_POLICIES.forEach(p => polStore.put(p));
    INITIAL_AUDIT_LOGS.forEach(l => logStore.put(l));
    setStore.put({ key: 'app_settings', value: INITIAL_SETTINGS });
    setStore.put({ key: 'seed_version', value: CURRENT_SEED_VERSION });

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });

    await this.logAudit({
      action: 'UPDATE',
      entityType: 'SYSTEM',
      entitySummary: 'Re-synchronized authentic 78 policy records from Excel workbook (2013-2026)',
      userName: user,
      userRole: 'Admin'
    });
  }
}

export const localDB = new LocalDatabase();

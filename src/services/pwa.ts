// PWA and On-Device Storage Service
// Handles Service Worker registration, persistent mobile storage, and install prompts

export interface StorageStatus {
  isPersisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageMB: string;
  quotaMB: string;
}

class PWAService {
  private deferredPrompt: any = null;
  private isInstalled: boolean = false;
  private installListeners: Array<() => void> = [];
  private connectivityListeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed on mobile or desktop)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    this.isInstalled = isStandalone;

    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.notifyInstallListeners();
    });

    // Listen for appinstalled
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      this.notifyInstallListeners();
    });

    // Online / Offline listeners
    window.addEventListener('online', () => this.notifyConnectivity(true));
    window.addEventListener('offline', () => this.notifyConnectivity(false));

    // Register Service Worker
    this.registerServiceWorker();

    // Request persistent storage on mobile
    this.requestPersistentStorage();
  }

  private async registerServiceWorker() {
    // Purge any older Service Worker caches
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          if (key !== 'lic-policy-manager-v4') {
            await caches.delete(key);
          }
        }
      } catch (e) {
        console.warn('Cache purge notice:', e);
      }
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[LIC PWA] Service Worker registered with scope:', registration.scope);
        // Force checking for updated service worker
        await registration.update();
      } catch (err) {
        console.warn('[LIC PWA] Service Worker registration failed:', err);
      }
    }
  }

  public async requestPersistentStorage(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log('[LIC PWA] Persistent on-device mobile storage granted:', isPersisted);
        return isPersisted;
      } catch (e) {
        console.warn('[LIC PWA] Could not request storage persistence:', e);
      }
    }
    return false;
  }

  public async getStorageEstimate(): Promise<StorageStatus> {
    let isPersisted = false;
    let usageBytes = 0;
    let quotaBytes = 0;

    if (navigator.storage && navigator.storage.persisted) {
      try {
        isPersisted = await navigator.storage.persisted();
      } catch {
        // Ignore
      }
    }

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        usageBytes = estimate.usage || 0;
        quotaBytes = estimate.quota || 0;
      } catch {
        // Ignore
      }
    }

    return {
      isPersisted,
      usageBytes,
      quotaBytes,
      usageMB: (usageBytes / (1024 * 1024)).toFixed(2) + ' MB',
      quotaMB: (quotaBytes / (1024 * 1024)).toFixed(0) + ' MB'
    };
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public canInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled;
  }

  public getIsInstalled(): boolean {
    return this.isInstalled;
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }
    try {
      this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.notifyInstallListeners();
      return choice.outcome === 'accepted';
    } catch (err) {
      console.warn('Install prompt error:', err);
      return false;
    }
  }

  public onInstallChange(callback: () => void): () => void {
    this.installListeners.push(callback);
    return () => {
      this.installListeners = this.installListeners.filter(cb => cb !== callback);
    };
  }

  public onConnectivityChange(callback: (isOnline: boolean) => void): () => void {
    this.connectivityListeners.push(callback);
    return () => {
      this.connectivityListeners = this.connectivityListeners.filter(cb => cb !== callback);
    };
  }

  private notifyInstallListeners() {
    this.installListeners.forEach(cb => cb());
  }

  private notifyConnectivity(status: boolean) {
    this.connectivityListeners.forEach(cb => cb(status));
  }
}

export const pwaService = new PWAService();

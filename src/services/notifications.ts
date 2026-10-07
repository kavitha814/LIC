import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Policy } from '../types';
import { formatINR } from './export';

class NotificationService {
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        // Create high-priority notification channel for Android 8.0+
        await LocalNotifications.createChannel({
          id: 'lic_premium_dues',
          name: 'LIC Policy Premium Dues',
          description: 'Timely reminders for upcoming LIC policy premium dues and renewals',
          importance: 5, // High / Heads-up notification
          visibility: 1, // Public
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#f59e0b'
        });
      } catch (err) {
        console.warn('Failed to create notification channel:', err);
      }
    }
    this.isInitialized = true;
  }

  async checkPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await LocalNotifications.checkPermissions();
        return status.display === 'granted';
      } catch (err) {
        console.error('Error checking notification permission:', err);
        return false;
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  }

  async requestPermission(): Promise<boolean> {
    await this.init();

    if (Capacitor.isNativePlatform()) {
      try {
        const res = await LocalNotifications.requestPermissions();
        return res.display === 'granted';
      } catch (err) {
        console.error('Failed to request native notification permission:', err);
        return false;
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        return res === 'granted';
      } catch (err) {
        console.error('Web notification permission error:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Schedule push notifications for upcoming policy dues
   * @param policies List of all policies
   * @param leadDays Number of days before due date to alert (default: 7)
   */
  async scheduleDueNotifications(policies: Policy[], leadDays = 7): Promise<number> {
    await this.init();

    const hasPerm = await this.checkPermission();
    if (!hasPerm) {
      const granted = await this.requestPermission();
      if (!granted) {
        console.warn('Notification permission not granted. Skipping schedule.');
        return 0;
      }
    }

    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications are scheduled natively on Android devices.');
      return 0;
    }

    try {
      // Clear previous scheduled dues to prevent stale or duplicate notifications
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }

      const now = new Date();
      const inForcePolicies = policies.filter(p => p.status === 'IN_FORCE' && p.nextDueDate);

      // Sort by earliest nextDueDate
      inForcePolicies.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

      const toSchedule: any[] = [];
      let notifIdCounter = 1000;

      for (const policy of inForcePolicies) {
        const dueDate = new Date(policy.nextDueDate + 'T00:00:00');
        if (isNaN(dueDate.getTime())) continue;

        const customerName = policy.customerName || 'Client';
        const formattedAmount = formatINR(policy.totalPremium || policy.basicPremium || 0);
        const policyNum = policy.policyNumber;
        const plan = policy.planName || `Plan ${policy.planNumber}`;

        // 1. Advance reminder: X days before (at 09:00 AM)
        const advanceDate = new Date(dueDate);
        advanceDate.setDate(advanceDate.getDate() - leadDays);
        advanceDate.setHours(9, 0, 0, 0);

        if (advanceDate > now) {
          toSchedule.push({
            id: notifIdCounter++,
            title: `🔔 Upcoming LIC Due: ${customerName}`,
            body: `Policy #${policyNum} (${plan}) is due in ${leadDays} days on ${policy.nextDueDate}. Premium: ${formattedAmount}`,
            schedule: { at: advanceDate },
            channelId: 'lic_premium_dues',
            smallIcon: 'ic_launcher',
            extra: { policyId: policy.id, policyNumber: policy.policyNumber }
          });
        }

        // 2. 1-day before reminder (at 09:30 AM)
        const oneDayBefore = new Date(dueDate);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);
        oneDayBefore.setHours(9, 30, 0, 0);

        if (oneDayBefore > now && leadDays > 1) {
          toSchedule.push({
            id: notifIdCounter++,
            title: `⚠️ Due Tomorrow: ${customerName}`,
            body: `LIC Policy #${policyNum} premium of ${formattedAmount} is due tomorrow! Plan: ${plan}`,
            schedule: { at: oneDayBefore },
            channelId: 'lic_premium_dues',
            smallIcon: 'ic_launcher',
            extra: { policyId: policy.id, policyNumber: policy.policyNumber }
          });
        }

        // 3. Due TODAY reminder (at 08:30 AM)
        const todayDue = new Date(dueDate);
        todayDue.setHours(8, 30, 0, 0);

        if (todayDue > now) {
          toSchedule.push({
            id: notifIdCounter++,
            title: `🚨 LIC Premium Due TODAY!`,
            body: `${customerName}'s Policy #${policyNum} is due today! Amount: ${formattedAmount}. Action required.`,
            schedule: { at: todayDue },
            channelId: 'lic_premium_dues',
            smallIcon: 'ic_launcher',
            extra: { policyId: policy.id, policyNumber: policy.policyNumber }
          });
        }

        // Keep maximum 40 pending notifications to respect Android alarm limits
        if (toSchedule.length >= 40) break;
      }

      if (toSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: toSchedule });
        console.log(`Successfully scheduled ${toSchedule.length} LIC policy due push notifications.`);
      }

      return toSchedule.length;
    } catch (err) {
      console.error('Error scheduling policy due notifications:', err);
      return 0;
    }
  }

  /**
   * Send an immediate test notification to verify the phone's notification system
   */
  async sendImmediateTestNotification(): Promise<boolean> {
    await this.init();
    const hasPerm = await this.checkPermission();
    if (!hasPerm) {
      const granted = await this.requestPermission();
      if (!granted) return false;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 99999,
              title: '🛡️ LIC Advisory Push Notification Active',
              body: 'Policy due date alerts are configured and active! You will be notified automatically before renewals.',
              schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
              channelId: 'lic_premium_dues',
              smallIcon: 'ic_launcher'
            }
          ]
        });
        return true;
      } catch (err) {
        console.error('Failed to trigger test native notification:', err);
        return false;
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      new Notification('🛡️ LIC Advisory Push Notification Active', {
        body: 'Policy due date alerts are configured and active! You will be notified automatically before renewals.'
      });
      return true;
    }

    return false;
  }

  async getPendingCount(): Promise<number> {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        return pending.notifications.length;
      } catch {
        return 0;
      }
    }
    return 0;
  }
}

export const notificationService = new NotificationService();

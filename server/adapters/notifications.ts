import { notifyOwner, type NotificationPayload } from "../_core/notification";

export type NotificationDelivery = { accepted: boolean; channel: "manus" | "unsupported" };

export interface NotificationAdapter {
  notifyOwner(payload: NotificationPayload): Promise<NotificationDelivery>;
  notifyUser(_payload: NotificationPayload): Promise<NotificationDelivery>;
  sendWebPush(_payload: NotificationPayload): Promise<NotificationDelivery>;
  sendEmail(_payload: NotificationPayload): Promise<NotificationDelivery>;
  sendDesktopNotification(_payload: NotificationPayload): Promise<NotificationDelivery>;
}

class ManusNotificationAdapter implements NotificationAdapter {
  async notifyOwner(payload: NotificationPayload): Promise<NotificationDelivery> {
    return { accepted: await notifyOwner(payload), channel: "manus" };
  }

  async notifyUser(): Promise<NotificationDelivery> { return { accepted: false, channel: "unsupported" }; }
  async sendWebPush(): Promise<NotificationDelivery> { return { accepted: false, channel: "unsupported" }; }
  async sendEmail(): Promise<NotificationDelivery> { return { accepted: false, channel: "unsupported" }; }
  async sendDesktopNotification(): Promise<NotificationDelivery> { return { accepted: false, channel: "unsupported" }; }
}

const activeNotificationAdapter: NotificationAdapter = new ManusNotificationAdapter();

export function getNotificationAdapter(): NotificationAdapter {
  return activeNotificationAdapter;
}

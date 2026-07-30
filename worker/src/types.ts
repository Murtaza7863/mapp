export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface ScheduledNotification {
  id: string;
  fireAt: string;
  title: string;
  body: string;
  /** App-relative path, resolved against the PWA scope by the service worker. */
  url?: string;
}

export interface SchedulePayload {
  deviceId: string;
  digestEnabled: boolean;
  /** Local wall-clock "HH:mm". */
  digestTime: string;
  /** IANA zone the digestTime is expressed in. */
  timeZone?: string;
  notifications: ScheduledNotification[];
}

export interface StoredDevice {
  subscription: PushSubscriptionJSON;
  schedule: SchedulePayload;
}

export interface PushMessagePayload {
  title: string;
  body: string;
  url: string;
  /** Keeps the shape assignable to the push builder's JSON payload type. */
  [key: string]: string;
}

/** Marks which notifications have already gone out, so a retry cannot double-send. */
export type SentLog = Record<string, string>;

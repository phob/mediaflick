export type AppNotificationTone = "info" | "success" | "error";

export interface AppNotification {
  title: string;
  message?: string;
  tone?: AppNotificationTone;
}

const notificationEventName = "mediaflick:notify";

export function pushAppNotification(notification: AppNotification): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<AppNotification>(notificationEventName, { detail: notification }));
}

export function onAppNotification(listener: (notification: AppNotification) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AppNotification>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(notificationEventName, handler as EventListener);
  return () => window.removeEventListener(notificationEventName, handler as EventListener);
}

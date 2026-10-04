import { Notification } from "electron";
export function notifyDone(title: string, body: string) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

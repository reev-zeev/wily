/**
 * الغرض: إشعارات النظام
 * الحالة: تنفيد فعلي (جزئي)
 * ينتمي إلى: infrastructure/notification
 */

export {
  getDriverBot,
  getRiderBot,
  sendMessage,
  sendMessageToDriver,
  sendMessageToRider,
  sendToGroup,
} from './telegram-adapter';
export type {
  TelegramBot,
  SendMessageInput,
  SendToGroupInput,
} from './telegram-adapter';

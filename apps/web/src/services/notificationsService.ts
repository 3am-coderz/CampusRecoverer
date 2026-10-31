import { apiClient } from '../kernel/client';
import { Notification } from '../kernel/types';

export const notificationsService = {
  async getNotifications(): Promise<Notification[]> {
    const res = await apiClient.get<{ notifications: Notification[] }>('/notifications');
    return res.notifications || [];
  },

  async markAsRead(id: string): Promise<Notification> {
    const res = await apiClient.patch<{ notification: Notification }>(`/notifications/${id}/read`);
    return res.notification;
  },
};

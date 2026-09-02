import prisma from '../../config/database';

type NotificationType = 'backlog' | 'expired' | 'revision' | 'system';

export const notificationService = {
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: (params.metadata as any) || undefined,
      },
    });
  },

  async getUnread(userId: string) {
    return prisma.notification.findMany({
      where: {
        userId,
        readAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });
  },

  async getAll(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async markRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        readAt: new Date(),
      },
    });
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  },
};

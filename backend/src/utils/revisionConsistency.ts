import prisma from '../config/database';

export const revisionConsistency = {
  /**
   * Revision tasks that exist in tasks table
   * but have no matching row in revisions table.
   */
  async findOrphanRevisionTasks(userId: string) {
    return prisma.$queryRaw<
      {
        id: string;
        title: string;
        parent_task_id: string | null;
        revision_number: number;
      }[]
    >`
      SELECT
        t.id,
        t.title,
        t.parent_task_id,
        t.revision_number
      FROM tasks t
      LEFT JOIN revisions r ON r.revision_task_id = t.id
      WHERE t.user_id = ${userId}
        AND t.task_type = 'revision'
        AND r.id IS NULL
      ORDER BY t.created_at DESC
    `;
  },

  /**
   * Revision rows whose revision task no longer exists.
   */
  async findOrphanRevisionRecords(userId: string) {
    return prisma.$queryRaw<
      {
        id: string;
        parent_task_id: string;
        revision_task_id: string;
        revision_number: number;
      }[]
    >`
      SELECT
        r.id,
        r.parent_task_id,
        r.revision_task_id,
        r.revision_number
      FROM revisions r
      JOIN tasks parent ON parent.id = r.parent_task_id
      LEFT JOIN tasks revision_task ON revision_task.id = r.revision_task_id
      WHERE parent.user_id = ${userId}
        AND revision_task.id IS NULL
      ORDER BY r.created_at DESC
    `;
  },

  /**
   * Revision rows where the revision task points to a different parent.
   */
  async findParentMismatch(userId: string) {
    return prisma.$queryRaw<
      {
        revision_id: string;
        parent_task_id: string;
        revision_task_id: string;
        task_parent_task_id: string | null;
      }[]
    >`
      SELECT
        r.id AS revision_id,
        r.parent_task_id,
        r.revision_task_id,
        t.parent_task_id AS task_parent_task_id
      FROM revisions r
      JOIN tasks parent ON parent.id = r.parent_task_id
      JOIN tasks t ON t.id = r.revision_task_id
      WHERE parent.user_id = ${userId}
        AND t.parent_task_id IS DISTINCT FROM r.parent_task_id
    `;
  },

  /**
   * Duplicate unfinished revisions for same parent and same scheduled date.
   */
  async findDuplicateUnfinishedRevisions(userId: string) {
    return prisma.$queryRaw<
      {
        parent_task_id: string;
        scheduled_date: Date;
        count: bigint;
      }[]
    >`
      SELECT
        r.parent_task_id,
        r.scheduled_date::date AS scheduled_date,
        COUNT(*) AS count
      FROM revisions r
      JOIN tasks parent ON parent.id = r.parent_task_id
      WHERE parent.user_id = ${userId}
        AND r.status <> 'completed'
      GROUP BY r.parent_task_id, r.scheduled_date::date
      HAVING COUNT(*) > 1
    `;
  },

  async getReport(userId: string) {
    const [
      orphanRevisionTasks,
      orphanRevisionRecords,
      parentMismatches,
      duplicateUnfinishedRevisions,
    ] = await Promise.all([
      this.findOrphanRevisionTasks(userId),
      this.findOrphanRevisionRecords(userId),
      this.findParentMismatch(userId),
      this.findDuplicateUnfinishedRevisions(userId),
    ]);

    const ok =
      orphanRevisionTasks.length === 0 &&
      orphanRevisionRecords.length === 0 &&
      parentMismatches.length === 0 &&
      duplicateUnfinishedRevisions.length === 0;

    return {
      ok,
      counts: {
        orphanRevisionTasks: orphanRevisionTasks.length,
        orphanRevisionRecords: orphanRevisionRecords.length,
        parentMismatches: parentMismatches.length,
        duplicateUnfinishedRevisions: duplicateUnfinishedRevisions.length,
      },
      details: {
        orphanRevisionTasks,
        orphanRevisionRecords,
        parentMismatches,
        duplicateUnfinishedRevisions,
      },
    };
  },
};

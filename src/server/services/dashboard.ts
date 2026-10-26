import { db } from '@/lib/db';
import type { Actor } from '@/lib/auth/session';
import { today, weekDay } from '@/lib/time';
import { classIds } from './access';
import { listSchedules } from './management';
import { listResults, listAssignments, listAnnouncements } from './academic';
export async function dashboard(actor: Actor) {
  const settings = await db.institutionSettings.findUnique({ where: { id: 'main' } });
  const date = today(settings?.timezone),
    day = weekDay(date);
  const [schedules, announcements, assignments] = await Promise.all([
    listSchedules(actor),
    listAnnouncements(actor),
    listAssignments(actor, actor.role === 'STUDENT'),
  ]);
  const lessons = schedules.filter((s) => s.day === day);
  if (actor.role === 'ADMIN') {
    const [students, teachers, classes, exams, audit] = await Promise.all([
      db.user.count({ where: { role: 'STUDENT', active: true } }),
      db.user.count({ where: { role: 'TEACHER', active: true } }),
      db.class.count({ where: { active: true } }),
      db.exam.count({ where: { date: { gte: new Date(date) }, status: 'PUBLISHED' } }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    return {
      date,
      lessons,
      announcements: announcements.slice(0, 4),
      assignments: assignments.slice(0, 4),
      stats: { students, teachers, classes, exams },
      audit,
    };
  }
  const ids = await classIds(actor);
  if (actor.role === 'TEACHER') {
    const done = await db.lessonSession.findMany({
      where: {
        scheduleId: { in: lessons.map((v) => v.id) },
        date: new Date(date),
        attendance: { some: {} },
      },
      select: { scheduleId: true },
    });
    return {
      date,
      lessons,
      announcements: announcements.slice(0, 4),
      assignments: assignments.slice(0, 4),
      stats: {
        classes: new Set(ids).size,
        lessons: lessons.length,
        pending: lessons.filter((l) => !done.some((s) => s.scheduleId === l.id)).length,
      },
    };
  }
  const results = await listResults(actor, new URLSearchParams());
  const pendingCount = await db.assignment.count({
    where: {
      classId: { in: ids },
      statuses: { none: { studentId: actor.student!.id, completedAt: { not: null } } },
    },
  });
  const pending = assignments.filter((a) => !a.statuses[0]?.completedAt);
  const attendance = await db.attendance.groupBy({
    by: ['status'],
    where: { studentId: actor.student!.id },
    _count: true,
  });
  return {
    date,
    unassigned: ids.length === 0,
    lessons,
    announcements: announcements.slice(0, 4),
    assignments: pending.slice(0, 4),
    results,
    stats: {
      pending: pendingCount,
      absent: attendance.find((a) => a.status === 'ABSENT')?._count || 0,
      lessons: lessons.length,
    },
    latest: results.at(-1) ?? null,
  };
}

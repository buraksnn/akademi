import { db } from '@/lib/db';
import type { Actor } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
export function admin(actor: Actor) {
  if (actor.role !== 'ADMIN') throw new AppError(403, 'Bu işlem için yönetici yetkisi gerekiyor.');
}
export async function classIds(actor: Actor) {
  if (actor.role === 'ADMIN')
    return (await db.class.findMany({ where: { active: true }, select: { id: true } })).map(
      (v) => v.id,
    );
  if (actor.role === 'TEACHER' && !actor.teacher) return [];
  if (actor.role === 'STUDENT' && !actor.student) return [];
  if (actor.role === 'TEACHER')
    return (
      await db.teacherClassAssignment.findMany({
        where: { teacherId: actor.teacher?.id },
        select: { classId: true },
      })
    ).map((v) => v.classId);
  return (
    await db.classEnrollment.findMany({
      where: { studentId: actor.student?.id, active: true },
      select: { classId: true },
    })
  ).map((v) => v.classId);
}
export async function canTeach(actor: Actor, classId: string, subjectId: string) {
  if (actor.role === 'ADMIN') return;
  if (
    actor.role !== 'TEACHER' ||
    !actor.teacher ||
    !(await db.teacherClassAssignment.findUnique({
      where: { teacherId_classId_subjectId: { teacherId: actor.teacher.id, classId, subjectId } },
    }))
  )
    throw new AppError(403, 'Bu sınıf ve ders için yetkiniz bulunmuyor.');
}
export async function canReadUser(actor: Actor, userId: string) {
  if (actor.id === userId || actor.role === 'ADMIN') return;
  if (actor.role === 'TEACHER') {
    const ids = await classIds(actor);
    const student = await db.studentProfile.findFirst({
      where: {
        userId,
        user: { role: 'STUDENT' },
        enrollments: { some: { active: true, classId: { in: ids } } },
      },
      select: { id: true },
    });
    if (student) return;
  }
  throw new AppError(403, 'Bu kullanıcıya erişim yetkiniz bulunmuyor.');
}
export const userSummary = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  photo: { select: { updatedAt: true } },
  student: {
    select: {
      id: true,
      number: true,
      enrollments: {
        where: { active: true },
        select: { class: { select: { id: true, name: true } } },
      },
    },
  },
  teacher: {
    select: {
      id: true,
      assignments: {
        select: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

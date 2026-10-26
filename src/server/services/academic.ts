import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { Actor } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { admin, classIds, canTeach } from './access';
import { assignmentSchema, announcementSchema, resultSchema, calculateNet } from '@/lib/validation';
import { today, weekDay } from '@/lib/time';
export async function listExams(actor: Actor) {
  const ids = await classIds(actor);
  return db.exam.findMany({
    where:
      actor.role === 'ADMIN'
        ? {}
        : { status: 'PUBLISHED', classes: { some: { classId: { in: ids } } } },
    include: {
      template: { include: { subjects: { include: { subject: true } } } },
      classes: { include: { class: true } },
      _count: { select: { results: true } },
    },
    orderBy: { date: 'desc' },
    take: 100,
  });
}
export async function saveExam(actor: Actor, input: unknown, id?: string) {
  admin(actor);
  const data = z
    .object({
      name: z.string().trim().min(2).max(150),
      templateId: z.string(),
      date: z.iso.date(),
      description: z.string().max(2000).default(''),
      status: z.enum(['DRAFT', 'PUBLISHED']),
      classIds: z.array(z.string()).min(1).max(100),
    })
    .parse(input);
  return db.$transaction(async (tx) => {
    if (id && (await tx.examResult.count({ where: { examId: id } }))) {
      const old = await tx.exam.findUniqueOrThrow({ where: { id } });
      if (old.templateId !== data.templateId)
        throw new AppError(409, 'Sonucu olan sınavın şablonu değiştirilemez.');
      const oldClasses = await tx.examClassAssignment.findMany({ where: { examId: id } });
      if (oldClasses.some((v) => !data.classIds.includes(v.classId)))
        throw new AppError(409, 'Sonucu olan sınavdan sınıf çıkarılamaz.');
    }
    const values = {
      name: data.name,
      templateId: data.templateId,
      date: new Date(data.date),
      description: data.description,
      status: data.status,
    };
    const row = id
      ? await tx.exam.update({ where: { id }, data: values })
      : await tx.exam.create({ data: values });
    await tx.examClassAssignment.deleteMany({ where: { examId: row.id } });
    await tx.examClassAssignment.createMany({
      data: [...new Set(data.classIds)].map((classId) => ({ examId: row.id, classId })),
    });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'EXAM_SAVED', entityId: row.id },
    });
    return row;
  });
}
export async function createTemplate(actor: Actor, input: unknown) {
  admin(actor);
  const d = z
    .object({
      name: z.string().trim().min(2).max(120),
      type: z.enum(['TYT', 'AYT']),
      subjects: z
        .array(z.object({ subjectId: z.string(), questionCount: z.number().int().min(1).max(200) }))
        .min(1)
        .max(30),
    })
    .parse(input);
  if (new Set(d.subjects.map((v) => v.subjectId)).size !== d.subjects.length)
    throw new AppError(400, 'Aynı ders iki kez seçilemez.');
  return db.examTemplate.create({
    data: { name: d.name, type: d.type, subjects: { create: d.subjects } },
  });
}
export async function saveResult(actor: Actor, input: unknown) {
  admin(actor);
  const d = resultSchema.parse(input);
  return db.$transaction(async (tx) => {
    const exam = await tx.exam.findUniqueOrThrow({
      where: { id: d.examId },
      include: { template: { include: { subjects: true } }, classes: true },
    });
    const enrolled = await tx.classEnrollment.findFirst({
      where: {
        studentId: d.studentId,
        active: true,
        classId: { in: exam.classes.map((v) => v.classId) },
        student: { user: { active: true, role: 'STUDENT' } },
      },
    });
    if (!enrolled) throw new AppError(400, 'Öğrenci bu sınavın sınıflarına kayıtlı değil.');
    const template = exam.template.subjects;
    if (
      d.subjects.length !== template.length ||
      new Set(d.subjects.map((v) => v.templateSubjectId)).size !== template.length
    )
      throw new AppError(400, 'Şablondaki her ders için bir sonuç girin.');
    const subjects = d.subjects.map((v) => {
      const ts = template.find((t) => t.id === v.templateSubjectId);
      if (!ts) throw new AppError(400, 'Sınav şablonuna ait olmayan ders.');
      let net;
      try {
        net = calculateNet(v.correct, v.wrong, v.blank, ts.questionCount);
      } catch {
        throw new AppError(400, 'Doğru, yanlış ve boş toplamı soru sayısını aşamaz.');
      }
      return { ...v, net };
    });
    const totalNet = subjects.reduce((a, v) => a + v.net, 0);
    const result = await tx.examResult.upsert({
      where: { examId_studentId: { examId: d.examId, studentId: d.studentId } },
      create: { examId: d.examId, studentId: d.studentId, totalNet },
      update: { totalNet },
    });
    await tx.examSubjectResult.deleteMany({ where: { resultId: result.id } });
    await tx.examSubjectResult.createMany({
      data: subjects.map((v) => ({ ...v, resultId: result.id })),
    });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'EXAM_RESULT_SAVED', entityId: result.id },
    });
    return result;
  });
}
export async function listResults(actor: Actor, p: URLSearchParams) {
  const ids = await classIds(actor);
  const studentId = actor.role === 'STUDENT' ? actor.student!.id : p.get('studentId') || undefined;
  const assignments =
    actor.role === 'TEACHER'
      ? await db.teacherClassAssignment.findMany({ where: { teacherId: actor.teacher!.id } })
      : [];
  const where: Prisma.ExamResultWhereInput = {
    studentId,
    ...(actor.role === 'ADMIN' ? {} : { exam: { status: 'PUBLISHED' } }),
    ...(actor.role === 'TEACHER'
      ? { student: { enrollments: { some: { active: true, classId: { in: ids } } } } }
      : {}),
  };
  const rows = await db.examResult.findMany({
    where,
    include: {
      exam: { include: { template: true } },
      student: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
          enrollments: { where: { active: true }, select: { classId: true } },
        },
      },
      subjects: { include: { templateSubject: { include: { subject: true } } } },
    },
    orderBy: { exam: { date: 'asc' } },
    take: 200,
  });
  return rows
    .map((r) => {
      const subjects = r.subjects.filter(
        (s) =>
          actor.role !== 'TEACHER' ||
          assignments.some(
            (a) =>
              a.subjectId === s.templateSubject.subjectId &&
              r.student.enrollments.some((e) => e.classId === a.classId),
          ),
      );
      return {
        ...r,
        totalNet: subjects.reduce((n, s) => n + Number(s.net), 0),
        subjects: subjects.map((s) => ({ ...s, net: Number(s.net) })),
        partial: actor.role === 'TEACHER',
      };
    })
    .filter((r) => r.subjects.length > 0);
}
export async function listAssignments(actor: Actor, onlyPending = false) {
  const ids = await classIds(actor);
  return db.assignment.findMany({
    where:
      actor.role === 'ADMIN'
        ? {}
        : actor.role === 'TEACHER'
          ? { creatorId: actor.id, classId: { in: ids } }
          : {
              classId: { in: ids },
              ...(onlyPending
                ? {
                    statuses: {
                      none: { studentId: actor.student!.id, completedAt: { not: null } },
                    },
                  }
                : {}),
            },
    include: {
      subject: true,
      class: true,
      creator: { select: { firstName: true, lastName: true } },
      statuses: {
        where: actor.role === 'STUDENT' ? { studentId: actor.student!.id } : undefined,
        select: {
          studentId: true,
          completedAt: true,
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
      _count: { select: { statuses: true } },
    },
    orderBy: { dueAt: 'asc' },
    take: 200,
  });
}
export async function saveAssignment(actor: Actor, input: unknown, id?: string) {
  if (actor.role === 'STUDENT') throw new AppError(403, 'Ödev oluşturamazsınız.');
  const data = assignmentSchema.parse(input);
  await canTeach(actor, data.classId, data.subjectId);
  if (id) {
    const row = await db.assignment.findUniqueOrThrow({ where: { id } });
    await canTeach(actor, row.classId, row.subjectId);
    if (actor.role !== 'ADMIN' && row.creatorId !== actor.id)
      throw new AppError(403, 'Yalnızca kendi ödevlerinizi düzenleyebilirsiniz.');
    if (row.classId !== data.classId) throw new AppError(400, 'Ödevin sınıfı değiştirilemez.');
  }
  const row = id
    ? await db.assignment.update({ where: { id }, data: { ...data, dueAt: new Date(data.dueAt) } })
    : await db.assignment.create({
        data: { ...data, dueAt: new Date(data.dueAt), creatorId: actor.id },
      });
  await db.auditLog.create({
    data: { actorId: actor.id, action: 'ASSIGNMENT_SAVED', entityId: row.id },
  });
  return row;
}
export async function deleteAssignment(actor: Actor, id: string) {
  const row = await db.assignment.findUniqueOrThrow({ where: { id } });
  await canTeach(actor, row.classId, row.subjectId);
  if (actor.role !== 'ADMIN' && row.creatorId !== actor.id)
    throw new AppError(403, 'Yalnızca kendi ödevlerinizi silebilirsiniz.');
  await db.$transaction([
    db.assignment.delete({ where: { id } }),
    db.auditLog.create({ data: { actorId: actor.id, action: 'ASSIGNMENT_DELETED', entityId: id } }),
  ]);
}
export async function completeAssignment(actor: Actor, id: string, input: unknown) {
  if (actor.role !== 'STUDENT') throw new AppError(403, 'Bu işlem öğrencilere aittir.');
  const { completed } = z.object({ completed: z.boolean() }).parse(input);
  const ids = await classIds(actor);
  const row = await db.assignment.findFirst({ where: { id, classId: { in: ids } } });
  if (!row) throw new AppError(404, 'Ödev bulunamadı.');
  return db.assignmentStudentStatus.upsert({
    where: { assignmentId_studentId: { assignmentId: id, studentId: actor.student!.id } },
    create: {
      assignmentId: id,
      studentId: actor.student!.id,
      completedAt: completed ? new Date() : null,
    },
    update: { completedAt: completed ? new Date() : null },
  });
}
export async function listAnnouncements(actor: Actor) {
  const ids = await classIds(actor);
  return db.announcement.findMany({
    where:
      actor.role === 'ADMIN'
        ? {}
        : {
            publishedAt: { lte: new Date() },
            OR: [
              { audience: 'ALL' },
              { audience: actor.role === 'STUDENT' ? 'STUDENTS' : 'TEACHERS' },
              { audience: 'CLASSES', targets: { some: { classId: { in: ids } } } },
            ],
          },
    include: { targets: { include: { class: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });
}
export async function saveAnnouncement(actor: Actor, input: unknown, id?: string) {
  admin(actor);
  const { classIds: targets, ...data } = announcementSchema.parse(input);
  return db.$transaction(async (tx) => {
    const row = id
      ? await tx.announcement.update({ where: { id }, data })
      : await tx.announcement.create({ data: { ...data, creatorId: actor.id } });
    await tx.announcementTarget.deleteMany({ where: { announcementId: row.id } });
    if (data.audience === 'CLASSES')
      await tx.announcementTarget.createMany({
        data: [...new Set(targets)].map((classId) => ({ classId, announcementId: row.id })),
      });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'ANNOUNCEMENT_SAVED', entityId: row.id },
    });
    return row;
  });
}
export async function deleteAnnouncement(actor: Actor, id: string) {
  admin(actor);
  await db.$transaction([
    db.announcement.delete({ where: { id } }),
    db.auditLog.create({
      data: { actorId: actor.id, action: 'ANNOUNCEMENT_DELETED', entityId: id },
    }),
  ]);
}
export async function getAttendance(actor: Actor, p: URLSearchParams) {
  if (actor.role === 'STUDENT')
    return db.attendance.findMany({
      where: { studentId: actor.student!.id },
      include: { session: { include: { schedule: { include: { subject: true, class: true } } } } },
      orderBy: { session: { date: 'desc' } },
      take: 200,
    });
  const scheduleId = p.get('scheduleId'),
    date = p.get('date');
  if (!scheduleId || !date) return { students: [], records: [] };
  z.iso.date().parse(date);
  const schedule = await db.lessonSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
  if (actor.role !== 'ADMIN' && schedule.teacherId !== actor.teacher?.id)
    throw new AppError(403, 'Bu oturum için yetkiniz bulunmuyor.');
  const session = await db.lessonSession.findUnique({
    where: { scheduleId_date: { scheduleId, date: new Date(date) } },
    include: { attendance: true },
  });
  const students = await db.studentProfile.findMany({
    where: {
      OR: [
        {
          user: { active: true, role: 'STUDENT' },
          enrollments: { some: { classId: schedule.classId, active: true } },
        },
        ...(actor.role === 'ADMIN'
          ? [{ id: { in: session?.attendance.map((r) => r.studentId) ?? [] } }]
          : []),
      ],
    },
    select: {
      id: true,
      number: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photo: { select: { updatedAt: true } },
        },
      },
    },
    orderBy: { number: 'asc' },
  });
  return { students, records: session?.attendance ?? [] };
}
export async function saveAttendance(actor: Actor, input: unknown) {
  if (actor.role === 'STUDENT') throw new AppError(403, 'Yoklama düzenleyemezsiniz.');
  const d = z
    .object({
      scheduleId: z.string(),
      date: z.iso.date(),
      records: z
        .array(
          z.object({
            studentId: z.string(),
            status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
          }),
        )
        .min(1)
        .max(1000),
    })
    .parse(input);
  const schedule = await db.lessonSchedule.findUniqueOrThrow({ where: { id: d.scheduleId } });
  if (actor.role !== 'ADMIN' && schedule.teacherId !== actor.teacher?.id)
    throw new AppError(403, 'Bu ders için yetkiniz bulunmuyor.');
  const settings = await db.institutionSettings.findUnique({ where: { id: 'main' } });
  if (weekDay(d.date) !== schedule.day || d.date > today(settings?.timezone))
    throw new AppError(
      400,
      'Ders gününü ve tarihi kontrol edin; gelecek tarih için yoklama alınamaz.',
    );
  if (!schedule.active && actor.role !== 'ADMIN')
    throw new AppError(400, 'Bu ders artık aktif değil.');
  const enrolled = await db.classEnrollment.findMany({
    where: {
      classId: schedule.classId,
      active: true,
      student: { user: { active: true, role: 'STUDENT' } },
    },
    select: { studentId: true },
  });
  const historical =
    actor.role === 'ADMIN'
      ? await db.attendance.findMany({
          where: { session: { scheduleId: d.scheduleId, date: new Date(d.date) } },
          select: { studentId: true },
        })
      : [];
  if (
    new Set(d.records.map((r) => r.studentId)).size !== d.records.length ||
    d.records.some(
      (r) =>
        !enrolled.some((e) => e.studentId === r.studentId) &&
        !historical.some((e) => e.studentId === r.studentId),
    )
  )
    throw new AppError(400, 'Sınıfa ait olmayan veya yinelenen öğrenci.');
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.scheduleId + d.date}))`;
    const session = await tx.lessonSession.upsert({
      where: { scheduleId_date: { scheduleId: d.scheduleId, date: new Date(d.date) } },
      create: { scheduleId: d.scheduleId, date: new Date(d.date) },
      update: {},
    });
    for (const r of d.records) {
      const old = await tx.attendance.findUnique({
        where: { studentId_sessionId: { studentId: r.studentId, sessionId: session.id } },
      });
      if (old && actor.role !== 'ADMIN' && old.status !== r.status)
        throw new AppError(403, 'Kaydedilmiş yoklamayı yalnızca yönetici düzeltebilir.');
      await tx.attendance.upsert({
        where: { studentId_sessionId: { studentId: r.studentId, sessionId: session.id } },
        create: { ...r, sessionId: session.id, takenById: actor.id },
        update: actor.role === 'ADMIN' ? { status: r.status, takenById: actor.id } : {},
      });
    }
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'ATTENDANCE_SAVED', entityId: session.id },
    });
  });
}
export async function assignmentStudents(actor: Actor, id: string) {
  if (actor.role === 'STUDENT') throw new AppError(403, 'Ödev sınıf listesine erişemezsiniz.');
  const row = await db.assignment.findUniqueOrThrow({ where: { id } });
  await canTeach(actor, row.classId, row.subjectId);
  if (actor.role !== 'ADMIN' && row.creatorId !== actor.id)
    throw new AppError(403, 'Yalnızca kendi ödevlerinizin durumunu inceleyebilirsiniz.');
  return db.studentProfile.findMany({
    where: {
      user: { active: true, role: 'STUDENT' },
      enrollments: { some: { classId: row.classId, active: true } },
    },
    select: {
      id: true,
      number: true,
      user: { select: { firstName: true, lastName: true } },
      assignmentStatuses: { where: { assignmentId: id }, select: { completedAt: true } },
    },
    orderBy: { number: 'asc' },
  });
}

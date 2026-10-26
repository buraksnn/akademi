import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import type { Actor } from '@/lib/auth/session';
import {
  classSchema,
  scheduleSchema,
  settingsSchema,
  emailSchema,
  passwordSchema,
  validTckn,
} from '@/lib/validation';
import { admin, classIds, canReadUser, userSummary } from './access';
import { AppError } from '@/lib/errors';
import { hashPassword } from '@/lib/security/password';
import { blindIndex, encryptIdentity, randomToken, hashToken } from '@/lib/security/crypto';
import { sendLink } from '@/lib/email';
export async function listUsers(actor: Actor, p: URLSearchParams) {
  if (actor.role === 'STUDENT') throw new AppError(403, 'Bu listeye erişim yetkiniz bulunmuyor.');
  const page = Math.max(1, Math.min(10000, Number(p.get('page')) || 1)),
    role = p.get('role') === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  if (actor.role === 'TEACHER' && role !== 'STUDENT')
    throw new AppError(403, 'Bu listeye erişim yetkiniz bulunmuyor.');
  const ids = await classIds(actor);
  const q = (p.get('q') || '').slice(0, 100),
    classId = p.get('classId'),
    status = p.get('status');
  const where: Prisma.UserWhereInput = {
    role,
    OR: q
      ? [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          ...(Number.isInteger(Number(q)) ? [{ student: { number: Number(q) } }] : []),
        ]
      : undefined,
    active: status === 'active' ? true : status === 'inactive' ? false : undefined,
    ...(actor.role === 'TEACHER' || classId
      ? {
          student: {
            enrollments: {
              some: {
                active: true,
                classId: classId ? (ids.includes(classId) ? classId : 'DENIED') : { in: ids },
              },
            },
          },
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.user.findMany({
      where,
      select: userSummary,
      skip: (page - 1) * 20,
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page, pageSize: 20 };
}
export async function userDetail(actor: Actor, id: string) {
  await canReadUser(actor, id);
  const user = await db.user.findUnique({
    where: { id },
    select: {
      ...userSummary,
      emailVerified: true,
      ...(actor.id === id || actor.role === 'ADMIN' ? { tcLastTwo: true } : {}),
    },
  });
  if (!user) throw new AppError(404, 'Kullanıcı bulunamadı.');
  return user;
}
export async function updateUser(actor: Actor, id: string, input: unknown) {
  admin(actor);
  const data = z
    .object({
      firstName: z.string().trim().min(2).max(80),
      lastName: z.string().trim().min(2).max(80),
      active: z.boolean(),
      role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
    })
    .parse(input);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(92741)`;
    const old = await tx.user.findUniqueOrThrow({ where: { id } });
    if (
      old.role === 'ADMIN' &&
      (!data.active || data.role !== 'ADMIN') &&
      (await tx.user.count({ where: { role: 'ADMIN', active: true } })) <= 1
    )
      throw new AppError(409, 'Son aktif yönetici pasifleştirilemez veya rolü değiştirilemez.');
    if (id === actor.id && (!data.active || data.role !== 'ADMIN'))
      throw new AppError(409, 'Kendi yönetici erişiminizi kaldıramazsınız.');
    await tx.user.update({ where: { id }, data });
    if (data.role === 'TEACHER')
      await tx.teacherProfile.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
    if (data.role === 'STUDENT')
      await tx.studentProfile.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
    if (data.role !== 'TEACHER' && old.role === 'TEACHER') {
      const t = await tx.teacherProfile.findUnique({ where: { userId: id } });
      if (t)
        await tx.lessonSchedule.updateMany({ where: { teacherId: t.id }, data: { active: false } });
    }
    if (data.role !== 'STUDENT' || !data.active) {
      const s = await tx.studentProfile.findUnique({ where: { userId: id } });
      if (s)
        await tx.classEnrollment.updateMany({
          where: { studentId: s.id, active: true },
          data: { active: false, endedAt: new Date() },
        });
    }
    if (!data.active || old.role !== data.role)
      await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: 'USER_UPDATED', entityId: id } });
  });
}
export async function createTeacher(actor: Actor, input: unknown) {
  admin(actor);
  const d = z
    .object({
      firstName: z.string().trim().min(2).max(80),
      lastName: z.string().trim().min(2).max(80),
      email: emailSchema,
      password: passwordSchema,
      tckn: z.string().refine(validTckn),
    })
    .parse(input);
  const token = randomToken();
  const user = await db.user.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      passwordHash: await hashPassword(d.password),
      role: 'TEACHER',
      tcEncrypted: encryptIdentity(d.tckn),
      tcIndex: blindIndex(d.tckn),
      tcLastTwo: d.tckn.slice(-2),
      teacher: { create: {} },
      verificationTokens: {
        create: {
          tokenHash: hashToken(token),
          targetEmail: d.email,
          expiresAt: new Date(Date.now() + 86400000),
        },
      },
    },
  });
  await db.auditLog.create({
    data: { actorId: actor.id, action: 'TEACHER_CREATED', entityId: user.id },
  });
  await sendLink(d.email, token, 'verify');
}
export async function listClasses(actor: Actor) {
  const ids = await classIds(actor);
  return db.class.findMany({
    where: { id: { in: ids }, active: true },
    include: {
      _count: {
        select: {
          enrollments: {
            where: { active: true, student: { user: { active: true, role: 'STUDENT' } } },
          },
          teachers: true,
        },
      },
      teachers: {
        include: {
          teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
          subject: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
}
export async function saveClass(actor: Actor, input: unknown, id?: string) {
  admin(actor);
  const data = classSchema.parse(input);
  const row = id ? await db.class.update({ where: { id }, data }) : await db.class.create({ data });
  await db.auditLog.create({
    data: { actorId: actor.id, action: id ? 'CLASS_UPDATED' : 'CLASS_CREATED', entityId: row.id },
  });
  return row;
}
export async function enroll(actor: Actor, input: unknown) {
  admin(actor);
  const { studentId, classId } = z
    .object({ studentId: z.string(), classId: z.string().nullable() })
    .parse(input);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
    const student = await tx.studentProfile.findFirst({
      where: { id: studentId, user: { active: true, role: 'STUDENT' } },
    });
    if (!student) throw new AppError(404, 'Aktif öğrenci bulunamadı.');
    if (classId && !(await tx.class.findFirst({ where: { id: classId, active: true } })))
      throw new AppError(404, 'Sınıf bulunamadı.');
    await tx.classEnrollment.updateMany({
      where: { studentId, active: true },
      data: { active: false, endedAt: new Date() },
    });
    if (classId) await tx.classEnrollment.create({ data: { studentId, classId } });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'ENROLLMENT_CHANGED', entityId: studentId },
    });
  });
}
export async function assignTeacher(actor: Actor, input: unknown, remove = false) {
  admin(actor);
  const data = z
    .object({ teacherId: z.string(), classId: z.string(), subjectId: z.string() })
    .parse(input);
  if (
    !(await db.teacherProfile.findFirst({
      where: { id: data.teacherId, user: { active: true, role: 'TEACHER' } },
    }))
  )
    throw new AppError(404, 'Aktif öğretmen bulunamadı.');
  if (remove) {
    if (await db.lessonSchedule.count({ where: { ...data, active: true } }))
      throw new AppError(409, 'Önce öğretmenin ilgili ders programını kaldırın.');
    await db.teacherClassAssignment.deleteMany({ where: data });
  } else
    await db.teacherClassAssignment.upsert({
      where: { teacherId_classId_subjectId: data },
      create: data,
      update: {},
    });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: remove ? 'TEACHER_UNASSIGNED' : 'TEACHER_ASSIGNED',
      entityId: data.teacherId,
    },
  });
}
export async function metadata(actor: Actor) {
  const classes = await listClasses(actor);
  const [subjects, rooms, teachers, templates, settings] = await Promise.all([
    db.subject.findMany({ orderBy: { name: 'asc' } }),
    db.classroom.findMany({ orderBy: { name: 'asc' } }),
    actor.role === 'ADMIN'
      ? db.teacherProfile.findMany({
          where: { user: { active: true, role: 'TEACHER' } },
          select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } },
        })
      : [],
    db.examTemplate.findMany({
      include: { subjects: { include: { subject: true } } },
      orderBy: { name: 'asc' },
    }),
    db.institutionSettings.findUnique({
      where: { id: 'main' },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        academicYear: true,
        timezone: true,
        logoKey: true,
      },
    }),
  ]);
  return {
    classes,
    subjects,
    rooms,
    teachers,
    templates,
    settings: settings
      ? {
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
          address: settings.address,
          academicYear: settings.academicYear,
          timezone: settings.timezone,
          hasLogo: !!settings.logoKey,
        }
      : {
          name: 'Akademi',
          email: '',
          phone: '',
          address: '',
          academicYear: '2026–2027',
          timezone: 'Europe/Istanbul',
          hasLogo: false,
        },
  };
}
export async function createReference(actor: Actor, kind: 'subjects' | 'rooms', input: unknown) {
  admin(actor);
  const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(input);
  return kind === 'subjects'
    ? db.subject.create({ data: { name } })
    : db.classroom.create({ data: { name } });
}
export async function listSchedules(actor: Actor) {
  const ids = await classIds(actor);
  return db.lessonSchedule.findMany({
    where: {
      active: true,
      ...(actor.role === 'TEACHER' ? { teacherId: actor.teacher!.id } : { classId: { in: ids } }),
    },
    include: {
      class: true,
      subject: true,
      classroom: true,
      teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: [{ day: 'asc' }, { startMinute: 'asc' }],
  });
}
export async function saveSchedule(actor: Actor, input: unknown, id?: string) {
  admin(actor);
  const data = scheduleSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(81933)`;
    if (
      !(await tx.teacherClassAssignment.findUnique({
        where: {
          teacherId_classId_subjectId: {
            teacherId: data.teacherId,
            classId: data.classId,
            subjectId: data.subjectId,
          },
        },
      }))
    )
      throw new AppError(400, 'Önce öğretmeni bu sınıfa ve derse atayın.');
    if (
      !(await tx.teacherProfile.findFirst({
        where: { id: data.teacherId, user: { active: true, role: 'TEACHER' } },
      }))
    )
      throw new AppError(400, 'Öğretmen aktif değil.');
    const conflict = await tx.lessonSchedule.findFirst({
      where: {
        id: id ? { not: id } : undefined,
        active: true,
        day: data.day,
        startMinute: { lt: data.endMinute },
        endMinute: { gt: data.startMinute },
        OR: [
          { teacherId: data.teacherId },
          { classroomId: data.classroomId },
          { classId: data.classId },
        ],
      },
    });
    if (conflict) throw new AppError(409, 'Öğretmen, sınıf veya derslik bu saat aralığında dolu.');
    if (id && (await tx.lessonSession.count({ where: { scheduleId: id } })))
      throw new AppError(409, 'Yoklama geçmişi olan dersi kapatıp yeni bir ders oluşturun.');
    const row = id
      ? await tx.lessonSchedule.update({ where: { id }, data })
      : await tx.lessonSchedule.create({ data });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'SCHEDULE_SAVED', entityId: row.id },
    });
    return row;
  });
}
export async function removeSchedule(actor: Actor, id: string) {
  admin(actor);
  await db.$transaction([
    db.lessonSchedule.update({ where: { id }, data: { active: false } }),
    db.auditLog.create({ data: { actorId: actor.id, action: 'SCHEDULE_REMOVED', entityId: id } }),
  ]);
}
export async function saveSettings(actor: Actor, input: unknown) {
  admin(actor);
  const data = settingsSchema.parse(input);
  return db.$transaction([
    db.institutionSettings.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...data },
      update: data,
    }),
    db.auditLog.create({ data: { actorId: actor.id, action: 'SETTINGS_UPDATED' } }),
  ]);
}

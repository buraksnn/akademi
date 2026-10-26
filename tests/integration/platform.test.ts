import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { db } from '@/lib/db';
import { actorSelect, sessionActor, createSession, type Actor } from '@/lib/auth/session';
import { hashPassword } from '@/lib/security/password';
import { hashToken } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import * as auth from '@/server/services/auth';
import * as m from '@/server/services/management';
import * as a from '@/server/services/academic';
import * as photo from '@/server/services/photos';
import { studentCard } from '@/server/services/card';
import { initStorage } from '@/lib/storage';
import { today, weekDay } from '@/lib/time';
let admin: Actor, teacher: Actor, otherTeacher: Actor, student: Actor, otherStudent: Actor;
let c1: string,
  c2: string,
  subject: string,
  otherSubject: string,
  room: string,
  scheduleId: string,
  examId: string,
  templateSubjectId: string,
  assignmentId: string;
const password = 'Integration-' + randomBytes(16).toString('hex');
const registrationEmail = 'registration@example.test';
const digits = [9, 1, 7, 3, 5, 2, 8, 4, 6];
digits.push(
  ((((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 -
    (digits[1] + digits[3] + digits[5] + digits[7])) %
    10) +
    10) %
    10,
);
digits.push(digits.reduce((x, y) => x + y, 0) % 10);
const syntheticTckn = digits.join('');
async function emailToken(email: string) {
  const list = (await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json()) as {
    messages: { ID: string; To: { Address: string }[] }[];
  };
  const message = list.messages.find((m) => m.To.some((t) => t.Address === email));
  expect(message).toBeDefined();
  const detail = (await (
    await fetch('http://127.0.0.1:8025/api/v1/message/' + message!.ID)
  ).json()) as { Text: string };
  const link = detail.Text.match(/https?:\/\/[^\s<]+/)?.[0];
  expect(link).toBeDefined();
  return new URL(link!).searchParams.get('token')!;
}
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
    throw new Error('Isolated test database required.');
  await db.$executeRawUnsafe(
    'TRUNCATE "User","Class","Subject","Classroom","ExamTemplate","InstitutionSettings","RateLimit" CASCADE',
  );
  const passwordHash = await hashPassword(password);
  const make = (firstName: string, role: 'ADMIN' | 'TEACHER' | 'STUDENT') =>
    db.user.create({
      data: {
        firstName,
        lastName: 'Sentetik',
        email: firstName.toLowerCase() + '@example.test',
        passwordHash,
        role,
        emailVerified: new Date(),
        ...(role === 'TEACHER'
          ? { teacher: { create: {} } }
          : role === 'STUDENT'
            ? { student: { create: {} } }
            : {}),
      },
      select: actorSelect,
    });
  admin = await make('Admin', 'ADMIN');
  teacher = await make('Teacher', 'TEACHER');
  otherTeacher = await make('OtherTeacher', 'TEACHER');
  student = await make('Student', 'STUDENT');
  otherStudent = await make('OtherStudent', 'STUDENT');
  c1 = (await db.class.create({ data: { name: 'Test A' } })).id;
  c2 = (await db.class.create({ data: { name: 'Test B' } })).id;
  subject = (await db.subject.create({ data: { name: 'Test Matematik' } })).id;
  otherSubject = (await db.subject.create({ data: { name: 'Test Türkçe' } })).id;
  room = (await db.classroom.create({ data: { name: 'Test 101' } })).id;
  await db.institutionSettings.create({ data: { id: 'main', name: 'Sentetik Test Kurumu' } });
  await m.enroll(admin, { studentId: student.student!.id, classId: c1 });
  await m.enroll(admin, { studentId: otherStudent.student!.id, classId: c2 });
  await m.assignTeacher(admin, { teacherId: teacher.teacher!.id, classId: c1, subjectId: subject });
  await m.assignTeacher(admin, {
    teacherId: otherTeacher.teacher!.id,
    classId: c2,
    subjectId: otherSubject,
  });
  await initStorage();
});
afterAll(async () => {
  await db.$disconnect();
});
describe('Real registration and session security', () => {
  it('registers a student with encrypted identity and Argon2id, without role escalation', async () => {
    const image = await sharp({
      create: { width: 48, height: 64, channels: 3, background: '#aabbcc' },
    })
      .png()
      .toBuffer();
    await auth.register(
      {
        firstName: 'Sentetik',
        lastName: 'Kayıt',
        email: registrationEmail,
        tckn: syntheticTckn,
        password,
        confirmPassword: password,
        privacy: true,
        role: 'ADMIN',
      },
      'register-test',
      new File([new Uint8Array(image)], 'optional-photo.png', { type: 'image/png' }),
    );
    const user = await db.user.findUniqueOrThrow({
      where: { email: registrationEmail },
      include: { student: true },
    });
    expect(user.role).toBe('STUDENT');
    expect(user.student).not.toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.tcEncrypted).not.toContain(syntheticTckn);
    expect(user.tcIndex).toHaveLength(64);
    expect(user.emailVerified).toBeNull();
    expect(await db.profilePhoto.findUnique({ where: { userId: user.id } })).not.toBeNull();
  });
  it('refuses login before verification and prevents duplicate accounts', async () => {
    await expect(
      auth.login({ identifier: registrationEmail, password }, 'unverified'),
    ).rejects.toMatchObject({ status: 401 });
    await auth.register(
      {
        firstName: 'Sentetik',
        lastName: 'Kayıt',
        email: registrationEmail,
        tckn: syntheticTckn,
        password,
        confirmPassword: password,
        privacy: true,
      },
      'duplicate',
    );
    expect(await db.user.count({ where: { email: registrationEmail } })).toBe(1);
  });
  it('delivers and consumes a hashed email verification token exactly once', async () => {
    const token = await emailToken(registrationEmail),
      row = await db.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(row).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain(token);
    await auth.verifyEmail({ token });
    await expect(auth.verifyEmail({ token })).rejects.toMatchObject({ status: 400 });
  });
  it('signs in using email and TCKN with the same password', async () => {
    for (const identifier of [registrationEmail, syntheticTckn]) {
      const result = await auth.login(
        { identifier, password, remember: true },
        'signin-' + identifier,
      );
      expect(result.role).toBe('STUDENT');
      const actor = await sessionActor(result.token);
      expect(actor?.email).toBe(registrationEmail);
      expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 86400000);
    }
  });
  it('uses a generic error for wrong passwords and nonexistent accounts', async () => {
    for (const identifier of [registrationEmail, 'missing@example.test'])
      await expect(
        auth.login({ identifier, password: 'incorrect-password' }, 'wrong-' + identifier),
      ).rejects.toMatchObject({
        status: 401,
        message: 'Giriş yapılamadı. Bilgilerinizi ve e-posta doğrulamanızı kontrol edin.',
      });
  });
  it('resets a password with a mailed single-use token and revokes previous sessions', async () => {
    const session = await auth.login({ identifier: registrationEmail, password }, 'reset-session');
    await auth.requestReset({ email: registrationEmail }, 'reset-test');
    const token = await emailToken(registrationEmail);
    expect(
      await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } }),
    ).not.toBeNull();
    await auth.resetPassword({
      token,
      password: password + 'new',
      confirmPassword: password + 'new',
    });
    expect(await sessionActor(session.token)).toBeNull();
    await expect(
      auth.resetPassword({ token, password, confirmPassword: password }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      auth.login({ identifier: registrationEmail, password }, 'old-password'),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      (
        await auth.login(
          { identifier: registrationEmail, password: password + 'new' },
          'new-password',
        )
      ).role,
    ).toBe('STUDENT');
  });
  it('rejects expired reset tokens and expired sessions', async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: registrationEmail } }),
      token = randomBytes(32).toString('hex');
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(
      auth.resetPassword({ token, password, confirmPassword: password }),
    ).rejects.toMatchObject({ status: 400 });
    const session = await createSession(user.id, false);
    await db.session.update({
      where: { tokenHash: hashToken(session.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await sessionActor(session.token)).toBeNull();
  });
  it('blocks stale password verification from creating a session after password changes', async () => {
    const old = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    await auth.changePassword(student, {
      currentPassword: password,
      password: password + 'changed',
      confirmPassword: password + 'changed',
    });
    await expect(createSession(student.id, false, old.passwordHash)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('enforces an atomic database rate limit', async () => {
    const key = randomBytes(8).toString('hex');
    await rateLimit('unit', key, 2, 60);
    await rateLimit('unit', key, 2, 60);
    await expect(rateLimit('unit', key, 2, 60)).rejects.toMatchObject({ status: 429 });
  });
});
describe('Object authorization, roles and management', () => {
  it('denies students access to others and keeps teacher identity data restricted', async () => {
    await expect(m.userDetail(student, otherStudent.id)).rejects.toMatchObject({ status: 403 });
    await expect(m.userDetail(teacher, otherStudent.id)).rejects.toMatchObject({ status: 403 });
    const own = await m.userDetail(teacher, student.id);
    expect(own.id).toBe(student.id);
    expect(own).not.toHaveProperty('tcLastTwo');
    expect(own).not.toHaveProperty('tcEncrypted');
    expect(own).not.toHaveProperty('passwordHash');
  });
  it('paginates students on the server and scopes teachers to their own class', async () => {
    const result = await m.listUsers(teacher, new URLSearchParams());
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(student.id);
    expect((await m.listUsers(teacher, new URLSearchParams({ classId: c2 }))).items).toHaveLength(
      0,
    );
    await expect(m.listUsers(student, new URLSearchParams())).rejects.toMatchObject({
      status: 403,
    });
  });
  it('rejects non-admin management mutations', async () => {
    await expect(m.saveClass(teacher, { name: 'Unauthorized' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      m.enroll(student, { studentId: student.student!.id, classId: c2 }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('enforces one active class in transactions and in the database', async () => {
    await expect(
      db.classEnrollment.create({ data: { studentId: student.student!.id, classId: c2 } }),
    ).rejects.toThrow();
    await m.enroll(admin, { studentId: student.student!.id, classId: c2 });
    expect(
      await db.classEnrollment.count({ where: { studentId: student.student!.id, active: true } }),
    ).toBe(1);
    await m.enroll(admin, { studentId: student.student!.id, classId: c1 });
  });
  it('protects the last active administrator', async () => {
    await expect(
      m.updateUser(admin, admin.id, {
        firstName: 'Admin',
        lastName: 'Sentetik',
        role: 'STUDENT',
        active: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('requires teacher assignment and rejects schedule overlaps at both service and DB level', async () => {
    await expect(
      m.saveSchedule(admin, {
        classId: c2,
        teacherId: teacher.teacher!.id,
        subjectId: subject,
        classroomId: room,
        day: weekDay(today()),
        startMinute: 540,
        endMinute: 580,
      }),
    ).rejects.toMatchObject({ status: 400 });
    const data = {
      classId: c1,
      teacherId: teacher.teacher!.id,
      subjectId: subject,
      classroomId: room,
      day: weekDay(today()),
      startMinute: 540,
      endMinute: 580,
    };
    scheduleId = (await m.saveSchedule(admin, data)).id;
    await expect(
      m.saveSchedule(admin, { ...data, startMinute: 560, endMinute: 600 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      db.lessonSchedule.create({ data: { ...data, startMinute: 560, endMinute: 600 } }),
    ).rejects.toThrow();
    expect(
      (await m.saveSchedule(admin, { ...data, startMinute: 580, endMinute: 620 })).id,
    ).toBeDefined();
  });
});
describe('Academic records and their access policies', () => {
  it('validates exam counts, computes quarter nets and scopes result access', async () => {
    const template = await a.createTemplate(admin, {
      name: 'Test TYT',
      type: 'TYT',
      subjects: [{ subjectId: subject, questionCount: 40 }],
    });
    const exam = await a.saveExam(admin, {
      name: 'Sentetik sınav',
      templateId: template.id,
      date: today(),
      status: 'PUBLISHED',
      classIds: [c1],
    });
    examId = exam.id;
    templateSubjectId = (
      await db.examTemplateSubject.findFirstOrThrow({ where: { templateId: template.id } })
    ).id;
    const input = {
      examId,
      studentId: student.student!.id,
      subjects: [{ templateSubjectId, correct: 30, wrong: 7, blank: 3 }],
    };
    expect(Number((await a.saveResult(admin, input)).totalNet)).toBe(28.25);
    await expect(
      a.saveResult(admin, {
        ...input,
        subjects: [{ templateSubjectId, correct: 40, wrong: 1, blank: 0 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(a.saveResult(teacher, input)).rejects.toMatchObject({ status: 403 });
    expect(
      await a.listResults(otherStudent, new URLSearchParams({ studentId: student.student!.id })),
    ).toHaveLength(0);
    expect((await a.listResults(teacher, new URLSearchParams()))[0].partial).toBe(true);
  });
  it('restricts assignments and completion to the relevant class and student', async () => {
    const input = {
      title: 'Test ödevi',
      classId: c1,
      subjectId: subject,
      dueAt: new Date(Date.now() - 60000).toISOString(),
    };
    assignmentId = (await a.saveAssignment(teacher, input)).id;
    await expect(a.saveAssignment(teacher, { ...input, classId: c2 })).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      a.completeAssignment(otherStudent, assignmentId, { completed: true }),
    ).rejects.toMatchObject({ status: 404 });
    await a.completeAssignment(student, assignmentId, { completed: true });
    expect((await a.listAssignments(student))[0].statuses[0].completedAt).not.toBeNull();
    expect(await a.listAssignments(otherStudent)).toHaveLength(0);
    const roster = await a.assignmentStudents(teacher, assignmentId);
    expect(roster[0].assignmentStatuses[0].completedAt).not.toBeNull();
    await expect(a.assignmentStudents(otherTeacher, assignmentId)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('targets announcements by role and class', async () => {
    await a.saveAnnouncement(admin, {
      title: 'Test sınıf duyurusu',
      content: 'Sadece Test A',
      audience: 'CLASSES',
      classIds: [c1],
    });
    await a.saveAnnouncement(admin, {
      title: 'Öğretmen duyurusu',
      content: 'Sadece öğretmenler',
      audience: 'TEACHERS',
    });
    expect((await a.listAnnouncements(student)).map((v) => v.title)).toEqual([
      'Test sınıf duyurusu',
    ]);
    expect(await a.listAnnouncements(otherStudent)).toHaveLength(0);
    expect(await a.listAnnouncements(teacher)).toHaveLength(2);
    await expect(
      a.saveAnnouncement(student, { title: 'No', content: 'No', audience: 'ALL' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects unauthorized attendance, prevents duplicates and audits admin corrections', async () => {
    const input = {
      scheduleId,
      date: today(),
      records: [{ studentId: student.student!.id, status: 'PRESENT' }],
    };
    await expect(a.saveAttendance(student, input)).rejects.toMatchObject({ status: 403 });
    await expect(a.saveAttendance(otherTeacher, input)).rejects.toMatchObject({ status: 403 });
    await a.saveAttendance(teacher, input);
    await a.saveAttendance(teacher, input);
    expect(await db.attendance.count({ where: { studentId: student.student!.id } })).toBe(1);
    await expect(
      a.saveAttendance(teacher, {
        ...input,
        records: [{ studentId: student.student!.id, status: 'ABSENT' }],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await a.saveAttendance(admin, {
      ...input,
      records: [{ studentId: student.student!.id, status: 'ABSENT' }],
    });
    expect(
      (await db.attendance.findFirstOrThrow({ where: { studentId: student.student!.id } }))
        .takenById,
    ).toBe(admin.id);
    expect(
      await db.auditLog.count({ where: { action: 'ATTENDANCE_SAVED', actorId: admin.id } }),
    ).toBeGreaterThan(0);
    await m.enroll(admin, { studentId: student.student!.id, classId: c2 });
    await a.saveAttendance(admin, input);
    const historical = await a.getAttendance(
      admin,
      new URLSearchParams({ scheduleId, date: today() }),
    );
    expect(
      'students' in historical && historical.students.some((s) => s.id === student.student!.id),
    ).toBe(true);
    await m.enroll(admin, { studentId: student.student!.id, classId: c1 });
  });
});
describe('Photos, private S3 access and PDF', () => {
  it('rejects invalid content and oversized files, strips metadata and re-encodes', async () => {
    await expect(
      photo.safeImage(new File(['not an image'], 'x.png', { type: 'image/png' })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      photo.safeImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'x.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    const image = await sharp({
      create: { width: 64, height: 80, channels: 3, background: '#c0c8d0' },
    })
      .withMetadata()
      .png()
      .toBuffer();
    const result = await photo.safeImage(
      new File([new Uint8Array(image)], 'test.png', { type: 'image/png' }),
    );
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });
  it('uploads, reads, replaces and removes photos with server authorization', async () => {
    const image = await sharp({
        create: { width: 64, height: 80, channels: 3, background: '#aabbcc' },
      })
        .jpeg()
        .toBuffer(),
      file = new File([new Uint8Array(image)], 'original-sensitive-name.jpg', {
        type: 'image/jpeg',
      });
    await photo.savePhoto(student, student.id, file);
    const row = await db.profilePhoto.findUniqueOrThrow({ where: { userId: student.id } });
    expect(row.objectKey).not.toContain(file.name);
    expect((await sharp(await photo.readPhoto(teacher, student.id)).metadata()).format).toBe(
      'jpeg',
    );
    await expect(photo.readPhoto(otherStudent, student.id)).rejects.toMatchObject({ status: 403 });
    await expect(photo.savePhoto(otherStudent, student.id, file)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      (await fetch(process.env.S3_ENDPOINT + '/' + process.env.S3_BUCKET + '/' + row.objectKey))
        .status,
    ).toBe(403);
    await photo.savePhoto(student, student.id, file);
    expect(await db.storageGarbage.count()).toBeGreaterThan(0);
  });
  it('produces an authorized PDF with the private photo', async () => {
    await expect(studentCard(student, student.id)).rejects.toMatchObject({ status: 403 });
    const card = await studentCard(admin, student.id),
      pdf = await PDFDocument.load(card.data);
    expect(pdf.getPageCount()).toBe(1);
    expect(card.data.length).toBeGreaterThan(2000);
    await photo.removePhoto(student, student.id);
    await expect(photo.readPhoto(student, student.id)).rejects.toMatchObject({ status: 404 });
  });
  it('revokes sessions on deactivation and hides inactive students', async () => {
    const s = await createSession(otherStudent.id, true);
    await m.updateUser(admin, otherStudent.id, {
      firstName: 'OtherStudent',
      lastName: 'Sentetik',
      role: 'STUDENT',
      active: false,
    });
    expect(await sessionActor(s.token)).toBeNull();
    expect(
      await db.classEnrollment.count({
        where: { studentId: otherStudent.student!.id, active: true },
      }),
    ).toBe(0);
  });
});

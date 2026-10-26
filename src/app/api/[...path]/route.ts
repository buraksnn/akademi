import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireActor, COOKIE, roleHome } from '@/lib/auth/session';
import { sealSessionToken, unsealSessionToken } from '@/lib/auth/cookie';
import { hashToken } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import { AppError } from '@/lib/errors';
import { requireSameOrigin, boundedBody } from '@/lib/security/request';
import * as auth from '@/server/services/auth';
import * as mgmt from '@/server/services/management';
import * as academic from '@/server/services/academic';
import * as photos from '@/server/services/photos';
import { dashboard } from '@/server/services/dashboard';
import { studentCard } from '@/server/services/card';
import { getObject } from '@/lib/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ok = (data: unknown = { success: true }, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } });
async function dispatch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const segments = (await params).path,
      path = segments.join('/'),
      [resource, id, action] = segments,
      method = req.method,
      writing = method !== 'GET';
    if (writing) {
      requireSameOrigin(req.headers.get('origin'));
      const length = Number(req.headers.get('content-length'));
      if (length > 6 * 1024 * 1024) throw new AppError(413, 'İstek boyutu sınırı aşıldı.');
    }
    const ip =
      process.env.TRUST_PROXY === 'true'
        ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        : 'shared';
    const formData = async () => {
      const buffer = await boundedBody(req, 6 * 1024 * 1024);
      return new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': req.headers.get('content-type') || '' },
        body: Buffer.from(buffer),
      }).formData();
    };
    const json = async () => {
      if (!req.headers.get('content-type')?.includes('application/json'))
        throw new AppError(415, 'JSON biçimi gerekli.');
      const text = new TextDecoder().decode(await boundedBody(req, 200000));
      try {
        return JSON.parse(text);
      } catch {
        throw new AppError(400, 'Geçersiz istek.');
      }
    };
    if (resource === 'auth' && method === 'POST') {
      let file: File | undefined;
      let data: unknown;
      if (id === 'register' && req.headers.get('content-type')?.startsWith('multipart/form-data')) {
        const form = await formData();
        try {
          data = JSON.parse(String(form.get('data') || ''));
        } catch {
          throw new AppError(400, 'Geçersiz kayıt bilgileri.');
        }
        const uploaded = form.get('file');
        if (uploaded instanceof File) file = uploaded;
      } else data = await json();
      switch (id) {
        case 'register':
          await auth.register(data, ip, file);
          return ok({
            message: 'Bilgiler uygunsa doğrulama bağlantısı e-posta adresinize gönderildi.',
          });
        case 'login': {
          const result = await auth.login(data, ip);
          const res = ok({ redirect: roleHome(result.role) });
          res.cookies.set(
            COOKIE,
            await sealSessionToken(result.token, result.remember ? 30 * 86400 : 86400),
            {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              ...(result.remember ? { expires: result.expiresAt } : {}),
            },
          );
          return res;
        }
        case 'forgot':
          await auth.requestReset(data, ip);
          return ok({ message: 'Adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' });
        case 'resend':
          await auth.resendVerification(data, ip);
          return ok({ message: 'Adres kayıtlı ve doğrulanmamışsa yeni bağlantı gönderildi.' });
        case 'verify':
          await auth.verifyEmail(data);
          return ok();
        case 'reset':
          await auth.resetPassword(data);
          return ok();
        case 'logout': {
          const actor = await requireActor(),
            token = await unsealSessionToken(req.cookies.get(COOKIE)?.value);
          if (token)
            await db.session.deleteMany({
              where: { tokenHash: hashToken(token), userId: actor.id },
            });
          const response = ok();
          response.cookies.set(COOKIE, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0,
          });
          return response;
        }
        default:
          throw new AppError(404, 'İşlem bulunamadı.');
      }
    }
    const actor = await requireActor();
    if (writing) await rateLimit('mutation', actor.id, 180, 60);
    if (path === 'me' && method === 'GET') return ok(await mgmt.userDetail(actor, actor.id));
    if (path === 'dashboard' && method === 'GET') return ok(await dashboard(actor));
    if (path === 'metadata' && method === 'GET') return ok(await mgmt.metadata(actor));
    if (path === 'profile/password' && method === 'POST') {
      await auth.changePassword(actor, await json());
      return ok();
    }
    if (path === 'profile/email' && method === 'POST') {
      await auth.changeEmail(actor, await json());
      return ok();
    }
    if (resource === 'users') {
      if (method === 'GET' && action === 'card') {
        const card = await studentCard(actor, id);
        return new NextResponse(Buffer.from(card.data), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="ogrenci-${card.number}.pdf"`,
            'Cache-Control': 'private, no-store',
          },
        });
      }
      if (method === 'GET')
        return ok(
          id
            ? await mgmt.userDetail(actor, id)
            : await mgmt.listUsers(actor, req.nextUrl.searchParams),
        );
      if (method === 'PATCH' && id) {
        await mgmt.updateUser(actor, id, await json());
        return ok();
      }
    }
    if (path === 'teachers' && method === 'POST') {
      await mgmt.createTeacher(actor, await json());
      return ok();
    }
    if (resource === 'classes') {
      if (method === 'GET') return ok(await mgmt.listClasses(actor));
      if (method === 'POST' || method === 'PATCH')
        return ok(await mgmt.saveClass(actor, await json(), id));
    }
    if (path === 'enrollments' && method === 'POST') {
      await mgmt.enroll(actor, await json());
      return ok();
    }
    if (path === 'teacher-assignments' && (method === 'POST' || method === 'DELETE')) {
      await mgmt.assignTeacher(actor, await json(), method === 'DELETE');
      return ok();
    }
    if ((path === 'subjects' || path === 'rooms') && method === 'POST')
      return ok(await mgmt.createReference(actor, path, await json()));
    if (resource === 'schedules') {
      if (method === 'GET') return ok(await mgmt.listSchedules(actor));
      if (method === 'POST' || method === 'PATCH')
        return ok(await mgmt.saveSchedule(actor, await json(), id));
      if (method === 'DELETE' && id) {
        await mgmt.removeSchedule(actor, id);
        return ok();
      }
    }
    if (resource === 'exams') {
      if (method === 'GET') return ok(await academic.listExams(actor));
      if (method === 'POST' || method === 'PATCH')
        return ok(await academic.saveExam(actor, await json(), id));
    }
    if (path === 'templates' && method === 'POST')
      return ok(await academic.createTemplate(actor, await json()));
    if (path === 'results') {
      if (method === 'GET') return ok(await academic.listResults(actor, req.nextUrl.searchParams));
      if (method === 'POST') return ok(await academic.saveResult(actor, await json()));
    }
    if (resource === 'assignments') {
      if (method === 'GET' && id && action === 'students')
        return ok(await academic.assignmentStudents(actor, id));
      if (method === 'GET') return ok(await academic.listAssignments(actor));
      if (method === 'POST' && action === 'complete') {
        await academic.completeAssignment(actor, id, await json());
        return ok();
      }
      if (method === 'POST' || method === 'PATCH')
        return ok(await academic.saveAssignment(actor, await json(), id));
      if (method === 'DELETE' && id) {
        await academic.deleteAssignment(actor, id);
        return ok();
      }
    }
    if (resource === 'announcements') {
      if (method === 'GET') return ok(await academic.listAnnouncements(actor));
      if (method === 'POST' || method === 'PATCH')
        return ok(await academic.saveAnnouncement(actor, await json(), id));
      if (method === 'DELETE' && id) {
        await academic.deleteAnnouncement(actor, id);
        return ok();
      }
    }
    if (path === 'attendance') {
      if (method === 'GET')
        return ok(await academic.getAttendance(actor, req.nextUrl.searchParams));
      if (method === 'POST') {
        await academic.saveAttendance(actor, await json());
        return ok();
      }
    }
    if (resource === 'photos' && id) {
      if (method === 'GET')
        return new NextResponse(await photos.readPhoto(actor, id), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, no-store',
            Vary: 'Cookie',
          },
        });
      if (method === 'POST') {
        const form = await formData(),
          file = form.get('file');
        if (!(file instanceof File)) throw new AppError(400, 'Fotoğraf seçin.');
        await photos.savePhoto(actor, id, file);
        return ok();
      }
      if (method === 'DELETE') {
        await photos.removePhoto(actor, id);
        return ok();
      }
    }
    if (path === 'settings' && method === 'PATCH') {
      await mgmt.saveSettings(actor, await json());
      return ok();
    }
    if (path === 'logo') {
      if (method === 'GET') {
        const settings = await db.institutionSettings.findUnique({ where: { id: 'main' } });
        if (!settings?.logoKey) throw new AppError(404, 'Logo bulunamadı.');
        return new NextResponse(await getObject(settings.logoKey), {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' },
        });
      }
      if (method === 'POST') {
        const form = await formData(),
          file = form.get('file');
        if (!(file instanceof File)) throw new AppError(400, 'Logo seçin.');
        await photos.saveLogo(actor, file);
        return ok();
      }
    }
    throw new AppError(404, 'İşlem bulunamadı.');
  } catch (error) {
    if (error instanceof ZodError)
      return ok({ error: error.issues.map((v) => v.message).join(' ') }, 400);
    if (error instanceof AppError) return ok({ error: error.message }, error.status);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return ok({ error: 'Bu bilgiler kullanılamıyor veya kayıt zaten mevcut.' }, 409);
      if (error.code === 'P2025') return ok({ error: 'Kayıt bulunamadı.' }, 404);
      if (error.code === 'P2003')
        return ok({ error: 'İlişkili kayıt bulunamadı veya kullanımda.' }, 409);
    }
    console.error('API_ERROR', error instanceof Error ? error.name : 'Unknown');
    return ok({ error: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' }, 500);
  }
}
export const GET = dispatch,
  POST = dispatch,
  PATCH = dispatch,
  DELETE = dispatch;

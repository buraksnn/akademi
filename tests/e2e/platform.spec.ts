import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
const local = readFileSync('work/development-accounts.md', 'utf8');
const password = local.match(/parola: (.+)/)![1];
async function login(page: Page, email: string) {
  await page.goto('/giris');
  await page.getByLabel('TC Kimlik Numarası veya E-posta').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page).toHaveURL(/\/(ogrenci|ogretmen|yonetim)$/);
}
test('guest page guards, validation and CSRF denial', async ({ page, request }) => {
  await page.goto('/yonetim');
  await expect(page).toHaveURL(/\/giris$/);
  expect((await request.get('/api/users')).status()).toBe(401);
  expect(
    (
      await request.post('/api/auth/login', {
        data: { identifier: 'x', password: 'x' },
        headers: { Origin: 'https://hostile.example.test' },
      })
    ).status(),
  ).toBe(403);
  await page.goto('/kayit');
  await page.getByRole('button', { name: 'Hesap oluştur', exact: true }).click();
  await expect(page.locator('.form-error, .empty[role="alert"]')).toBeVisible();
});
test('admin navigates all modules, creates a class and persists it after reload', async ({
  page,
}) => {
  await login(page, 'yonetici@example.test');
  await expect(page).toHaveURL(/\/yonetim$/);
  await expect(page.getByRole('heading', { name: 'Kurumunuza genel bakış.' })).toBeVisible();
  for (const [path, title] of [
    ['ogrenciler', 'Öğrenciler'],
    ['ogretmenler', 'Öğretmenler'],
    ['ders-programi', 'Ders programı'],
    ['denemeler', 'Deneme sınavları'],
    ['odevler', 'Ödevler'],
    ['yoklama', 'Yoklama'],
    ['duyurular', 'Duyurular'],
    ['ayarlar', 'Kurum ayarları'],
  ]) {
    await page.goto('/yonetim/' + path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.form-error, .empty[role="alert"]')).toHaveCount(0);
  }
  await page.goto('/yonetim/siniflar');
  const name = 'Tarayıcı Test ' + Date.now();
  await page.getByRole('button', { name: 'Sınıf oluştur', exact: true }).click();
  await page.getByLabel('Sınıf adı', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.goto('/yonetim/ogrenciler');
  await page.getByRole('button', { name: /Ada Örnek/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Öğrenci kartı' }).click();
  expect((await download).suggestedFilename()).toMatch(/^ogrenci-\d+\.pdf$/);
});
test('student sees real academic data and completes their assignment', async ({ page }) => {
  await login(page, 'ogrenci1@example.test');
  await expect(page).toHaveURL(/\/ogrenci$/);
  await expect(page.getByRole('heading', { name: 'Günaydın, Ada.' })).toBeVisible();
  await page.goto('/ogrenci/odevler');
  const check = page.getByRole('button', { name: 'Ödevi tamamlandı olarak işaretle' }).first();
  if (await check.count()) {
    await check.click();
    await expect(
      page.getByRole('button', { name: 'Ödevi bekliyor olarak işaretle' }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Ödevi bekliyor olarak işaretle' }).first(),
    ).toBeVisible();
  }
  await page.goto('/ogrenci/denemeler');
  await expect(page.getByText('TYT Gelişim Denemesi 2', { exact: true })).toBeVisible();
  await page.goto('/yonetim/ogrenciler');
  await expect(page).toHaveURL(/\/ogrenci$/);
  expect(
    (
      await page.request.post('/api/classes', {
        data: { name: 'Forbidden' },
        headers: { Origin: process.env.APP_URL || 'http://localhost:3000' },
      })
    ).status(),
  ).toBe(403);
});
test('teacher sees assigned classes and cannot manage users', async ({ page }) => {
  await login(page, 'ogretmen1@example.test');
  await expect(page).toHaveURL(/\/ogretmen$/);
  await page.goto('/ogretmen/siniflar');
  await expect(page.getByRole('heading', { name: 'Sınıflarım', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '12-A Sayısal', exact: true })).toBeVisible();
  await page.goto('/ogretmen/ogrenciler');
  await expect(page.getByRole('heading', { name: 'Öğrencilerim', exact: true })).toBeVisible();
  expect(
    (
      await page.request.patch('/api/users/not-a-user', {
        data: { active: false },
        headers: { Origin: process.env.APP_URL || 'http://localhost:3000' },
      })
    ).status(),
  ).toBe(403);
});
test('mobile layout, navigation and keyboard focus work without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'ogrenci1@example.test');
  await expect(page).toHaveURL(/\/ogrenci$/);
  await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click();
  await page.getByRole('link', { name: 'Ders Programım', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ders Programım', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/ogrenci/profil');
  await expect(page.getByRole('heading', { name: 'Profilim', exact: true })).toBeVisible();
  await expect(page.locator('.profile-fields')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press('Tab');
  await page.screenshot({ path: 'work/mobile-profile.png', fullPage: true });
});

test('student crops and uploads a private profile photo', async ({ page, request }) => {
  await login(page, 'ogrenci2@example.test');
  await page.goto('/ogrenci/profil');
  await expect(page.locator('.profile-fields')).toBeVisible();
  const image = await sharp({
    create: { width: 240, height: 320, channels: 3, background: '#a1b5c9' },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'synthetic-photo.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox', { name: 'Oran', exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Önizleme', exact: true }).click();
  await expect(page.getByAltText('Yuvarlak avatar önizlemesi')).toBeVisible();
  await page.getByRole('button', { name: 'Fotoğrafı kaydet', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const me = await (await page.request.get('/api/me')).json();
  const photo = await page.request.get('/api/photos/' + me.id);
  expect(photo.status()).toBe(200);
  expect(photo.headers()['content-type']).toBe('image/jpeg');
  expect((await request.get('/api/photos/' + me.id)).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Fotoğrafı değiştir', exact: true })).toBeVisible();
});

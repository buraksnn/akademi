import { notFound, redirect } from 'next/navigation';
import { currentActor, roleHome } from '@/lib/auth/session';
import { metadata } from '@/server/services/management';
import { Shell } from '@/components/layout/shell';
import { adminMenu, teacherMenu, studentMenu } from '@/components/layout/navigation';
import { PanelContent } from '@/components/panel-content';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ panel: string; section?: string[] }>;
}) {
  const { panel, section: parts = [] } = await params;
  if (!['ogrenci', 'ogretmen', 'yonetim'].includes(panel) || parts.length > 1) notFound();
  const actor = await currentActor();
  if (!actor) redirect('/giris');
  const home = roleHome(actor.role);
  if (home !== '/' + panel) redirect(home);
  const section = parts[0] || '';
  const menu =
    actor.role === 'ADMIN' ? adminMenu : actor.role === 'TEACHER' ? teacherMenu : studentMenu;
  if (section !== 'profil' && !menu.some((v) => v[0] === section)) notFound();
  const meta = await metadata(actor);
  return (
    <Shell
      actor={JSON.parse(JSON.stringify(actor))}
      section={section}
      institution={meta.settings.name}
      year={meta.settings.academicYear}
    >
      <PanelContent
        key={section}
        section={section}
        actor={JSON.parse(JSON.stringify(actor))}
        meta={JSON.parse(JSON.stringify(meta))}
      />
    </Shell>
  );
}

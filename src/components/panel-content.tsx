'use client';
import type { CurrentUser, Meta } from './types';
import { Overview } from './overview';
import { UsersPage } from './users';
import { ClassesPage } from './classes';
import { SchedulePage } from './schedule';
import { ExamsPage, ResultsPage } from './exams';
import { AssignmentsPage } from './assignments';
import { AttendancePage } from './attendance';
import { AnnouncementsPage } from './announcements';
import { ProfilePage } from './profile';
import { SettingsPage } from './settings';
export function PanelContent({
  section,
  actor,
  meta,
}: {
  section: string;
  actor: CurrentUser;
  meta: Meta;
}) {
  switch (section) {
    case 'ogrenciler':
      return <UsersPage actor={actor} meta={meta} />;
    case 'ogretmenler':
      return <UsersPage actor={actor} meta={meta} teachers />;
    case 'siniflar':
      return <ClassesPage actor={actor} meta={meta} />;
    case 'ders-programi':
      return <SchedulePage actor={actor} meta={meta} />;
    case 'denemeler':
      return actor.role === 'ADMIN' ? <ExamsPage meta={meta} /> : <ResultsPage />;
    case 'odevler':
      return <AssignmentsPage actor={actor} meta={meta} />;
    case 'yoklama':
    case 'devamsizlik':
      return <AttendancePage actor={actor} />;
    case 'duyurular':
      return <AnnouncementsPage actor={actor} meta={meta} />;
    case 'profil':
      return <ProfilePage />;
    case 'ayarlar':
      return <SettingsPage meta={meta} />;
    default:
      return <Overview actor={actor} />;
  }
}

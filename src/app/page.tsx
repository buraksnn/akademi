import { redirect } from 'next/navigation';
import { currentActor, roleHome } from '@/lib/auth/session';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const actor = await currentActor();
  redirect(actor ? roleHome(actor.role) : '/giris');
}

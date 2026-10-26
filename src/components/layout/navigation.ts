import {
  LayoutDashboard,
  Users,
  UserRound,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileCheck,
  CheckSquare,
  Megaphone,
  Settings,
} from 'lucide-react';
export const studentMenu = [
  ['', 'Genel Bakış', LayoutDashboard],
  ['ders-programi', 'Ders Programım', CalendarDays],
  ['denemeler', 'Deneme Sonuçlarım', ClipboardList],
  ['odevler', 'Ödevlerim', FileCheck],
  ['devamsizlik', 'Devamsızlık', CheckSquare],
  ['duyurular', 'Duyurular', Megaphone],
] as const;
export const teacherMenu = [
  ['', 'Genel Bakış', LayoutDashboard],
  ['ders-programi', 'Ders Programım', CalendarDays],
  ['siniflar', 'Sınıflarım', BookOpen],
  ['ogrenciler', 'Öğrencilerim', Users],
  ['odevler', 'Ödevler', FileCheck],
  ['yoklama', 'Yoklama', CheckSquare],
  ['duyurular', 'Duyurular', Megaphone],
] as const;
export const adminMenu = [
  ['', 'Genel Bakış', LayoutDashboard],
  ['ogrenciler', 'Öğrenciler', Users],
  ['ogretmenler', 'Öğretmenler', UserRound],
  ['siniflar', 'Sınıflar', BookOpen],
  ['ders-programi', 'Ders Programı', CalendarDays],
  ['denemeler', 'Deneme Sınavları', ClipboardList],
  ['odevler', 'Ödevler', FileCheck],
  ['yoklama', 'Yoklama', CheckSquare],
  ['duyurular', 'Duyurular', Megaphone],
  ['ayarlar', 'Kurum Ayarları', Settings],
] as const;

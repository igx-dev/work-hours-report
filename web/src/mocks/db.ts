/**
 * 見本のデータ(テストと、AWS なしで画面を試す「見本モード」で使う)。
 * 本物のデータベースではなく、メモリの中の配列。
 */
import type { Project, Report } from '../api/types';
import { addMonths, currentMonth, todayIso } from '../lib/dates';

export type MockUser = { userId: string; name: string; email: string; roles: ('member' | 'admin')[]; enabled?: boolean };
export type StoredReport = Report & { userId: string };

export type MockDb = { users: MockUser[]; projects: Project[]; reports: StoredReport[] };

export const USERS: MockUser[] = [
  { userId: 'u-admin', name: '管理 花子', email: 'admin@example.com', roles: ['member', 'admin'] },
  { userId: 'u-1', name: '山田 太郎', email: 'yamada@example.com', roles: ['member'] },
  { userId: 'u-2', name: '佐藤 次郎', email: 'sato@example.com', roles: ['member'] },
];

export function emptyDb(): MockDb {
  return { users: USERS.map((u) => ({ ...u, roles: [...u.roles] })), projects: [], reports: [] };
}

/** 見本モード用: プロジェクト3つと、過去3か月分の日報 */
export function sampleDb(now = new Date()): MockDb {
  const db = emptyDb();
  const thisMonth = currentMonth(now);
  db.projects = [
    { projectId: 'p-order', name: '受発注システム改修', plannedHours: 1200, startDate: `${addMonths(thisMonth, -3)}-01`, endDate: `${addMonths(thisMonth, 2)}-28`, status: 'ACTIVE' },
    { projectId: 'p-portal', name: '社内ポータル', plannedHours: 450, startDate: `${addMonths(thisMonth, -2)}-01`, endDate: `${addMonths(thisMonth, 1)}-28`, status: 'ACTIVE' },
    { projectId: 'p-stock', name: '在庫の見える化', plannedHours: 600, startDate: `${addMonths(thisMonth, -1)}-01`, endDate: `${addMonths(thisMonth, 4)}-28`, status: 'ACTIVE' },
  ];
  const today = todayIso(now);
  const start = new Date(`${addMonths(thisMonth, -3)}-01T00:00:00Z`);
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let d = start; d.toISOString().slice(0, 10) < today; d = new Date(d.getTime() + 86400000)) {
    const date = d.toISOString().slice(0, 10);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    for (const user of db.users) {
      const active = db.projects.filter((p) => p.startDate <= date);
      const main = active[Math.floor(rand() * active.length)];
      const sub = active.find((p) => p !== main);
      const mainHours = sub && rand() < 0.5 ? 5 : 8;
      db.reports.push(report(user.userId, date, main, mainHours, rand() < 0.5 ? '画面設計' : ''));
      if (mainHours < 8 && sub) db.reports.push(report(user.userId, date, sub, 8 - mainHours, '打ち合わせ'));
    }
  }
  return db;
}

function report(userId: string, date: string, project: Project, hours: number, note: string): StoredReport {
  return {
    userId, date, projectId: project.projectId, projectName: project.name, hours, note,
    updatedAt: `${date}T18:00:00+09:00`,
  };
}

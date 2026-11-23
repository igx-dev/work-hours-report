/**
 * 見本の API(MSW)。本物の API と同じパスで、同じ形のデータとエラーを返す。
 * 業務ルールは本物(バックエンド)と同じものを、簡単に再現する。
 */
import { http, HttpResponse } from 'msw';
import type { Project, ProjectMonth } from '../api/types';
import { validateHours } from '../lib/hours';
import type { MockDb } from './db';

const err = (status: number, code: string, message: string, details?: object) =>
  HttpResponse.json({ code, message, ...(details ? { details } : {}) }, { status });

export function createHandlers(db: MockDb, base = '/api') {
  const me = (request: Request) => {
    const email = request.headers.get('Authorization')?.replace('Bearer ', '');
    return db.users.find((u) => u.email === email) ?? null;
  };
  const sum = (xs: { hours: number }[]) => xs.reduce((a, r) => a + r.hours, 0);
  const strip = ({ userId: _u, ...r }: MockDb['reports'][number]) => r;

  return [
    http.all(`${base}/*`, ({ request }) => {
      if (!me(request)) return err(401, 'UNAUTHORIZED', 'ログインしてください');
      const path = new URL(request.url).pathname.replace(base, '');
      if (path.startsWith('/admin') && !me(request)!.roles.includes('admin')) {
        return err(403, 'FORBIDDEN', '管理者だけが使えます');
      }
      return undefined; // 次のハンドラーへ
    }),

    http.get(`${base}/me`, ({ request }) => {
      const u = me(request)!;
      return HttpResponse.json({ userId: u.userId, name: u.name, roles: u.roles });
    }),

    http.get(`${base}/me/reports`, ({ request }) => {
      const month = new URL(request.url).searchParams.get('month') ?? '';
      const items = db.reports
        .filter((r) => r.userId === me(request)!.userId && r.date.startsWith(month))
        .sort((a, b) => (a.date + a.projectId).localeCompare(b.date + b.projectId))
        .map(strip);
      return HttpResponse.json({ month, items });
    }),

    http.put(`${base}/me/reports/:date/:projectId`, async ({ request, params }) => {
      const user = me(request)!;
      const { date, projectId } = params as { date: string; projectId: string };
      const body = (await request.json()) as { hours: number; note?: string };
      const invalid = validateHours(body.hours);
      if (invalid) return err(400, 'VALIDATION_ERROR', invalid);
      const project = db.projects.find((p) => p.projectId === projectId);
      if (!project) return err(404, 'NOT_FOUND', 'プロジェクトが見つかりません');
      if (project.status !== 'ACTIVE') return err(422, 'PROJECT_CLOSED', '終了したプロジェクトには登録できません');
      const others = db.reports.filter((r) => r.userId === user.userId && r.date === date && r.projectId !== projectId);
      const total = sum(others) + body.hours;
      if (total > 24) return err(422, 'DAILY_LIMIT_EXCEEDED', '1日の合計が24時間を超えます', { date, totalHours: total });
      const saved = {
        userId: user.userId, date, projectId, projectName: project.name, hours: body.hours,
        note: body.note ?? '', updatedAt: new Date().toISOString(),
      };
      db.reports = [
        ...db.reports.filter((r) => !(r.userId === user.userId && r.date === date && r.projectId === projectId)),
        saved,
      ];
      return HttpResponse.json(strip(saved));
    }),

    http.delete(`${base}/me/reports/:date/:projectId`, ({ request, params }) => {
      const user = me(request)!;
      const before = db.reports.length;
      db.reports = db.reports.filter((r) => !(r.userId === user.userId && r.date === params.date && r.projectId === params.projectId));
      if (db.reports.length === before) return err(404, 'NOT_FOUND', '日報が見つかりません');
      return new HttpResponse(null, { status: 204 });
    }),

    http.get(`${base}/projects`, ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      return HttpResponse.json({ items: db.projects.filter((p) => !status || p.status === status) });
    }),

    http.post(`${base}/admin/projects`, async ({ request }) => {
      const body = (await request.json()) as Omit<Project, 'projectId' | 'status'>;
      const project: Project = { ...body, projectId: `p-${Math.random().toString(36).slice(2, 8)}`, status: 'ACTIVE' };
      db.projects.push(project);
      return HttpResponse.json(project, { status: 201 });
    }),

    http.patch(`${base}/admin/projects/:projectId`, async ({ request, params }) => {
      const project = db.projects.find((p) => p.projectId === params.projectId);
      if (!project) return err(404, 'NOT_FOUND', 'プロジェクトが見つかりません');
      Object.assign(project, await request.json());
      return HttpResponse.json(project);
    }),

    http.get(`${base}/admin/dashboard/summary`, ({ request }) => {
      const month = new URL(request.url).searchParams.get('month') ?? '';
      const items = db.projects.map((p) => {
        const rs = db.reports.filter((r) => r.projectId === p.projectId && r.date <= `${month}-31`);
        return {
          projectId: p.projectId, projectName: p.name, plannedHours: p.plannedHours,
          actualHoursToDate: sum(rs), monthHours: sum(rs.filter((r) => r.date.startsWith(month))),
        };
      });
      return HttpResponse.json({ month, items });
    }),

    http.get(`${base}/admin/dashboard/projects/:projectId`, ({ request, params }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get('from')!;
      const to = url.searchParams.get('to')!;
      const project = db.projects.find((p) => p.projectId === params.projectId);
      if (!project) return err(404, 'NOT_FOUND', 'プロジェクトが見つかりません');
      const months: ProjectMonth[] = [];
      for (let m = from; m <= to; m = nextMonth(m)) {
        const rs = db.reports.filter((r) => r.projectId === project.projectId && r.date.startsWith(m));
        const byUser = db.users
          .map((u) => ({ userId: u.userId, userName: u.name, hours: sum(rs.filter((r) => r.userId === u.userId)) }))
          .filter((u) => u.hours > 0);
        months.push({ month: m, totalHours: sum(rs), byUser });
      }
      return HttpResponse.json({ project, months });
    }),

    http.get(`${base}/admin/exports/reports.csv`, ({ request }) => {
      const month = new URL(request.url).searchParams.get('month') ?? '';
      const lines = db.reports
        .filter((r) => r.date.startsWith(month))
        .map((r) => [r.date, r.projectName, db.users.find((u) => u.userId === r.userId)?.name, r.hours, r.note].join(','));
      return new HttpResponse(`\ufeff日付,プロジェクト,メンバー,時間,メモ\r\n${lines.join('\r\n')}\r\n`, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }),
  ];
}

function nextMonth(m: string) {
  const [y, mm] = m.split('-').map(Number);
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
}

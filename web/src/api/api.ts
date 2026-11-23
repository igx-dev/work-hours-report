/**
 * API の呼び出し(RTK Query)。取ってきたデータはキャッシュされ、
 * 日報を保存したら tags で「その月の一覧」と「ダッシュボード」を取り直す。
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Auth } from '../lib/auth';
import type {
  MonthReports,
  Project,
  ManagedUser,
  ProjectDashboard,
  ProjectInput,
  ProjectStatus,
  Report,
  ReportInput,
  Summary,
  User,
} from './types';

export type ThunkExtra = { auth: Auth; apiBaseUrl: string };

const rawBaseQuery = (baseUrl: string) =>
  fetchBaseQuery({
    baseUrl,
    prepareHeaders: async (headers, { extra }) => {
      const token = await (extra as ThunkExtra).auth.idToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  });

export const api = createApi({
  reducerPath: 'api',
  baseQuery: (args, store, extraOptions) =>
    rawBaseQuery((store.extra as ThunkExtra).apiBaseUrl)(args, store, extraOptions),
  tagTypes: ['Me', 'Reports', 'Projects', 'Dashboard', 'Users'],
  endpoints: (b) => ({
    getMe: b.query<User, void>({ query: () => '/me', providesTags: ['Me'] }),

    listMyReports: b.query<MonthReports, string>({
      query: (month) => ({ url: '/me/reports', params: { month } }),
      providesTags: (_r, _e, month) => [{ type: 'Reports', id: month }],
    }),
    putMyReport: b.mutation<Report, { date: string; projectId: string } & ReportInput>({
      query: ({ date, projectId, ...body }) => ({
        url: `/me/reports/${date}/${projectId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_r, _e, { date }) => [{ type: 'Reports', id: date.slice(0, 7) }, 'Dashboard'],
    }),
    deleteMyReport: b.mutation<void, { date: string; projectId: string }>({
      query: ({ date, projectId }) => ({ url: `/me/reports/${date}/${projectId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { date }) => [{ type: 'Reports', id: date.slice(0, 7) }, 'Dashboard'],
    }),

    listProjects: b.query<{ items: Project[] }, ProjectStatus | void>({
      query: (status) => ({ url: '/projects', params: status ? { status } : undefined }),
      providesTags: ['Projects'],
    }),
    createProject: b.mutation<Project, ProjectInput>({
      query: (body) => ({ url: '/admin/projects', method: 'POST', body }),
      invalidatesTags: ['Projects', 'Dashboard'],
    }),
    updateProject: b.mutation<Project, { projectId: string } & Partial<Project>>({
      query: ({ projectId, ...body }) => ({ url: `/admin/projects/${projectId}`, method: 'PATCH', body }),
      invalidatesTags: ['Projects', 'Dashboard'],
    }),

    listUsers: b.query<{ items: ManagedUser[] }, void>({ query: () => '/admin/users', providesTags: ['Users'] }),
    createUser: b.mutation<ManagedUser, Pick<ManagedUser, 'name' | 'email' | 'roles'>>({
      query: (body) => ({ url: '/admin/users', method: 'POST', body }),
      invalidatesTags: ['Users'],
    }),
    updateUser: b.mutation<ManagedUser, { userId: string } & Partial<Pick<ManagedUser, 'name' | 'roles' | 'enabled'>>>({
      query: ({ userId, ...body }) => ({ url: `/admin/users/${userId}`, method: 'PATCH', body }),
      invalidatesTags: ['Users', 'Dashboard', 'Me'],
    }),

    getSummary: b.query<Summary, string>({
      query: (month) => ({ url: '/admin/dashboard/summary', params: { month } }),
      providesTags: ['Dashboard'],
    }),
    getProjectDashboard: b.query<ProjectDashboard, { projectId: string; from: string; to: string }>({
      query: ({ projectId, from, to }) => ({
        url: `/admin/dashboard/projects/${projectId}`,
        params: { from, to },
      }),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useListMyReportsQuery,
  usePutMyReportMutation,
  useDeleteMyReportMutation,
  useListProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useGetSummaryQuery,
  useGetProjectDashboardQuery,
} = api;

/** RTK Query のエラーから、画面に出す一文を取り出す。 */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  const e = error as { status?: number | string; data?: { message?: string } };
  if (e.data?.message) return e.data.message;
  if (e.status === 401) return 'ログインし直してください';
  return '通信に失敗しました。時間をおいてもう一度試してください';
}

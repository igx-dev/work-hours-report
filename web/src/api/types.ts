/** openapi.yaml から生成した型(schema.d.ts)に、短い名前を付ける。 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type Report = Schemas['Report'];
export type ReportInput = Schemas['ReportInput'];
export type Project = Schemas['Project'];
export type ProjectInput = Schemas['ProjectInput'];
export type ProjectStatus = Schemas['ProjectStatus'];
export type User = Schemas['User'];
export type ApiError = Schemas['Error'];

export type MonthReports = { month: string; items: Report[] };
export type SummaryItem = {
  projectId: string;
  projectName: string;
  plannedHours: number;
  actualHoursToDate: number;
  monthHours: number;
};
export type Summary = { month: string; items: SummaryItem[] };
export type ProjectMonth = {
  month: string;
  totalHours: number;
  byUser: { userId: string; userName: string; hours: number }[];
};
export type ProjectDashboard = { project: Project; months: ProjectMonth[] };

export type Role = 'member' | 'admin';
export type ManagedUser = { userId: string; name: string; email: string; roles: Role[]; enabled: boolean };
export type Settings = {
  slackConfigured: boolean;
  slackHint: string | null;
  remindEnabled: boolean;
  weeklyReportEnabled: boolean;
};

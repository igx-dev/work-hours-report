/**
 * 1日分の日報の編集(「今日の日報」と、「自分の日報」で日付を選んだ時に使う)。
 * 左: 登録済みの一覧と「新規追加」。押したものを右で編集する。
 * 右: 新規追加(まだ登録していないプロジェクトから選ぶ)か、選んだ日報の編集。
 */
import { useState, type FormEvent } from 'react';
import {
  errorMessage,
  useDeleteMyReportMutation,
  useListMyReportsQuery,
  useListProjectsQuery,
  usePutMyReportMutation,
} from '../../api/api';
import type { Report } from '../../api/types';
import { formatDay } from '../../lib/dates';
import { stepHours, validateHours } from '../../lib/hours';

const DEFAULT_HOURS = '8';
type Mode = { kind: 'new' } | { kind: 'edit'; report: Report };

export function DayEditor({ date }: { date: string }) {
  const { data: monthData } = useListMyReportsQuery(date.slice(0, 7));
  const { data: projects } = useListProjectsQuery('ACTIVE');
  const [putReport, putState] = usePutMyReportMutation();
  const [deleteReport, deleteState] = useDeleteMyReportMutation();

  const [mode, setMode] = useState<Mode>({ kind: 'new' });
  const [projectId, setProjectId] = useState('');
  const [hoursText, setHoursText] = useState(DEFAULT_HOURS);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const reports = (monthData?.items ?? []).filter((r) => r.date === date);
  const total = reports.reduce((sum, r) => sum + r.hours, 0);
  const registered = new Set(reports.map((r) => r.projectId));
  const unregistered = (projects?.items ?? []).filter((p) => !registered.has(p.projectId));
  const selectedProject = unregistered.some((p) => p.projectId === projectId)
    ? projectId
    : (unregistered[0]?.projectId ?? '');

  function startNew() {
    setMode({ kind: 'new' });
    setProjectId('');
    setHoursText(DEFAULT_HOURS);
    setNote('');
    setMessage(null);
  }

  function startEdit(report: Report) {
    setMode({ kind: 'edit', report });
    setHoursText(String(report.hours));
    setNote(report.note ?? '');
    setMessage(null);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const hours = Number(hoursText);
    const invalid = validateHours(hours);
    if (invalid) return setMessage({ kind: 'error', text: invalid });
    const target = mode.kind === 'edit' ? mode.report.projectId : selectedProject;
    const result = await putReport({ date, projectId: target, hours, note });
    if ('error' in result) return setMessage({ kind: 'error', text: errorMessage(result.error)! });
    startEdit(result.data); // 保存したものを、そのまま編集できる状態にする
    setMessage({ kind: 'info', text: mode.kind === 'edit' ? '保存しました' : '追加しました' });
  }

  async function onDelete() {
    if (mode.kind !== 'edit') return;
    const result = await deleteReport({ date, projectId: mode.report.projectId });
    if ('error' in result) return setMessage({ kind: 'error', text: errorMessage(result.error)! });
    startNew();
    setMessage({ kind: 'info', text: '削除しました' });
  }

  const editingId = mode.kind === 'edit' ? mode.report.projectId : null;
  const canAdd = mode.kind === 'edit' || unregistered.length > 0;
  const title = mode.kind === 'edit' ? '編集' : '新規追加';

  return (
    <div className="day-editor">
      <section className="card">
        <div className="card-head">
          <h2>{formatDay(date)}</h2>
          <span className="total">合計 {total} 時間</span>
        </div>
        {reports.length === 0 ? (
          <p className="muted">まだ登録がありません</p>
        ) : (
          <ul className="report-list" aria-label="登録済みの日報">
            {reports.map((r) => (
              <li key={r.projectId}>
                <button
                  type="button"
                  className={`report-item${editingId === r.projectId ? ' selected' : ''}`}
                  aria-pressed={editingId === r.projectId}
                  onClick={() => startEdit(r)}
                >
                  <span className="name">{r.projectName}</span>
                  <span className="hours">{r.hours} 時間</span>
                  {r.note && <span className="note">{r.note}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="secondary wide" onClick={startNew} aria-pressed={mode.kind === 'new'}>
          ＋ 新規追加
        </button>
      </section>

      <form className="card" onSubmit={onSave} noValidate aria-labelledby="editor-title">
        <h2 id="editor-title">{title}</h2>

        {mode.kind === 'edit' ? (
          <>
            <p className="field-label">プロジェクト</p>
            <p className="fixed-value">{mode.report.projectName}</p>
          </>
        ) : unregistered.length === 0 ? (
          <p className="muted">進行中のプロジェクトは、すべて登録済みです</p>
        ) : (
          <>
            <label htmlFor="project">プロジェクト</label>
            <select id="project" value={selectedProject} onChange={(e) => setProjectId(e.target.value)}>
              {unregistered.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}

        {canAdd && (
          <>
            <label htmlFor="hours">時間</label>
            <div className="stepper">
              <button
                type="button"
                aria-label="15分減らす"
                onClick={() => setHoursText(String(stepHours(Number(hoursText) || 0.25, -1)))}
              >
                −
              </button>
              <input
                id="hours"
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0.25"
                max="24"
                value={hoursText}
                onChange={(e) => setHoursText(e.target.value)}
              />
              <button
                type="button"
                aria-label="15分増やす"
                onClick={() => setHoursText(String(stepHours(Number(hoursText) || 0, 1)))}
              >
                ＋
              </button>
            </div>

            <label htmlFor="note">メモ</label>
            <input id="note" type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
            {message.text}
          </p>
        )}

        {canAdd && (
          <button type="submit" className="primary wide" disabled={putState.isLoading}>
            {mode.kind === 'edit' ? '保存' : '追加'}
          </button>
        )}
        {mode.kind === 'edit' && (
          <button type="button" className="link danger delete" onClick={onDelete} disabled={deleteState.isLoading}>
            この日報を削除
          </button>
        )}
      </form>
    </div>
  );
}

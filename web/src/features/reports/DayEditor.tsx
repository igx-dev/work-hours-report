/**
 * 1日分の日報の編集(「今日」の画面と、「自分の日報」で日付を選んだ時に使う)。
 * 一覧 + 入力欄。保存すると RTK Query が一覧を取り直す。
 */
import { useState, type FormEvent } from 'react';
import {
  errorMessage,
  useDeleteMyReportMutation,
  useListMyReportsQuery,
  useListProjectsQuery,
  usePutMyReportMutation,
} from '../../api/api';
import { formatDay } from '../../lib/dates';
import { stepHours, validateHours } from '../../lib/hours';

export function DayEditor({ date }: { date: string }) {
  const month = date.slice(0, 7);
  const { data: monthData } = useListMyReportsQuery(month);
  const { data: projects } = useListProjectsQuery('ACTIVE');
  const [putReport, putState] = usePutMyReportMutation();
  const [deleteReport] = useDeleteMyReportMutation();

  const [projectId, setProjectId] = useState('');
  const [hoursText, setHoursText] = useState('8');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const reports = (monthData?.items ?? []).filter((r) => r.date === date);
  const total = reports.reduce((sum, r) => sum + r.hours, 0);
  const selected = projectId || projects?.items[0]?.projectId || '';

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const hours = Number(hoursText);
    const invalid = validateHours(hours);
    if (invalid) return setMessage({ kind: 'error', text: invalid });
    const result = await putReport({ date, projectId: selected, hours, note });
    if ('error' in result) return setMessage({ kind: 'error', text: errorMessage(result.error)! });
    setMessage({ kind: 'info', text: '保存しました' });
    setNote('');
  }

  return (
    <div className="day-editor">
      <section className="card">
        <div className="card-head">
          <h2>{formatDay(date)} の日報</h2>
          <span className="total">合計 {total} 時間</span>
        </div>
        {reports.length === 0 ? (
          <p className="muted">まだ登録がありません</p>
        ) : (
          <ul className="report-list" aria-label="今日の日報">
            {reports.map((r) => (
              <li key={r.projectId}>
                <span className="name">{r.projectName}</span>
                <span className="hours">{r.hours} 時間</span>
                {r.note && <span className="note">{r.note}</span>}
                <button
                  type="button"
                  className="link danger"
                  aria-label={`${r.projectName} を削除`}
                  onClick={() => deleteReport({ date, projectId: r.projectId })}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card" onSubmit={onSave} noValidate>
        <h2>登録・上書き</h2>
        <label htmlFor="project">プロジェクト</label>
        <select id="project" value={selected} onChange={(e) => setProjectId(e.target.value)}>
          {projects?.items.map((p) => (
            <option key={p.projectId} value={p.projectId}>
              {p.name}
            </option>
          ))}
        </select>

        <label htmlFor="hours">時間</label>
        <div className="stepper">
          <button type="button" aria-label="15分減らす" onClick={() => setHoursText(String(stepHours(Number(hoursText) || 0.25, -1)))}>
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
          <button type="button" aria-label="15分増やす" onClick={() => setHoursText(String(stepHours(Number(hoursText) || 0, 1)))}>
            ＋
          </button>
        </div>

        <label htmlFor="note">メモ</label>
        <input id="note" type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
            {message.text}
          </p>
        )}
        <button type="submit" className="primary wide" disabled={putState.isLoading || !selected}>
          保存
        </button>
        <p className="hint">同じプロジェクトでもう一度保存すると、上書きになります。</p>
      </form>
    </div>
  );
}

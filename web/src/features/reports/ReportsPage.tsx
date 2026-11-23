/**
 * 自分の日報(月の一覧)。その月の全部の日を並べ、日報がない日は「未入力」と出す。
 * どの日も、押すと下にその日の編集が出る(日報入力と同じ部品)。
 */
import { useEffect, useRef, useState } from 'react';
import { errorMessage, useListMyReportsQuery } from '../../api/api';
import type { Report } from '../../api/types';
import { useAppSelector } from '../../app/store';
import { MonthPicker } from '../../components/MonthPicker';
import { daysInMonth, formatDay, isWeekend } from '../../lib/dates';
import { DayEditor } from './DayEditor';

export function ReportsPage() {
  const month = useAppSelector((s) => s.ui.month);
  const { data, isLoading, error } = useListMyReportsQuery(month);
  const [editing, setEditing] = useState<string | null>(null);
  const editorRef = useRef<HTMLElement>(null);

  // 日付を押したら、下に出た編集の欄まで動かす
  useEffect(() => {
    if (editing) editorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  const byDate = new Map<string, Report[]>();
  for (const r of data?.items ?? []) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  const total = (data?.items ?? []).reduce((sum, r) => sum + r.hours, 0);

  return (
    <>
      <h1>自分の日報</h1>
      <div className="toolbar">
        <MonthPicker />
        <span className="total">月の合計 {total} 時間</span>
      </div>
      {isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : error ? (
        <p role="alert" className="error">
          {errorMessage(error)}
        </p>
      ) : (
        <div className="table-scroll">
          <table aria-label="日報の一覧">
            <thead>
              <tr>
                <th>日付</th>
                <th>内容</th>
                <th className="num">合計</th>
              </tr>
            </thead>
            <tbody>
              {daysInMonth(month).map((date) => {
                const reports = byDate.get(date) ?? [];
                const classes = [isWeekend(date) && 'weekend', editing === date && 'selected'].filter(Boolean).join(' ');
                return (
                  <tr key={date} className={classes || undefined}>
                    <td>
                      <button type="button" className="link" onClick={() => setEditing(date)}>
                        {formatDay(date)}
                      </button>
                    </td>
                    <td>
                      {reports.length > 0 ? (
                        reports.map((r) => `${r.projectName} ${r.hours}h`).join(' / ')
                      ) : (
                        <span className="muted">未入力</span>
                      )}
                    </td>
                    <td className="num">{reports.length > 0 ? reports.reduce((s, r) => s + r.hours, 0) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <section className="editing" ref={editorRef}>
          <button type="button" className="link" onClick={() => setEditing(null)}>
            閉じる
          </button>
          <DayEditor key={editing} date={editing} />
        </section>
      )}
    </>
  );
}

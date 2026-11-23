/** 自分の日報(月の一覧)。日付を押すと、その日を編集できる。 */
import { useState } from 'react';
import { useListMyReportsQuery } from '../../api/api';
import type { Report } from '../../api/types';
import { useAppSelector } from '../../app/store';
import { MonthPicker } from '../../components/MonthPicker';
import { formatDay } from '../../lib/dates';
import { DayEditor } from './DayEditor';

export function ReportsPage() {
  const month = useAppSelector((s) => s.ui.month);
  const { data, isLoading } = useListMyReportsQuery(month);
  const [editing, setEditing] = useState<string | null>(null);

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
      ) : byDate.size === 0 ? (
        <p className="muted">この月の日報はありません</p>
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
              {[...byDate.entries()].map(([date, reports]) => (
                <tr key={date}>
                  <td>
                    <button type="button" className="link" onClick={() => setEditing(date)}>
                      {formatDay(date)}
                    </button>
                  </td>
                  <td>{reports.map((r) => `${r.projectName} ${r.hours}h`).join(' / ')}</td>
                  <td className="num">{reports.reduce((s, r) => s + r.hours, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <section className="editing">
          <button type="button" className="link" onClick={() => setEditing(null)}>
            閉じる
          </button>
          <DayEditor key={editing} date={editing} />
        </section>
      )}
    </>
  );
}

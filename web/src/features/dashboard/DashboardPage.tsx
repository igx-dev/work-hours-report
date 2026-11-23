/** ダッシュボード: 全プロジェクトの予定と実績(累計)と、その月の時間。 */
import { Link } from 'react-router';
import { errorMessage, useGetSummaryQuery } from '../../api/api';
import { useAppSelector } from '../../app/store';
import { Chart, COLORS } from '../../components/Chart';
import { MonthPicker } from '../../components/MonthPicker';
import { monthLabel } from '../../lib/dates';

const rate = (actual: number, planned: number) => (planned ? Math.round((actual / planned) * 100) : 0);

export function DashboardPage() {
  const month = useAppSelector((s) => s.ui.month);
  const { data, isLoading, error } = useGetSummaryQuery(month);
  const items = data?.items ?? [];

  return (
    <>
      <h1>ダッシュボード</h1>
      <div className="toolbar">
        <MonthPicker />
        <span className="muted">{monthLabel(month)}末までの累計</span>
      </div>
      {isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : error ? (
        <p role="alert" className="error">
          {errorMessage(error)}
        </p>
      ) : items.length === 0 ? (
        <p className="muted">プロジェクトがありません</p>
      ) : (
        <>
          <section className="card">
            <Chart
              options={{
                chart: { type: 'bar', height: 80 + items.length * 56 },
                title: { text: '予定と実績(累計)' },
                xAxis: { categories: items.map((i) => i.projectName) },
                yAxis: { title: { text: '時間' } },
                plotOptions: { bar: { grouping: false, borderWidth: 0 } },
                tooltip: { shared: true, valueSuffix: ' 時間' },
                series: [
                  { type: 'bar', name: '予定', data: items.map((i) => i.plannedHours), color: COLORS.planned, pointPadding: 0.1 },
                  {
                    type: 'bar',
                    name: '実績',
                    pointPadding: 0.3,
                    data: items.map((i) => ({
                      y: i.actualHoursToDate,
                      color: i.actualHoursToDate > i.plannedHours ? COLORS.over : COLORS.actual,
                    })),
                  },
                ],
              }}
            />
          </section>
          <div className="table-scroll">
            <table aria-label="予定と実績">
              <thead>
                <tr>
                  <th>プロジェクト</th>
                  <th className="num">予定</th>
                  <th className="num">実績(累計)</th>
                  <th className="num">消化率</th>
                  <th className="num">この月</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.projectId}>
                    <td>
                      <Link to={`/projects/${i.projectId}`}>{i.projectName}</Link>
                      {i.actualHoursToDate > i.plannedHours && <span className="badge over">予定超過</span>}
                    </td>
                    <td className="num">{i.plannedHours}</td>
                    <td className="num">{i.actualHoursToDate}</td>
                    <td className="num">{rate(i.actualHoursToDate, i.plannedHours)}%</td>
                    <td className="num">{i.monthHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

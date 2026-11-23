/** プロジェクト詳細: 月ごとの累計の推移(予定の線つき)と、メンバー別の内訳。 */
import { Link, useParams } from 'react-router';
import { useGetProjectDashboardQuery } from '../../api/api';
import { Chart, COLORS } from '../../components/Chart';
import { addMonths, currentMonth, monthLabel } from '../../lib/dates';

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const to = currentMonth();
  const from = addMonths(to, -5);
  const { data, isLoading, error } = useGetProjectDashboardQuery({ projectId: id, from, to });

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (error || !data) return <p className="error">プロジェクトが見つかりません</p>;

  const { project, months } = data;
  const labels = months.map((m) => monthLabel(m.month).replace(/^\d+年/, ''));
  const cumulative = months.map((_, i) => months.slice(0, i + 1).reduce((sum, m) => sum + m.totalHours, 0));
  const running = cumulative.at(-1) ?? 0;
  const users = [...new Map(months.flatMap((m) => m.byUser).map((u) => [u.userId, u.userName])).entries()];
  const hoursOf = (userId: string, month: (typeof months)[number]) =>
    month.byUser.find((u) => u.userId === userId)?.hours ?? 0;

  return (
    <>
      <p>
        <Link to="/dashboard">‹ ダッシュボード</Link>
      </p>
      <h1>{project.name}</h1>
      <p className="muted">
        予定 {project.plannedHours} 時間 / 期間 {project.startDate} 〜 {project.endDate}(直近6か月を表示)
      </p>
      <div className="grid-2">
        <section className="card">
          <Chart
            options={{
              title: { text: '累計の推移' },
              xAxis: { categories: labels },
              yAxis: {
                title: { text: '時間' },
                max: Math.max(project.plannedHours, running) * 1.1,
                plotLines: [{ value: project.plannedHours, color: COLORS.over, dashStyle: 'Dash', width: 2, label: { text: '予定' } }],
              },
              tooltip: { valueSuffix: ' 時間' },
              legend: { enabled: false },
              series: [{ type: 'line', name: '累計', data: cumulative, color: COLORS.actual }],
            }}
          />
        </section>
        <section className="card">
          <Chart
            options={{
              chart: { type: 'column' },
              title: { text: 'メンバー別の内訳' },
              xAxis: { categories: labels },
              yAxis: { title: { text: '時間' }, stackLabels: { enabled: true } },
              plotOptions: { column: { stacking: 'normal', borderWidth: 0 } },
              tooltip: { valueSuffix: ' 時間' },
              series: users.map(([userId, name]) => ({
                type: 'column' as const,
                name,
                data: months.map((m) => hoursOf(userId, m)),
              })),
            }}
          />
        </section>
      </div>
      <div className="table-scroll">
        <table aria-label="メンバー別の内訳">
          <thead>
            <tr>
              <th>メンバー</th>
              {labels.map((l) => (
                <th key={l} className="num">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(([userId, name]) => (
              <tr key={userId}>
                <td>{name}</td>
                {months.map((m) => (
                  <td key={m.month} className="num">
                    {hoursOf(userId, m)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="sum">
              <td>合計</td>
              {months.map((m) => (
                <td key={m.month} className="num">
                  {m.totalHours}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

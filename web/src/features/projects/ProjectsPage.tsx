/** プロジェクト管理(admin): 一覧、登録、終了。 */
import { useState, type FormEvent } from 'react';
import { errorMessage, useCreateProjectMutation, useListProjectsQuery, useUpdateProjectMutation } from '../../api/api';

const EMPTY = { name: '', plannedHours: '100', startDate: '', endDate: '' };

export function ProjectsPage() {
  const { data } = useListProjectsQuery();
  const [create, createState] = useCreateProjectMutation();
  const [update] = useUpdateProjectMutation();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const plannedHours = Number(form.plannedHours);
    if (!form.name.trim()) return setError('名前を入れてください');
    if (!form.startDate || !form.endDate) return setError('開始日と終了日を入れてください');
    if (form.endDate < form.startDate) return setError('終了日は開始日より後にしてください');
    if (Number.isNaN(plannedHours) || plannedHours < 0) return setError('予定工数は 0 以上の数字で入れてください');
    const result = await create({ name: form.name.trim(), plannedHours, startDate: form.startDate, endDate: form.endDate });
    if ('error' in result) return setError(errorMessage(result.error));
    setError(null);
    setForm(EMPTY);
  }

  return (
    <>
      <h1>プロジェクト管理</h1>
      <div className="grid-2 wide-left">
        <div className="table-scroll">
          <table aria-label="プロジェクトの一覧">
            <thead>
              <tr>
                <th>名前</th>
                <th className="num">予定</th>
                <th>期間</th>
                <th>状態</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p) => (
                <tr key={p.projectId}>
                  <td>{p.name}</td>
                  <td className="num">{p.plannedHours}</td>
                  <td>
                    {p.startDate} 〜 {p.endDate}
                  </td>
                  <td>{p.status === 'ACTIVE' ? <span className="badge">進行中</span> : <span className="badge closed">終了</span>}</td>
                  <td>
                    {p.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="link"
                        aria-label={`${p.name} を終了にする`}
                        onClick={() => update({ projectId: p.projectId, status: 'CLOSED' })}
                      >
                        終了にする
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="card" onSubmit={onSubmit} noValidate>
          <h2>登録</h2>
          <label htmlFor="p-name">名前</label>
          <input id="p-name" value={form.name} maxLength={100} onChange={set('name')} />
          <label htmlFor="p-hours">予定工数(時間)</label>
          <input id="p-hours" type="number" min="0" step="0.25" value={form.plannedHours} onChange={set('plannedHours')} />
          <label htmlFor="p-start">開始日</label>
          <input id="p-start" type="date" value={form.startDate} onChange={set('startDate')} />
          <label htmlFor="p-end">終了日</label>
          <input id="p-end" type="date" value={form.endDate} onChange={set('endDate')} />
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="primary wide" disabled={createState.isLoading}>
            登録
          </button>
        </form>
      </div>
    </>
  );
}

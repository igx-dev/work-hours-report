/**
 * プロジェクト管理(admin)。日報の入力と同じ形にそろえる。
 * 左: プロジェクトの一覧と「新規追加」。押したものを右で編集する。
 * 右: 新規追加か、選んだプロジェクトの編集(名前、予定工数、期間、状態)。
 */
import { useState, type FormEvent } from 'react';
import { errorMessage, useCreateProjectMutation, useListProjectsQuery, useUpdateProjectMutation } from '../../api/api';
import type { Project, ProjectStatus } from '../../api/types';

type Form = { name: string; plannedHours: string; startDate: string; endDate: string; status: ProjectStatus };
const EMPTY: Form = { name: '', plannedHours: '100', startDate: '', endDate: '', status: 'ACTIVE' };
type Mode = { kind: 'new' } | { kind: 'edit'; projectId: string };

const toForm = (p: Project): Form => ({
  name: p.name,
  plannedHours: String(p.plannedHours),
  startDate: p.startDate,
  endDate: p.endDate,
  status: p.status,
});

function validate(form: Form): string | null {
  const planned = Number(form.plannedHours);
  if (!form.name.trim()) return '名前を入れてください';
  if (!form.startDate || !form.endDate) return '開始日と終了日を入れてください';
  if (form.endDate < form.startDate) return '終了日は開始日より後にしてください';
  if (form.plannedHours === '' || Number.isNaN(planned) || planned < 0) return '予定工数は 0 以上の数字で入れてください';
  return null;
}

export function ProjectsPage() {
  const { data } = useListProjectsQuery();
  const [create, createState] = useCreateProjectMutation();
  const [update, updateState] = useUpdateProjectMutation();
  const [mode, setMode] = useState<Mode>({ kind: 'new' });
  const [form, setForm] = useState<Form>(EMPTY);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  function startNew() {
    setMode({ kind: 'new' });
    setForm(EMPTY);
    setMessage(null);
  }

  function startEdit(p: Project) {
    setMode({ kind: 'edit', projectId: p.projectId });
    setForm(toForm(p));
    setMessage(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validate(form);
    if (invalid) return setMessage({ kind: 'error', text: invalid });
    const body = {
      name: form.name.trim(),
      plannedHours: Number(form.plannedHours),
      startDate: form.startDate,
      endDate: form.endDate,
    };
    const result =
      mode.kind === 'edit'
        ? await update({ projectId: mode.projectId, ...body, status: form.status })
        : await create(body);
    if ('error' in result) return setMessage({ kind: 'error', text: errorMessage(result.error)! });
    startEdit(result.data); // 保存したものを、そのまま編集できる状態にする
    setMessage({ kind: 'info', text: mode.kind === 'edit' ? '保存しました' : '追加しました' });
  }

  const editingId = mode.kind === 'edit' ? mode.projectId : null;
  const title = mode.kind === 'edit' ? '編集' : '新規追加';

  return (
    <>
      <h1>プロジェクト管理</h1>
      <div className="day-editor">
        <section className="card">
          {data && data.items.length === 0 ? (
            <p className="muted">まだプロジェクトがありません</p>
          ) : (
            <ul className="report-list" aria-label="プロジェクトの一覧">
              {data?.items.map((p) => (
                <li key={p.projectId}>
                  <button
                    type="button"
                    className={`report-item${editingId === p.projectId ? ' selected' : ''}`}
                    aria-pressed={editingId === p.projectId}
                    onClick={() => startEdit(p)}
                  >
                    <span className="name">
                      {p.name}
                      {p.status === 'ACTIVE' ? <span className="badge">進行中</span> : <span className="badge closed">終了</span>}
                    </span>
                    <span className="hours">予定 {p.plannedHours} 時間</span>
                    <span className="note">
                      {p.startDate} 〜 {p.endDate}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="secondary wide" onClick={startNew} aria-pressed={mode.kind === 'new'}>
            ＋ 新規追加
          </button>
        </section>

        <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="project-form-title">
          <h2 id="project-form-title">{title}</h2>
          <label htmlFor="p-name">名前</label>
          <input id="p-name" value={form.name} maxLength={100} onChange={set('name')} />
          <label htmlFor="p-hours">予定工数(時間)</label>
          <input id="p-hours" type="number" min="0" step="0.25" value={form.plannedHours} onChange={set('plannedHours')} />
          <label htmlFor="p-start">開始日</label>
          <input id="p-start" type="date" value={form.startDate} onChange={set('startDate')} />
          <label htmlFor="p-end">終了日</label>
          <input id="p-end" type="date" value={form.endDate} onChange={set('endDate')} />
          {mode.kind === 'edit' && (
            <>
              <label htmlFor="p-status">状態</label>
              <select id="p-status" value={form.status} onChange={set('status')}>
                <option value="ACTIVE">進行中</option>
                <option value="CLOSED">終了(日報を入れられなくなる)</option>
              </select>
            </>
          )}
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
              {message.text}
            </p>
          )}
          <button type="submit" className="primary wide" disabled={createState.isLoading || updateState.isLoading}>
            {mode.kind === 'edit' ? '保存' : '追加'}
          </button>
        </form>
      </div>
    </>
  );
}

/** 日報入力: 日付を選んで(最初は今日)、その日の日報を追加・編集する。日付は URL の ?date= に持つ。 */
import { useSearchParams } from 'react-router';
import { addDays, todayIso } from '../../lib/dates';
import { DayEditor } from '../reports/DayEditor';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function EntryPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('date') ?? '';
  const date = ISO_DATE.test(requested) ? requested : todayIso();
  const go = (next: string) => ISO_DATE.test(next) && setParams({ date: next });

  return (
    <>
      <h1>日報入力</h1>
      <div className="toolbar">
        <div className="date-picker">
          <button type="button" aria-label="前の日" onClick={() => go(addDays(date, -1))}>
            ‹
          </button>
          <label htmlFor="entry-date" className="sr-only">
            日付
          </label>
          <input id="entry-date" type="date" value={date} onChange={(e) => go(e.target.value)} />
          <button type="button" aria-label="次の日" onClick={() => go(addDays(date, 1))}>
            ›
          </button>
          <button type="button" className="today" onClick={() => go(todayIso())} disabled={date === todayIso()}>
            今日
          </button>
        </div>
      </div>
      <DayEditor key={date} date={date} />
    </>
  );
}

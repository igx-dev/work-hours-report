import { setMonth } from '../app/uiSlice';
import { useAppDispatch, useAppSelector } from '../app/store';
import { addMonths, monthLabel } from '../lib/dates';

/** 選んでいる月(画面をまたいで覚えておく)を前後に動かす。 */
export function MonthPicker() {
  const month = useAppSelector((s) => s.ui.month);
  const dispatch = useAppDispatch();
  return (
    <div className="month-picker">
      <button type="button" aria-label="前の月" onClick={() => dispatch(setMonth(addMonths(month, -1)))}>
        ‹
      </button>
      <span>{monthLabel(month)}</span>
      <button type="button" aria-label="次の月" onClick={() => dispatch(setMonth(addMonths(month, 1)))}>
        ›
      </button>
    </div>
  );
}

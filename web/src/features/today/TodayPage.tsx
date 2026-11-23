import { todayIso } from '../../lib/dates';
import { DayEditor } from '../reports/DayEditor';

export function TodayPage() {
  return (
    <>
      <h1>今日</h1>
      <DayEditor date={todayIso()} />
    </>
  );
}

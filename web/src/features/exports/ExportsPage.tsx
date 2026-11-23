/** CSV 出力(admin): 月を選んでダウンロード。トークンを付けて取り、ブラウザに保存させる。 */
import { useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import { useAppSelector } from '../../app/store';
import { MonthPicker } from '../../components/MonthPicker';
import { config } from '../../config';
import { monthLabel } from '../../lib/dates';

export function ExportsPage() {
  const auth = useAuth();
  const month = useAppSelector((s) => s.ui.month);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    const token = await auth.idToken();
    const res = await fetch(`${config.apiBaseUrl}/admin/exports/reports.csv?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setError('ダウンロードできませんでした');
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `reports-${month}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h1>CSV 出力</h1>
      <section className="card narrow">
        <MonthPicker />
        <p>
          {monthLabel(month)}の全員の日報を、CSV(表計算ソフトで開けるファイル)で取り出します。列は 日付、プロジェクト、メンバー、時間、メモ です。
        </p>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="button" className="primary wide" onClick={download}>
          ダウンロード
        </button>
      </section>
    </>
  );
}

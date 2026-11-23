/**
 * Highcharts の枠。色や文字はここで1回だけ決める(グラフごとに指定しない)。
 * 画面の幅が変わると、Highcharts が自分で描き直す(reflow)。
 */
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';

export const COLORS = {
  planned: '#d6dde3',
  actual: '#2f6f8f',
  over: '#c2410c',
  series: ['#2f6f8f', '#7aa95c', '#d29a3a', '#8a6fb0', '#4f9fb4', '#b05f6d'],
};

Highcharts.setOptions?.({
  colors: COLORS.series,
  chart: { style: { fontFamily: 'inherit' }, backgroundColor: 'transparent' },
  title: { style: { fontSize: '15px', fontWeight: '600', color: '#1f2a33' }, align: 'left' },
  xAxis: { labels: { style: { color: '#1f2a33', fontSize: '13px' } }, lineColor: '#dde2e6' },
  yAxis: { gridLineColor: '#e9ecef', labels: { style: { color: '#64717c' } } },
  credits: { enabled: false },
  accessibility: { enabled: false },
  lang: { thousandsSep: ',' },
});

export function Chart({ options }: { options: Highcharts.Options }) {
  return (
    <div className="chart">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

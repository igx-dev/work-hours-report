export function HighchartsReact(props: { options?: { title?: { text?: string } } }) {
  return <div data-testid="chart">{props.options?.title?.text}</div>;
}

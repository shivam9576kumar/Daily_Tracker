import './progress.css';

export default function ProgressLegend() {
  return (
    <div className="hm-legend">
      <span>Less</span>
      <div className="hm-cell" />
      <div className="hm-cell hm-l1" />
      <div className="hm-cell hm-l2" />
      <div className="hm-cell hm-l3" />
      <div className="hm-cell hm-l4" />
      <span>More</span>
    </div>
  );
}

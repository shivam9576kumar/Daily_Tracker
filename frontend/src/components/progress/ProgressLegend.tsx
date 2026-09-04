import './progress.css';

export default function ProgressLegend() {
  return (
    <div className="heatmap-legend">
      <span>Less</span>
      <div className="heatmap-legend__cell hm-0" />
      <div className="heatmap-legend__cell hm-1" />
      <div className="heatmap-legend__cell hm-2" />
      <div className="heatmap-legend__cell hm-3" />
      <div className="heatmap-legend__cell hm-4" />
      <span>More</span>
    </div>
  );
}

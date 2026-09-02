import PlanWizard from '../components/plan/PlanWizard';
import '../components/plan/plan.css';

export default function GeneratePlanPage() {
  return (
    <div className="plan-page">
      <div className="plan-header">
        <h1>🎯 AI Study Plan Generator</h1>
        <p>
          Generate a fair, balanced, and weighted study schedule customized to your pace and goals.
        </p>
      </div>

      <PlanWizard />
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PromptAssist from './PromptAssist';
import StepSourceSelect from './StepSourceSelect';
import StepSchedulePace from './StepSchedulePace';
import StepTopicPreferences from './StepTopicPreferences';
import StepBusyDays from './StepBusyDays';
import PlanPreview from './PlanPreview';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { planApi } from '../../services/planApi';
import { getErrorMessage } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import type {
  GeneratePlanPayload,
  PlanPace,
  PlanSource,
  PlanPreviewData,
  BusyDayInput,
} from '../../types';
import './plan.css';

export default function PlanWizard() {
  const navigate = useNavigate();
  const toast = useUIStore((s) => s.toast);

  const [aiLoading, setAiLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  // Form state
  const [source, setSource] = useState<PlanSource>('neetcode150');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [durationDays, setDurationDays] = useState(14);
  const [pace, setPace] = useState<PlanPace>('moderate');
  const [weekdayLoad, setWeekdayLoad] = useState(2.0);
  const [weekendLoad, setWeekendLoad] = useState(3.0);
  const [bufferDay, setBufferDay] = useState(0);
  const [focusTopics, setFocusTopics] = useState<string[]>([]);
  const [avoidTopics, setAvoidTopics] = useState<string[]>([]);
  const [busyDays, setBusyDays] = useState<BusyDayInput[]>([]);

  // Preview data
  const [previewData, setPreviewData] = useState<PlanPreviewData | null>(null);

  const handleAiParse = async (prompt: string) => {
    setAiLoading(true);
    try {
      const parsed = await planApi.aiParse(prompt);
      if (parsed.source) setSource(parsed.source as PlanSource);
      if (parsed.durationDays) setDurationDays(parsed.durationDays);
      if (parsed.pace) setPace(parsed.pace);
      if (parsed.weekdayLoad) setWeekdayLoad(parsed.weekdayLoad);
      if (parsed.weekendLoad) setWeekendLoad(parsed.weekendLoad);
      if (parsed.focusTopics) setFocusTopics(parsed.focusTopics);
      if (parsed.avoidTopics) setAvoidTopics(parsed.avoidTopics);
      if (parsed.busyDays) setBusyDays(parsed.busyDays);
      if (typeof parsed.bufferDay === 'number') setBufferDay(parsed.bufferDay);

      toast('✨ AI populated your plan settings! Please review before generating.', 'success');
      setPreviewData(null);
    } catch (err) {
      toast(getErrorMessage(err) || 'AI could not understand. Please fill manually.', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    setPreviewLoading(true);
    try {
      const payload: GeneratePlanPayload = {
        source,
        startDate,
        durationDays,
        pace,
        weekdayLoad,
        weekendLoad,
        bufferDay,
        focusTopics,
        avoidTopics,
        busyDays,
      };

      const preview = await planApi.preview(payload);
      setPreviewData(preview);
      toast('Plan schedule preview generated!', 'info');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async (archiveExisting = false) => {
    setCommitting(true);
    try {
      const sourceTitle = source === 'coderarmy' ? 'Coder Army' : 'NeetCode 150';
      const payload: GeneratePlanPayload = {
        name: `${sourceTitle} - ${durationDays} Day Plan`,
        source,
        startDate,
        durationDays,
        pace,
        weekdayLoad,
        weekendLoad,
        bufferDay,
        focusTopics,
        avoidTopics,
        busyDays,
        archiveExisting,
      };

      const result = await planApi.commit(payload);
      toast(`🎉 Plan "${result.plan.name}" created with ${result.tasksCreated} tasks!`, 'success');
      setArchiveModalOpen(false);
      navigate('/roadmap');
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.includes('already have an active plan')) {
        setArchiveModalOpen(true);
      } else {
        toast(msg, 'error');
      }
    } finally {
      setCommitting(false);
    }
  };

  const steps = ['Source', 'Schedule', 'Topics', 'Busy Days', 'Preview'];
  const current = previewData ? 4 : 0;

  return (
    <>
      <header className="wizard-head">
        <div className="wizard-head__title-row">
          <span className="wizard-head__icon" aria-hidden="true">🎯</span>
          <h1 className="wizard-head__title">Generate Plan</h1>
        </div>
        <p className="wizard-head__subtitle">
          Generate a fair, balanced, and weighted study schedule customized to your pace and goals.
        </p>
      </header>

      <ol className="wizard-steps" aria-label="Plan wizard progress">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`wizard-step${i === current ? ' is-active' : ''}${i < current ? ' is-done' : ''}`}
          >
            <span className="wizard-step__dot">{i < current ? '✓' : i + 1}</span>
            <span className="wizard-step__label">{s}</span>
            {i < steps.length - 1 && <span className="wizard-step__line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <PromptAssist onParse={handleAiParse} loading={aiLoading} />

      <StepSourceSelect source={source} onChange={setSource} />

      <StepSchedulePace
        startDate={startDate}
        durationDays={durationDays}
        pace={pace}
        weekdayLoad={weekdayLoad}
        weekendLoad={weekendLoad}
        bufferDay={bufferDay}
        onChange={(fields) => {
          if (fields.startDate !== undefined) setStartDate(fields.startDate);
          if (fields.durationDays !== undefined) setDurationDays(fields.durationDays);
          if (fields.pace !== undefined) setPace(fields.pace);
          if (fields.weekdayLoad !== undefined) setWeekdayLoad(fields.weekdayLoad);
          if (fields.weekendLoad !== undefined) setWeekendLoad(fields.weekendLoad);
          if (fields.bufferDay !== undefined) setBufferDay(fields.bufferDay);
          setPreviewData(null);
        }}
      />

      <StepTopicPreferences
        focusTopics={focusTopics}
        avoidTopics={avoidTopics}
        onChange={(f, a) => {
          setFocusTopics(f);
          setAvoidTopics(a);
          setPreviewData(null);
        }}
      />

      <StepBusyDays
        busyDays={busyDays}
        onChange={(b) => {
          setBusyDays(b);
          setPreviewData(null);
        }}
      />

      {!previewData && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 32px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: 16 }}
            disabled={previewLoading}
            onClick={handleGeneratePreview}
          >
            {previewLoading ? 'Generating...' : '⚡ Generate Schedule Preview'}
          </button>
        </div>
      )}

      {previewData && (
        <PlanPreview
          preview={previewData}
          onCommit={handleCommit}
          committing={committing}
        />
      )}

      <Modal
        open={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Active Plan Exists"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setArchiveModalOpen(false)}
              disabled={committing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={committing}
              onClick={() => handleCommit(true)}
            >
              {committing ? 'Archiving...' : 'Archive & Create New Plan'}
            </button>
          </>
        }
      >
        <div className="banner banner--warning" style={{ margin: 0 }}>
          Your current plan will be archived — progress kept, you can restore or delete it anytime from Roadmap.
        </div>
      </Modal>
    </>
  );
}

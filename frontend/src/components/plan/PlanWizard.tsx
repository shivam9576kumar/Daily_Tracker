import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIPlanChat from './AIPlanChat';
import PromptAssist from './PromptAssist';
import StepSourceSelect from './StepSourceSelect';
import StepSchedulePace from './StepSchedulePace';
import StepTopicPreferences from './StepTopicPreferences';
import StepBusyDays from './StepBusyDays';
import PlanPreview from './PlanPreview';
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
  TopicQuota,
  AIDraft,
} from '../../types';
import './plan.css';

function getLocalDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PlanWizard() {
  const navigate = useNavigate();
  const toast = useUIStore((s) => s.toast);

  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [aiLoading, setAiLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  // Form state
  const [source, setSource] = useState<PlanSource>('neetcode150');
  const [startDate, setStartDate] = useState(getLocalDateKey());
  const [durationDays, setDurationDays] = useState(14);
  const [pace, setPace] = useState<PlanPace>('moderate');
  const [weekdayLoad, setWeekdayLoad] = useState(2.0);
  const [weekendLoad, setWeekendLoad] = useState(3.0);
  const [bufferDay, setBufferDay] = useState(0);
  const [topicQuotas, setTopicQuotas] = useState<TopicQuota[]>([]);
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

  const handleGeneratePreview = async (overridePayload?: GeneratePlanPayload) => {
    setPreviewLoading(true);
    try {
      const payload: GeneratePlanPayload = overridePayload || {
        source,
        startDate,
        durationDays,
        pace,
        weekdayLoad,
        weekendLoad,
        bufferDay,
        topicQuotas: topicQuotas.length > 0 ? topicQuotas : undefined,
        focusTopics,
        avoidTopics,
        busyDays,
      };

      if (overridePayload) {
        setSource(overridePayload.source);
        setStartDate(overridePayload.startDate);
        setDurationDays(overridePayload.durationDays);
        if (overridePayload.pace) setPace(overridePayload.pace);
        setWeekdayLoad(overridePayload.weekdayLoad);
        setWeekendLoad(overridePayload.weekendLoad);
        if (overridePayload.topicQuotas) setTopicQuotas(overridePayload.topicQuotas);
        if (overridePayload.focusTopics) setFocusTopics(overridePayload.focusTopics);
        if (overridePayload.avoidTopics) setAvoidTopics(overridePayload.avoidTopics);
        if (overridePayload.busyDays) setBusyDays(overridePayload.busyDays);
      }

      const preview = await planApi.preview(payload);
      setPreviewData(preview);
      toast('Plan schedule preview generated!', 'info');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTweakManually = (draft: AIDraft) => {
    setSource(draft.source || 'neetcode150');
    setStartDate(draft.startDate || getLocalDateKey());
    setDurationDays(draft.durationDays || 30);
    if (draft.pace) setPace(draft.pace as PlanPace);
    setWeekdayLoad(draft.weekdayLoad ?? 2);
    setWeekendLoad(draft.weekendLoad ?? 3);
    setFocusTopics(draft.focusTopics || []);
    setAvoidTopics(draft.avoidTopics || []);
    setTopicQuotas(draft.topicQuotas || []);
    setBusyDays(draft.busyDays || []);
    if (typeof draft.bufferDay === 'number') setBufferDay(draft.bufferDay);
    setMode('manual');
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
        topicQuotas: topicQuotas.length > 0 ? topicQuotas : undefined,
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
  const previewLoaded = Boolean(previewData);

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

      <div className="plan-mode-toggle" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`plan-mode-toggle__btn ${mode === 'ai' ? 'is-active' : ''}`}
          onClick={() => setMode('ai')}
        >
          ✨ AI Chat
        </button>
        <button
          type="button"
          className={`plan-mode-toggle__btn ${mode === 'manual' ? 'is-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          🔧 Manual Setup
        </button>
      </div>

      {mode === 'ai' ? (
        <>
          <AIPlanChat
            onGeneratePreview={(payload) => handleGeneratePreview(payload)}
            onCommit={() => handleCommit()}
            onTweakManually={handleTweakManually}
            previewLoaded={previewLoaded}
          />
          {previewData && (
            <div style={{ marginTop: 24 }}>
              <PlanPreview
                preview={previewData}
                onCommit={handleCommit}
                committing={committing}
              />
            </div>
          )}
        </>
      ) : (
        <>
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
                onClick={() => handleGeneratePreview()}
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
        </>
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


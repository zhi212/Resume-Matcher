'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpinnerGap, PencilSimple, Plus } from '@phosphor-icons/react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useTranslations } from '@/lib/i18n';
import { formatDate } from '@/lib/format-date';
import {
  addInterviewQuestion,
  getApplicationDetail,
  updateApplication,
  type ApplicationDetail,
} from '@/lib/api/tracker';

interface CardDetailModalProps {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function CardDetailModal({
  applicationId,
  open,
  onOpenChange,
  onUpdated,
}: CardDetailModalProps) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !applicationId) {
      setDetail(null);
      setQuestionDraft('');
      setQuestionError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getApplicationDetail(applicationId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setNotes(data.notes ?? '');
        setNotesError(null);
        setQuestionDraft('');
        setQuestionError(null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, applicationId]);

  // Keep textarea Enter from bubbling to dialog/global handlers.
  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') e.stopPropagation();
  };

  const handleSaveNotes = async () => {
    if (!applicationId) return;
    setSavingNotes(true);
    setNotesError(null);
    try {
      await updateApplication(applicationId, { notes });
      onUpdated();
    } catch {
      // Show a generic message — never echo raw backend error text inline,
      // which could contain sensitive values.
      setNotesError(t('common.error'));
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!applicationId) return;
    const question = questionDraft.trim();
    if (!question) {
      setQuestionError(t('tracker.interviewQuestions.validation'));
      return;
    }
    setSavingQuestion(true);
    setQuestionError(null);
    try {
      const created = await addInterviewQuestion(applicationId, question);
      setDetail((current) =>
        current
          ? {
              ...current,
              interview_questions: [created, ...(current.interview_questions ?? [])],
            }
          : current
      );
      setQuestionDraft('');
    } catch {
      setQuestionError(t('tracker.interviewQuestions.createFailed'));
    } finally {
      setSavingQuestion(false);
    }
  };

  const resumeAvailable = Boolean(detail?.resume);
  const interviewQuestions = detail?.interview_questions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{detail?.company || t('tracker.card.companyUnknown')}</DialogTitle>
          <DialogDescription>{detail?.role || t('tracker.card.roleUnknown')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {loading ? (
            <div role="status" className="py-8">
              <SpinnerGap aria-hidden="true" className="size-5 animate-spin text-steel" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 font-mono text-xs uppercase text-ink-soft">
                <StatusIndicator tone="neutral">
                  {t(`tracker.columns.${detail.status}`)}
                </StatusIndicator>
                {detail.applied_at && (
                  <span className="tabular-nums">
                    {formatDate(detail.applied_at, locale, { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <Label>{t('tracker.modal.jobDescription')}</Label>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border border-ink bg-canvas p-3 text-sm">
                  {detail.job_content || t('tracker.modal.noJobDescription')}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-interview-question">
                  {t('tracker.interviewQuestions.questionLabel')}
                </Label>
                <Textarea
                  id="card-interview-question"
                  value={questionDraft}
                  onChange={(e) => {
                    setQuestionDraft(e.target.value);
                    setQuestionError(null);
                  }}
                  onKeyDown={handleNotesKeyDown}
                  placeholder={t('tracker.interviewQuestions.questionPlaceholder')}
                  rows={3}
                  maxLength={5000}
                  aria-invalid={Boolean(questionError)}
                />
                {questionError && <Alert tone="error">{questionError}</Alert>}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddQuestion}
                    disabled={savingQuestion}
                  >
                    {savingQuestion ? (
                      <>
                        <SpinnerGap aria-hidden="true" className="animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      <>
                        <Plus aria-hidden="true" />
                        {t('tracker.interviewQuestions.submit')}
                      </>
                    )}
                  </Button>
                </div>

                {interviewQuestions.length === 0 ? (
                  <EmptyState title={t('tracker.interviewQuestions.empty')} />
                ) : (
                  <ul className="space-y-2" aria-label={t('tracker.interviewQuestions.listLabel')}>
                    {interviewQuestions.map((item) => (
                      <li
                        key={item.question_id}
                        className="border border-ink bg-paper p-3 text-sm text-ink-soft shadow-sw-nested"
                      >
                        <p className="whitespace-pre-wrap">{item.question}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="card-notes">{t('tracker.modal.notes')}</Label>
                <Textarea
                  id="card-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={handleNotesKeyDown}
                  placeholder={t('tracker.modal.notesPlaceholder')}
                  rows={3}
                />
                {notesError && <Alert tone="error">{notesError}</Alert>}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? (
                      <>
                        <SpinnerGap aria-hidden="true" className="animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      t('tracker.modal.saveNotes')
                    )}
                  </Button>
                </div>
              </div>

              {!resumeAvailable && (
                <Alert tone="warning">{t('tracker.modal.resumeUnavailable')}</Alert>
              )}
            </div>
          ) : (
            <p className="py-6 font-mono text-sm text-steel">{t('tracker.modal.loadFailed')}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              if (detail?.resume_id) router.push(`/builder?id=${detail.resume_id}`);
            }}
            disabled={!resumeAvailable}
          >
            <PencilSimple aria-hidden="true" />
            {t('tracker.modal.editResume')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

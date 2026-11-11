'use client';

import React, { useEffect, useState } from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { useTranslations } from '@/lib/i18n';
import { listInterviewQuestions, type TrackerInterviewQuestion } from '@/lib/api/tracker';

interface InterviewQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InterviewQuestionsDialog({ open, onOpenChange }: InterviewQuestionsDialogProps) {
  const { t } = useTranslations();
  const [questions, setQuestions] = useState<TrackerInterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listInterviewQuestions()
      .then((data) => {
        if (!cancelled) setQuestions(data.questions);
      })
      .catch(() => {
        if (!cancelled) {
          setQuestions([]);
          setError(t('tracker.interviewQuestions.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('tracker.interviewQuestions.title')}</DialogTitle>
          <DialogDescription>{t('tracker.interviewQuestions.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div role="status" className="flex items-center gap-2 py-8">
              <SpinnerGap aria-hidden="true" className="size-5 animate-spin text-steel" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : error ? (
            <Alert tone="error">{error}</Alert>
          ) : questions.length === 0 ? (
            <EmptyState
              variant="framed"
              title={t('tracker.interviewQuestions.empty')}
              description={t('tracker.interviewQuestions.emptyDescription')}
            />
          ) : (
            <ul className="space-y-3">
              {questions.map((item) => (
                <li
                  key={item.question_id}
                  className="border border-ink bg-paper p-4 shadow-sw-nested"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-semibold text-ink">
                      {item.company?.trim() || t('tracker.card.companyUnknown')}
                    </p>
                    <p className="font-mono text-xs uppercase tracking-wide text-steel">
                      {item.role?.trim() || t('tracker.card.roleUnknown')}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{item.question}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

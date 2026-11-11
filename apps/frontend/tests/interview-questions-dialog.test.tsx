import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InterviewQuestionsDialog } from '@/components/tracker/interview-questions-dialog';
import { listInterviewQuestions } from '@/lib/api/tracker';

vi.mock('@/lib/i18n', () => ({ useTranslations: () => ({ t: (key: string) => key }) }));

vi.mock('@/lib/api/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tracker')>()),
  listInterviewQuestions: vi.fn(),
}));

describe('InterviewQuestionsDialog', () => {
  it('lists every recorded question with its company', async () => {
    vi.mocked(listInterviewQuestions).mockResolvedValue({
      questions: [
        {
          question_id: 'q1',
          application_id: 'a1',
          company: 'Acme',
          role: 'Engineer',
          question: 'How do you handle incidents?',
        },
        {
          question_id: 'q2',
          application_id: 'a2',
          company: 'Beta',
          role: 'Designer',
          question: 'Walk me through a difficult stakeholder.',
        },
      ],
    });

    render(<InterviewQuestionsDialog open onOpenChange={vi.fn()} />);

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('How do you handle incidents?')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Walk me through a difficult stakeholder.')).toBeInTheDocument();
  });

  it('shows a framed empty state when no questions exist', async () => {
    vi.mocked(listInterviewQuestions).mockResolvedValue({ questions: [] });

    render(<InterviewQuestionsDialog open onOpenChange={vi.fn()} />);

    expect(await screen.findByText('tracker.interviewQuestions.empty')).toHaveClass('font-mono');
  });
});

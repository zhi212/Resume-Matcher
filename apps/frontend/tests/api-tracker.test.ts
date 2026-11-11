import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addInterviewQuestion,
  bulkUpdateStatus,
  bulkDeleteApplications,
  createApplication,
  deleteApplication,
  deleteInterviewQuestion,
  listInterviewQuestions,
  updateApplication,
} from '@/lib/api/tracker';
import { llmProviderToKeyProvider } from '@/lib/api/config';

/**
 * Tracker API client contracts: the wrappers must hit the right method/URL and
 * send the right payloads, and the provider-axis mapping (used by the Settings
 * key store) must mirror the backend `_PROVIDER_KEY_MAP`.
 */

describe('llmProviderToKeyProvider', () => {
  it('maps gemini to the google key-store slot and passes others through', () => {
    expect(llmProviderToKeyProvider('gemini')).toBe('google');
    expect(llmProviderToKeyProvider('openai')).toBe('openai');
    expect(llmProviderToKeyProvider('anthropic')).toBe('anthropic');
    expect(llmProviderToKeyProvider('openai_compatible')).toBe('openai_compatible');
    expect(llmProviderToKeyProvider('ollama')).toBe('ollama');
  });
});

describe('tracker API client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const lastCall = () => {
    const [url, options] = fetchMock.mock.calls.at(-1)!;
    return { url: String(url), options: options as RequestInit };
  };

  it('bulkUpdateStatus PATCHes /applications/bulk with ids + status', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok', affected: 2 }), { status: 200 })
    );
    await bulkUpdateStatus(['a', 'b'], 'interview');
    const { url, options } = lastCall();
    expect(url).toContain('/applications/bulk');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(String(options.body))).toEqual({
      application_ids: ['a', 'b'],
      status: 'interview',
    });
  });

  it('updateApplication PATCHes /applications/{id} with the partial', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ application_id: 'x' }), { status: 200 })
    );
    await updateApplication('x', {
      status: 'rejected',
      position: 0,
      interview_at: '2026-03-20T02:30:00.000Z',
    });
    const { url, options } = lastCall();
    expect(url).toContain('/applications/x');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(String(options.body))).toEqual({
      status: 'rejected',
      position: 0,
      interview_at: '2026-03-20T02:30:00.000Z',
    });
  });

  it('addInterviewQuestion POSTs to the nested application route', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ question_id: 'q1' }), { status: 200 })
    );
    await addInterviewQuestion('a1', 'Why this role?');
    const { url, options } = lastCall();
    expect(url).toContain('/applications/a1/interview-questions');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({ question: 'Why this role?' });
  });

  it('listInterviewQuestions GETs the global question list', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ questions: [] }), { status: 200 }));
    await listInterviewQuestions();
    const { url, options } = lastCall();
    expect(url).toContain('/applications/interview-questions');
    expect(options.method).toBeUndefined();
  });

  it('deleteInterviewQuestion DELETEs the nested question route', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'deleted', affected: 1 }), { status: 200 })
    );
    await deleteInterviewQuestion('a1', 'q1');
    const { url, options } = lastCall();
    expect(url).toContain('/applications/a1/interview-questions/q1');
    expect(options.method).toBe('DELETE');
  });

  it('createApplication POSTs the manual-add payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ application_id: 'x' }), { status: 200 })
    );
    await createApplication({ resume_id: 'r1', job_description: 'JD', status: 'saved' });
    const { url, options } = lastCall();
    expect(url).toContain('/applications');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toMatchObject({ resume_id: 'r1', status: 'saved' });
  });

  it('deleteApplication DELETEs /applications/{id}', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok', affected: 1 }), { status: 200 })
    );
    await deleteApplication('x');
    const { url, options } = lastCall();
    expect(url).toContain('/applications/x');
    expect(options.method).toBe('DELETE');
  });

  it('bulkDeleteApplications POSTs to /applications/bulk-delete', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok', affected: 2 }), { status: 200 })
    );
    await bulkDeleteApplications(['a', 'b']);
    const { url, options } = lastCall();
    expect(url).toContain('/applications/bulk-delete');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({ application_ids: ['a', 'b'] });
  });

  it('surfaces the backend detail message on failure', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: 'boom' }), { status: 500 }));
    await expect(deleteApplication('x')).rejects.toThrow('boom');
  });
});

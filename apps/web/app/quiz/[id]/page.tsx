'use client';

import { useEffect, useMemo, useState } from 'react';

type Question = {
  id: string;
  text: string;
  options: string[];
  explanation?: string;
};

type Quiz = {
  id: string;
  title: string;
  description: string;
  questions: Question[];
};

type QuizSubmissionResult = {
  attemptId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
};

export default function QuizPage({ params }: { params: { id: string } }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem('iia_token') || '';
  }, []);

  useEffect(() => {
    let active = true;

    const loadQuiz = async () => {
      try {
        const response = await fetch(`/api/quiz/${encodeURIComponent(params.id)}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload?.id || !Array.isArray(payload.questions)) {
          throw new Error(payload?.message || 'Quiz not found.');
        }

        if (active) {
          setQuiz(payload as Quiz);
          setError('');
        }
      } catch (failure) {
        if (active) {
          setError(failure instanceof Error ? failure.message : 'Could not load this quiz.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadQuiz();
    return () => {
      active = false;
    };
  }, [params.id]);

  const handleSubmit = async () => {
    if (!quiz) return;
    if (Object.keys(answers).length < quiz.questions.length) {
      setError('Please answer every question before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/quiz/${encodeURIComponent(quiz.id)}/submit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          answers: quiz.questions.map((_, questionIndex) => answers[questionIndex]),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Could not submit your answers.');
      }

      setResult(payload as QuizSubmissionResult);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit your answers.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main style={{ fontFamily: 'Arial, sans-serif', padding: 24 }}>
        <h1>Loading quiz…</h1>
        <p>Please wait while the questions are fetched.</p>
      </main>
    );
  }

  if (error || !quiz) {
    return (
      <main style={{ fontFamily: 'Arial, sans-serif', padding: 24 }}>
        <h1>Quiz unavailable</h1>
        <p>{error || 'This quiz could not be loaded.'}</p>
        <a href="/dashboard">Back to dashboard</a>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <a href="/dashboard" style={{ display: 'inline-block', marginBottom: 20 }}>← Back to dashboard</a>

      <h1>{quiz.title}</h1>
      <p>{quiz.description}</p>

      {result ? (
        <div style={{ margin: '24px 0', padding: 16, border: '1px solid #d0d7de', borderRadius: 12, background: '#f6f8fa' }}>
          <h2>Result</h2>
          <p>
            Score: <strong>{result.score}/{result.totalQuestions}</strong> ({result.percentage}%)
          </p>
          <p>{result.passed ? 'You passed this quiz.' : 'You did not pass this quiz yet.'}</p>
          <a href={`/results/${result.attemptId}`}>View detailed result</a>
        </div>
      ) : null}

      {quiz.questions.map((question, questionIndex) => (
        <fieldset key={question.id} style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #d0d7de' }}>
          <legend style={{ fontWeight: 700 }}>
            {questionIndex + 1}. {question.text}
          </legend>

          {question.options.map((option, optionIndex) => (
            <label key={`${question.id}-${optionIndex}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={answers[questionIndex] === optionIndex}
                onChange={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                disabled={Boolean(result)}
              />
              <span>{option}</span>
            </label>
          ))}

          {result && question.explanation ? (
            <p style={{ marginTop: 10, color: '#1f2937' }}>
              <strong>Explanation:</strong> {question.explanation}
            </p>
          ) : null}
        </fieldset>
      ))}

      {!result ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length !== quiz.questions.length}
          style={{ padding: '10px 16px', border: 'none', borderRadius: 8, background: '#0f172a', color: '#fff', cursor: 'pointer' }}
        >
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      ) : null}

      {error ? <p style={{ color: '#b91c1c', marginTop: 16 }}>{error}</p> : null}
    </main>
  );
}

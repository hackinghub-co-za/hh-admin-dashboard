import { useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { generateGemmaQuiz, recordGemmaQuiz } from '../../lib/gemmaData';
import { friendlyMemberErrorMessage } from '../../lib/errorMessages';
import { MOCK_QUIZ } from './gemmaMock';
import GemmaAvatar from './GemmaAvatar';

function verdict(score, total) {
  const pct = score / total;
  if (pct === 1) return "Full marks?! Okay, show-off. I love it for you.";
  if (pct >= 0.8) return 'Sharp! One or two to tidy up and you own this topic.';
  if (pct >= 0.6) return "Not bad, babe. Read the explanations on the ones you missed and go again tomorrow.";
  return "Eish, this one fought back. That's fine, it just tells us what to study next.";
}

export default function GemmaQuiz({ isMockSession, onExit }) {
  const [topic, setTopic] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = isMockSession ? MOCK_QUIZ : await generateGemmaQuiz(topic.trim());
      setQuiz(result);
      setIndex(0);
      setPicked(null);
      setScore(0);
      setFinished(false);
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === quiz.questions[index].answer_index) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    setFinished(true);
    if (!isMockSession) recordGemmaQuiz(quiz.topic, score, quiz.questions.length).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <button onClick={onExit} className="gemma-link" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={14} /> Back to chat</button>

      {!quiz && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <GemmaAvatar size={30} />
            <p style={{ fontSize: '0.88rem' }}>Five questions, no marks on your record. Leave the topic blank and I'll pick from your roadmap.</p>
          </div>
          <label htmlFor="gemma-quiz-topic" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Topic (optional)</label>
          <input id="gemma-quiz-topic" className="form-input" placeholder="e.g. Security+ Domain 3, POPIA, Linux permissions" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} />
          {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</p>}
          <button className="btn btn-primary" onClick={start} disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Writing your quiz...' : 'Start quiz'}
          </button>
        </div>
      )}

      {quiz && !finished && (() => {
        const q = quiz.questions[index];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{quiz.topic} · {index + 1} of {quiz.questions.length}</div>
            <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>{q.question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {q.options.map((opt, i) => {
                const isRight = picked !== null && i === q.answer_index;
                const isWrongPick = picked === i && i !== q.answer_index;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    className="gemma-option"
                    data-state={isRight ? 'right' : isWrongPick ? 'wrong' : picked === null ? 'open' : 'done'}
                  >
                    {isRight && <CheckCircle2 size={15} color="var(--success)" />}
                    {isWrongPick && <XCircle size={15} color="var(--danger)" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{q.why}</p>
                <button className="btn btn-primary" onClick={next} style={{ alignSelf: 'flex-start' }}>
                  {index + 1 < quiz.questions.length ? 'Next question' : 'See my score'}
                </button>
              </>
            )}
          </div>
        );
      })()}

      {finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{score}/{quiz.questions.length}</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <GemmaAvatar size={30} />
            <p style={{ fontSize: '0.88rem' }}>{verdict(score, quiz.questions.length)}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setQuiz(null)}><RotateCcw size={14} /> Another one</button>
            <button className="btn btn-secondary" onClick={onExit}>Back to chat</button>
          </div>
        </div>
      )}
    </div>
  );
}

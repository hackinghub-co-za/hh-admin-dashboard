import { useState } from 'react';
import GemmaAvatar from './GemmaAvatar';
import { requestLabHint, requestLabExplain } from '../../lib/gemmaData';
import { friendlyMemberErrorMessage } from '../../lib/errorMessages';
import { MOCK_HINT } from './gemmaMock';
import { labContext } from './labContext';

const HINTS_PER_LAB = 3;
const EXPLAINS_PER_LAB = 5;

export default function GemmaLabHelp({ labSlug, content, task, mode, help, onHelpAdded, isMockSession }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const kind = mode === 'hint' ? 'hint' : 'explain';
  const cap = kind === 'hint' ? HINTS_PER_LAB : EXPLAINS_PER_LAB;
  const usedForLab = help.filter((h) => h.kind === kind).length;
  const forTask = help.filter((h) => h.kind === kind && h.taskKey === task.key);
  const left = Math.max(0, cap - usedForLab);

  const ask = async () => {
    setLoading(true);
    setError(null);
    try {
      const contentText = isMockSession
        ? (kind === 'hint' ? MOCK_HINT : 'On a real account I would walk you through exactly why the right answer is right, using your own answer and the evidence.')
        : (await (kind === 'hint' ? requestLabHint : requestLabExplain)(labSlug, task.key, labContext(content, task))).content;
      onHelpAdded({ taskKey: task.key, kind, content: contentText });
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {forTask.map((h, i) => (
        <div key={i} className="gemma-hint">
          <GemmaAvatar size={24} ring={false} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <span style={{ whiteSpace: 'pre-wrap' }}>{h.content}</span>
            {kind === 'hint' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Hints point at the evidence. Gemma never has the answers.</span>}
          </div>
        </div>
      ))}
      {left > 0 && (
        <div className="gemma-hintbar">
          <GemmaAvatar size={24} ring={false} />
          <span>{kind === 'hint' ? <><strong>Stuck?</strong> Ask Gemma for a hint</> : <><strong>Not sure why?</strong> Ask Gemma to explain</>}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{left} of {cap} left for this lab</span>
          <button className="gemma-action" onClick={ask} disabled={loading}>{loading ? 'Thinking...' : kind === 'hint' ? 'Get a hint' : 'Explain'}</button>
        </div>
      )}
      {error && <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}

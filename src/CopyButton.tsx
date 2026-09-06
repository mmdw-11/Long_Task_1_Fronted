import { useEffect, useRef, useState } from 'react';

export function CopyButton({ text, label = '复制', getText }: { text?: string; label?: string; getText?: () => string }) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(getText ? getText() : text || ''); setStatus('已复制'); }
    catch { setStatus('复制失败，请手动选择'); }
    clearTimeout(timer.current); timer.current = setTimeout(() => setStatus(''), 2000);
  };
  return <button type="button" className="transcript-copy" onClick={copy} aria-label={label}><span aria-hidden="true">⧉</span><span aria-live="polite">{status || label}</span></button>;
}

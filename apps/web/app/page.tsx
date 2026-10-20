'use client';

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';

const suggestions = [
  'Ask anything…',
  'Explain a difficult topic in simple words…',
  'Upload a PDF and ask me about it…',
  'Make notes from my study material…',
  'Generate exam questions from my PDF…',
  'Find the most repeated questions…',
  'Help me understand this concept…',
  'Identify my weak topics and help me improve…',
  'Summarize or translate this document…',
  'Help me solve a problem or debug code…',
  'Review my CV and suggest specific improvements…',
  'Give me interview preparation topics and practice questions…',
];

type AuthUser = { id: string; name: string; email: string };

type UploadedDocument = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  textCharacters?: number;
  pagesIndexed?: number;
  ocrUsed?: boolean;
  textTruncated?: boolean;
};

export default function HomePage() {
  const [currentSuggestion, setCurrentSuggestion] = useState(0);
  const [token, setToken] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatAnswer, setChatAnswer] = useState('');
  const [taskMode, setTaskMode] = useState(false);
  const [taskSteps, setTaskSteps] = useState<{ title: string; completed: boolean }[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentSuggestion((previous) => (previous + 1) % suggestions.length), 3200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const savedToken = window.sessionStorage.getItem('iia_token') || '';
      if (!savedToken) {
        if (active) setAuthReady(true);
        return;
      }
      try {
        const response = await fetch('/api/auth/me', { headers: { authorization: `Bearer ${savedToken}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user?.id) throw new Error('Session expired');
        if (active) {
          setToken(savedToken);
          setAuthUser({ id: payload.user.id, name: payload.user.name || '', email: payload.user.email || '' });
          window.sessionStorage.setItem('iia_user', JSON.stringify(payload.user));
        }
      } catch {
        window.sessionStorage.removeItem('iia_token');
        window.sessionStorage.removeItem('iia_user');
      } finally {
        if (active) setAuthReady(true);
      }
    };
    void restoreSession();
    return () => { active = false; };
  }, []);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const response = await fetch(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(authMode === 'signup'
          ? { name: authName, email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.token !== 'string' || !payload.user) {
        throw new Error(payload.message || 'Could not sign in. Please try again.');
      }
      window.sessionStorage.setItem('iia_token', payload.token);
      window.sessionStorage.setItem('iia_user', JSON.stringify(payload.user));
      setToken(payload.token);
      setAuthUser(payload.user as AuthUser);
      setAuthPassword('');
    } catch (failure) {
      setAuthError(failure instanceof Error ? failure.message : 'Authentication failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    window.sessionStorage.removeItem('iia_token');
    window.sessionStorage.removeItem('iia_user');
    setToken('');
    setAuthUser(null);
    setDocument(null);
    setChatAnswer('');
    setTaskSteps([]);
    setChatError('');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!token) { setError('Create an account or sign in before uploading a PDF.'); return; }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF file.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/uploads', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Upload failed. Please try again.');
      }

      setDocument(payload as UploadedDocument);
      setChatAnswer('');
        setTaskSteps([]);
      setChatError('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
      setDocument(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatMessage.trim();
    if (!message || isChatting || !token) return;

    setIsChatting(true);
    setChatError('');
    setChatAnswer('');
    setTaskSteps([]);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, ...(document ? { documentId: document.id } : {}), taskMode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'IIA could not answer right now.');
      setChatAnswer(typeof payload.answer === 'string' ? payload.answer : 'IIA returned an empty response.');
      setTaskSteps(Array.isArray(payload.taskMode?.steps) ? payload.taskMode.steps : []);
    } catch (chatFailure) {
      setChatError(chatFailure instanceof Error ? chatFailure.message : 'IIA could not answer right now.');
    } finally {
      setIsChatting(false);
    }
  };

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await handleFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    await handleFile(event.dataTransfer.files?.[0]);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadLabel = isUploading ? 'Uploading your PDF…' : 'Upload PDF';

  return (
    <main className="iia-page">
      <div className="iia-background" aria-hidden="true" />

      <section className="iia-hero" aria-label="Integrated Intelligence Agent home screen">
        <p className="iia-kicker">IIA study workspace</p>
        <a className="iia-business-link" href="/business">For businesses: explore the IIA Business Assistant <span aria-hidden="true">↗</span></a>
        <h1>Study smarter with your own material.</h1>
        <p className="iia-subtitle">
          Upload a PDF, review the document details, and continue into the study workflow already supported by the app.
        </p>

        <section className="iia-auth-panel" aria-labelledby="iia-auth-heading">
          <div className="iia-auth-heading-row">
            <div>
              <h2 id="iia-auth-heading">{token ? `Signed in as ${authUser?.name || authUser?.email || 'user'}` : authMode === 'signup' ? 'Create your IIA account' : 'Welcome back'}</h2>
              <p>{token ? 'Your PDFs and questions are tied to this account.' : 'Sign in is required so uploaded PDFs stay private to your account.'}</p>
            </div>
            {token ? <button type="button" className="iia-auth-switch" onClick={handleLogout}>Sign out</button> : null}
          </div>
          {!token ? (
            <form onSubmit={handleAuthSubmit}>
              {authMode === 'signup' ? (
                <>
                  <label htmlFor="iia-auth-name">Name</label>
                  <input id="iia-auth-name" autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} maxLength={100} required />
                </>
              ) : null}
              <label htmlFor="iia-auth-email">Email</label>
              <input id="iia-auth-email" type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} maxLength={254} required />
              <label htmlFor="iia-auth-password">Password</label>
              <input id="iia-auth-password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} maxLength={128} required />
              <div className="iia-auth-actions">
                <button type="submit" className="iia-upload-button" disabled={isAuthenticating || !authReady}>{isAuthenticating ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
                <button type="button" className="iia-auth-switch" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }}>{authMode === 'signup' ? 'Already registered? Sign in' : 'New here? Create an account'}</button>
              </div>
              {authError ? <p className="iia-status iia-status-error" role="alert">{authError}</p> : null}
            </form>
          ) : null}
        </section>

        <section
          className={`iia-composer iia-ask-workspace ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          aria-label="Ask IIA workspace"
        >
          {!chatAnswer && !isChatting ? (
            <div className="iia-suggestion-shell" aria-live="polite" aria-atomic="true">
              <span className="iia-suggestion-label">Try:</span>
              <span className="iia-suggestion">{suggestions[currentSuggestion]}</span>
            </div>
          ) : null}
          {isChatting ? (
            <div className="iia-answer-workspace" role="status" aria-live="polite">
              <span className="iia-suggestion-label">IIA is thinking</span>
              <p className="iia-loading-answer">Preparing your answer…</p>
              <div className="iia-loading-bar" aria-hidden="true"><span /></div>
            </div>
          ) : null}
          {chatAnswer ? (
            <div className="iia-answer-workspace" aria-live="polite">
              <h2>IIA's response</h2>
              {taskSteps.length ? <div className="iia-task-steps"><h4>Task steps completed</h4><ol>{taskSteps.map((step, index) => <li key={`${index}-${step.title}`}>{step.title}</li>)}</ol></div> : null}
              <p className="iia-answer-text">{chatAnswer}</p>
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleInputChange}
            className="iia-file-input"
            aria-label="Choose a PDF to upload"
          />

          <form className="iia-ask-form" onSubmit={handleChatSubmit}>
            <label className="iia-sr-only" htmlFor="iia-chat-message">Ask IIA a question</label>
            <textarea
              id="iia-chat-message"
              disabled={!token || isChatting}
              value={chatMessage}
              onChange={(event) => setChatMessage(event.target.value)}
              maxLength={8000}
              rows={3}
              placeholder={document ? `Ask a question about ${document.originalName}…` : 'Ask anything…'}
              required
            />
            <label className="iia-option-toggle">
              <input type="checkbox" checked={taskMode} onChange={(event) => setTaskMode(event.target.checked)} disabled={!token || isChatting} />
              Multi-step task mode
            </label>
            {document ? (
              <div className="iia-chat-file" role="status">
                <span aria-hidden="true">📄</span>
                <span className="iia-chat-file-name">{document.originalName}</span>
                <button type="button" className="iia-remove-file" onClick={() => setDocument(null)} aria-label="Remove uploaded PDF from chat">Remove</button>
              </div>
            ) : null}
            <div className="iia-chat-input-actions">
              <button type="button" className="iia-chat-upload-button" onClick={() => fileInputRef.current?.click()} disabled={!token || isUploading || isChatting}>
                {isUploading ? 'Uploading PDF…' : '＋ Upload PDF'}
              </button>
              <button type="submit" className="iia-upload-button iia-send-button" disabled={!token || isChatting || isUploading || !chatMessage.trim()}>
                {isChatting ? 'IIA is thinking…' : 'Send to IIA'}
              </button>
            </div>
            {isUploading ? <p className="iia-status" role="status">Uploading and extracting PDF text…</p> : null}
            {error ? <p className="iia-status iia-status-error" role="alert">{error}</p> : null}
            {chatError ? <p className="iia-status iia-status-error" role="alert">{chatError}</p> : null}
          </form>
        </section>

        {document ? (
          <div className="iia-document-card" aria-live="polite">
            <div className="iia-file-pill">PDF uploaded</div>
            <h2>{document.originalName}</h2>
            <dl className="iia-doc-metadata">
              <div>
                <dt>File name</dt>
                <dd>{document.originalName}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{document.mimeType}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(document.size)}</dd>
              </div>
              <div>
                <dt>Extracted text</dt>
                <dd>{typeof document.textCharacters === 'number' ? `${document.textCharacters.toLocaleString()} characters${document.textTruncated ? ' (truncated)' : ''}` : 'Not available'}{typeof document.pagesIndexed === 'number' ? ` · ${document.pagesIndexed} pages indexed` : ''}{document.ocrUsed ? ' · OCR used' : ''}</dd>
              </div>
              <div>
                <dt>Upload date</dt>
                <dd>{new Date(document.uploadedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        ) : null}

      </section>
    </main>
  );
}

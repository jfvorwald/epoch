import './beta.css';

type ReportType = 'bug' | 'idea';
type ReportStatus = 'new' | 'planned' | 'fixed';
type FlightContext = { level: number | null; wave: number | null; ship: string };
type Session = { email: string; isOwner: boolean };
type Submission = FlightContext & { id: string; type: ReportType; title: string; description: string; build: string };
type Report = Submission & { email: string; status: ReportStatus; createdAt: string; userAgent: string };
type NotificationStatus = { configured: boolean; pending: number; sent: number; lastFailure: { code: string; at: string } | null };

export interface BetaFeedbackOptions {
  build: string;
  getContext: () => FlightContext;
  onOpen: () => void;
}

class FeedbackError extends Error {
  constructor(message: string, readonly uncertain = false, readonly authentication = false) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}, format: 'json' | 'text' = 'json'): Promise<T> {
  if (!navigator.onLine) throw new FeedbackError('You’re offline. Reconnect, then try again. Your draft is still here.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, {
      ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { 'Accept': format === 'text' ? 'text/plain' : 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.status === 401 || response.status === 403) {
      throw new FeedbackError('Your staging sign-in has expired or this account no longer has access. Sign in again in another tab, then retry. Your draft is still here.', false, true);
    }
    if (!response.ok) {
      if (response.status === 429) throw new FeedbackError('Too many requests. Wait a moment, then retry. Your draft is still here.');
      if (response.status === 400 || response.status === 413) throw new FeedbackError('The report could not be accepted. Check the title and description lengths, then try again.');
      throw new FeedbackError('Staging could not confirm this request. Please retry. Your draft is still here.', true);
    }
    if (!response.headers.get('content-type')?.includes(format === 'text' ? 'text/plain' : 'application/json')) {
      throw new FeedbackError('Your staging sign-in may have expired. Sign in again in another tab, then retry. Your draft is still here.', true, true);
    }
    return (format === 'text' ? await response.text() : await response.json()) as T;
  } catch (error) {
    if (error instanceof FeedbackError) throw error;
    throw new FeedbackError(navigator.onLine
      ? 'Could not reach staging. Reconnect or sign in again in another tab, then retry. Your draft is still here.'
      : 'You’re offline. Reconnect, then retry. Your draft is still here.', true);
  } finally { window.clearTimeout(timeout); }
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const result = document.createElement(tag);
  result.className = className;
  result.textContent = text;
  return result;
}

function contextLabel(context: FlightContext) {
  return [context.level === null ? 'Main menu' : `Level ${context.level}`, context.wave === null ? '' : `wave ${context.wave}`, context.ship].filter(Boolean).join(' · ');
}

/** This entry point deliberately does nothing on production or preview origins. */
export function setupBetaFeedback(options: BetaFeedbackOptions) {
  if (window.location.hostname !== 'epoch-staging.jaqstudios.com') return;

  const toolbar = element('div', 'beta-toolbar');
  const label = element('span', 'beta-toolbar-label', 'EPOCH / PRIVATE BETA');
  const trigger = element('button', 'beta-trigger', 'Beta feedback ↗');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'beta-dialog');
  toolbar.append(label, trigger);
  document.querySelector('.masthead')?.append(toolbar);
  if (!toolbar.isConnected) document.body.append(toolbar);
  document.body.classList.add('has-beta-feedback');

  const dialog = element('dialog', 'beta-dialog');
  dialog.id = 'beta-dialog';
  dialog.setAttribute('aria-labelledby', 'beta-heading');
  // Only static markup is interpolated here. All remote/user content uses textContent.
  dialog.innerHTML = `
    <header class="beta-header">
      <div><p class="beta-kicker">EPOCH / STAGING ONLY</p><h2 id="beta-heading">Help shape the flight.</h2></div>
      <button type="button" class="beta-close" aria-label="Close beta feedback" autofocus>×</button>
    </header>
    <p class="beta-intro">Found a bug or have an idea? Leave it here for the next build.</p>
    <p class="beta-session" aria-live="polite">Checking your staging sign-in…</p>
    <div class="beta-tabs" role="tablist" aria-label="Beta feedback views">
      <button type="button" role="tab" id="beta-compose-tab" aria-controls="beta-compose" aria-selected="true">Leave feedback</button>
      <button type="button" role="tab" id="beta-reports-tab" aria-controls="beta-reports" aria-selected="false" tabindex="-1">Your reports</button>
    </div>
    <section id="beta-compose" class="beta-content" role="tabpanel" aria-labelledby="beta-compose-tab">
      <form class="beta-form">
        <fieldset class="beta-kind"><legend>What would you like to share?</legend>
          <label><input type="radio" name="beta-type" value="bug" checked><span><b>Bug</b><small>Something went wrong</small></span></label>
          <label><input type="radio" name="beta-type" value="idea"><span><b>Idea</b><small>Something you’d like</small></span></label>
        </fieldset>
        <label class="beta-field" for="beta-title">Title<input id="beta-title" name="title" required maxlength="120" placeholder="A short summary" autocomplete="off"></label>
        <label class="beta-field" for="beta-description">Details<textarea id="beta-description" name="description" required maxlength="4000" rows="5" placeholder="What happened, what you expected, and how we can try it. For an idea, tell us what you’d like and why."></textarea></label>
        <aside class="beta-context"><span>INCLUDED AUTOMATICALLY</span><p class="beta-flight-context"></p><p class="beta-build-context"></p><small>Your signed-in email and browser details are included. Reports are private to you and the beta owner.</small></aside>
        <p class="beta-submit-message" role="status" aria-live="polite" hidden></p>
        <button class="beta-submit" type="submit" disabled>Send feedback <span aria-hidden="true">→</span></button>
        <p class="beta-draft-note">Drafts stay in this tab until sent. A paused flight stays paused when you close feedback.</p>
      </form>
    </section>
    <section id="beta-reports" class="beta-content" role="tabpanel" aria-labelledby="beta-reports-tab" hidden>
      <div class="beta-inbox-heading"><h3>Your reports</h3><div class="beta-inbox-actions"><button type="button" class="beta-view" aria-expanded="false" aria-controls="beta-markdown" hidden>View Markdown</button><a class="beta-download" href="/api/beta/feedback.md" download="epoch-beta-feedback.md" hidden>Download Markdown</a><button type="button" class="beta-refresh">Refresh</button></div></div>
      <p class="beta-notifications" role="status" aria-live="polite" hidden></p>
      <p class="beta-list-message" role="status" aria-live="polite"></p>
      <pre id="beta-markdown" class="beta-markdown" role="region" aria-label="Markdown inbox" tabindex="0" hidden></pre>
      <div class="beta-report-list"></div>
      <section class="beta-roster" aria-label="Beta testers" hidden><h3>Beta testers</h3><p>These Google accounts can join this staging beta.</p><ul></ul></section>
    </section>
    <footer class="beta-footer"><span>PRIVATE TEST FLIGHT</span><a class="beta-sign-in" href="/" target="_blank" rel="noopener">Sign in again ↗</a></footer>`;
  document.body.append(dialog);
  const query = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const form = query<HTMLFormElement>('form');
  const title = query<HTMLInputElement>('#beta-title');
  const description = query<HTMLTextAreaElement>('#beta-description');
  const submit = query<HTMLButtonElement>('.beta-submit');
  const submitMessage = query<HTMLParagraphElement>('.beta-submit-message');
  const sessionLabel = query<HTMLParagraphElement>('.beta-session');
  const listMessage = query<HTMLParagraphElement>('.beta-list-message');
  const notificationMessage = query<HTMLParagraphElement>('.beta-notifications');
  const reportList = query<HTMLDivElement>('.beta-report-list');
  const roster = query<HTMLElement>('.beta-roster');
  const refresh = query<HTMLButtonElement>('.beta-refresh');
  const viewMarkdown = query<HTMLButtonElement>('.beta-view');
  const markdown = query<HTMLPreElement>('.beta-markdown');
  let markdownGeneration = 0;
  let notificationGeneration = 0;
  const tabs = [query<HTMLButtonElement>('#beta-compose-tab'), query<HTMLButtonElement>('#beta-reports-tab')];
  const panels = [query<HTMLElement>('#beta-compose'), query<HTMLElement>('#beta-reports')];
  let session: Session | undefined;
  let context: FlightContext | undefined;
  let pendingSubmission: Submission | undefined;
  let submitting = false;
  let refreshing = false;
  let activeTab = 0;

  function message(target: HTMLElement, text: string, isError = false) {
    target.textContent = text;
    target.hidden = !text;
    target.classList.toggle('beta-error', isError);
  }
  function setFormState() {
    for (const input of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) input.disabled = submitting || !!pendingSubmission;
    submit.disabled = !session || submitting || refreshing;
    submit.replaceChildren(document.createTextNode(submitting ? 'Sending…' : pendingSubmission ? 'Retry submission' : 'Send feedback'), element('span', '', '→'));
  }
  function setSession(next?: Session) {
    resetMarkdown();
    notificationGeneration++;
    message(notificationMessage, '');
    session = next;
    sessionLabel.textContent = next ? `Signed in as ${next.email}` : 'Sign in to staging to send and view feedback.';
    tabs[1].textContent = next?.isOwner ? 'Beta inbox' : 'Your reports';
    query<HTMLElement>('.beta-inbox-heading h3').textContent = next?.isOwner ? 'Beta inbox' : 'Your reports';
    query<HTMLAnchorElement>('.beta-download').hidden = !next?.isOwner;
    viewMarkdown.hidden = !next?.isOwner;
    if (!next?.isOwner) { roster.hidden = true; roster.querySelector('ul')!.replaceChildren(); }
    setFormState();
  }
  async function loadNotifications(identity: Session) {
    if (!identity.isOwner) return;
    const generation = ++notificationGeneration;
    const isCurrentOwner = () => generation === notificationGeneration && session?.isOwner && session.email === identity.email;
    const destination = `Email to ${identity.email}`;
    message(notificationMessage, `${destination} · Checking delivery status…`);
    try {
      const status = await request<NotificationStatus>('/api/beta/notifications');
      if (!isCurrentOwner()) return;
      if (typeof status.configured !== 'boolean' || !Number.isSafeInteger(status.pending) || status.pending < 0 || !Number.isSafeInteger(status.sent) || status.sent < 0) {
        throw new Error('Invalid notification status');
      }
      const details = status.configured
        ? `${status.pending} queued · ${status.sent} accepted for delivery${status.lastFailure ? ' · Delivery delayed; retry scheduled' : ''}`
        : `Setup needed · ${status.pending} queued`;
      message(notificationMessage, `${destination} · ${details}`, !status.configured || !!status.lastFailure);
    } catch {
      // Reports remain usable even when the separate mail status request fails.
      if (isCurrentOwner()) message(notificationMessage, `${destination} · Delivery status unavailable. Reports are still saved here.`, true);
    }
  }
  function resetMarkdown() {
    markdownGeneration++;
    markdown.textContent = '';
    markdown.hidden = true;
    viewMarkdown.textContent = 'View Markdown';
    viewMarkdown.setAttribute('aria-expanded', 'false');
  }
  function handleError(error: unknown, target: HTMLElement) {
    const known = error instanceof FeedbackError ? error : new FeedbackError('Something went wrong. Please retry. Your draft is still here.', true);
    message(target, known.message, true);
    if (known.authentication) { setSession(); reportList.replaceChildren(); }
    return known;
  }
  function showContext() {
    query<HTMLElement>('.beta-flight-context').textContent = contextLabel(context ?? options.getContext());
    query<HTMLElement>('.beta-build-context').textContent = `Build ${options.build}`;
  }
  function showTab(index: number, focus = false) {
    activeTab = index;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; panels[i].hidden = i !== index; });
    if (focus) tabs[index].focus();
  }
  function renderReports(reports: Report[], testers?: string[]) {
    reportList.replaceChildren();
    const visible = session?.isOwner ? reports : reports.filter(report => report.email === session?.email);
    for (const report of visible) {
      const article = element('article', 'beta-report');
      const heading = element('div', 'beta-report-heading');
      heading.append(element('span', `beta-report-type ${report.type}`, report.type === 'idea' ? 'IDEA' : 'BUG'), element('span', `beta-status ${report.status}`, report.status));
      article.append(heading, element('h4', '', report.title), element('p', 'beta-report-description', report.description));
      const date = new Date(report.createdAt);
      article.append(element('p', 'beta-report-meta', `${Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${session?.isOwner ? ` · ${report.email}` : ''}`));
      article.append(element('p', 'beta-report-meta', `${contextLabel(report)} · ${report.build}`));
      if (session?.isOwner) {
        const statusLabel = element('label', 'beta-status-control', 'Status');
        const status = element('select');
        status.setAttribute('aria-label', `Status for ${report.title}`);
        for (const value of ['new', 'planned', 'fixed'] as const) {
          const option = element('option', '', value[0].toUpperCase() + value.slice(1)); option.value = value; status.append(option);
        }
        status.value = report.status;
        status.addEventListener('change', async () => {
          const value = status.value as ReportStatus;
          status.disabled = true;
          try {
            const result = await request<{ id: string; status: ReportStatus }>(`/api/beta/feedback/${encodeURIComponent(report.id)}`, { method: 'PATCH', body: JSON.stringify({ status: value }) });
            if (result.id !== report.id || result.status !== value) throw new FeedbackError('Staging could not confirm the status change. Refresh to check it.', true);
            report.status = result.status;
            resetMarkdown();
            const badge = article.querySelector('.beta-status')!; badge.textContent = report.status; badge.className = `beta-status ${report.status}`;
            message(listMessage, 'Status updated.');
          } catch (error) { status.value = report.status; handleError(error, listMessage); }
          finally { status.disabled = false; }
        });
        statusLabel.append(status); article.append(statusLabel);
      }
      reportList.append(article);
    }
    if (!visible.length) reportList.append(element('p', 'beta-empty', 'No reports yet. Your next flight might spark the first one.'));
    roster.hidden = !session?.isOwner;
    roster.querySelector('ul')!.replaceChildren();
    if (session?.isOwner) for (const email of testers ?? []) roster.querySelector('ul')!.append(element('li', '', email));
  }
  async function loadReports() {
    if (refreshing) return;
    refreshing = true;
    refresh.disabled = true;
    setFormState();
    message(listMessage, 'Loading feedback…');
    try {
      const identity = await request<Session>('/api/beta/session');
      if (typeof identity.email !== 'string' || typeof identity.isOwner !== 'boolean') throw new FeedbackError('Could not confirm your staging sign-in. Sign in again, then retry.', false, true);
      if (session?.email !== identity.email) reportList.replaceChildren();
      setSession(identity);
      void loadNotifications(identity);
      const data = await request<{ reports: Report[]; testers?: string[] }>('/api/beta/feedback');
      if (!Array.isArray(data.reports)) throw new FeedbackError('Could not load feedback. Please retry.');
      renderReports(data.reports, data.testers);
      message(listMessage, '');
    } catch (error) { handleError(error, listMessage); if (!session) sessionLabel.textContent = listMessage.textContent; }
    finally { refreshing = false; refresh.disabled = false; setFormState(); }
  }
  function open() {
    if (dialog.open) return;
    options.onOpen();
    if (!context || (!title.value && !description.value && !pendingSubmission)) context = options.getContext();
    showContext();
    dialog.showModal();
    query<HTMLButtonElement>('.beta-close').focus({ preventScroll: true });
    // The game's pause overlay schedules focus on its next frame; restore focus
    // inside this modal after that callback, without opening a mobile keyboard.
    window.requestAnimationFrame(() => { if (dialog.open && !dialog.contains(document.activeElement)) query<HTMLButtonElement>('.beta-close').focus({ preventScroll: true }); });
    void loadReports();
  }
  function close() {
    dialog.close();
    trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', open);
  query<HTMLButtonElement>('.beta-close').addEventListener('click', close);
  // Restore focus during native Escape cancellation, before a following Tab.
  // The dialog's asynchronously queued close event must not steal it back later.
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  // Preserve native form editing and native dialog Escape/Tab behavior while
  // preventing the game's global Phaser and pause shortcuts from receiving keys.
  for (const name of ['keydown', 'keyup', 'keypress']) dialog.addEventListener(name, event => event.stopPropagation());
  for (const name of ['keydown', 'keyup']) trigger.addEventListener(name, event => {
    if ((event as KeyboardEvent).key !== 'Tab') event.stopPropagation();
  });
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showTab(index));
    tab.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); showTab(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - activeTab, true);
      }
    });
  });
  refresh.addEventListener('click', () => void loadReports());
  viewMarkdown.addEventListener('click', async () => {
    if (!session?.isOwner) return;
    if (!markdown.hidden) { resetMarkdown(); return; }
    const generation = ++markdownGeneration;
    viewMarkdown.disabled = true;
    message(listMessage, 'Loading Markdown…');
    try {
      const text = await request<string>('/api/beta/feedback.md?view=1', {}, 'text');
      if (generation !== markdownGeneration || !session?.isOwner) return;
      markdown.textContent = text;
      markdown.hidden = false;
      viewMarkdown.textContent = 'Hide Markdown';
      viewMarkdown.setAttribute('aria-expanded', 'true');
      message(listMessage, '');
    } catch (error) { if (generation === markdownGeneration) handleError(error, listMessage); }
    finally { viewMarkdown.disabled = false; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !session || !form.reportValidity()) return;
    const retryingUncertainSubmission = !!pendingSubmission;
    const attempt = pendingSubmission ?? {
      id: crypto.randomUUID(), type: query<HTMLInputElement>('[name="beta-type"]:checked').value as ReportType,
      title: title.value.trim(), description: description.value.trim(), build: options.build.slice(0, 80), ...(context ?? options.getContext()),
    };
    if (!attempt.title || !attempt.description) { message(submitMessage, 'Please add a title and some details before sending.', true); return; }
    pendingSubmission = attempt;
    submitting = true;
    message(submitMessage, '');
    setFormState();
    try {
      const result = await request<{ id: string }>('/api/beta/feedback', { method: 'POST', body: JSON.stringify(attempt) });
      if (result.id !== attempt.id) throw new FeedbackError('Staging could not confirm your submission. Retry to check it without sending a duplicate.', true);
      pendingSubmission = undefined;
      form.reset();
      context = undefined;
      message(submitMessage, 'Feedback sent. Thank you for helping shape EPOCH.');
      void loadReports();
    } catch (error) {
      const failure = handleError(error, submitMessage);
      if (!failure.uncertain && !retryingUncertainSubmission) pendingSubmission = undefined;
      else message(submitMessage, `${failure.message} Use Retry submission to safely confirm the same report.`, true);
    } finally { submitting = false; setFormState(); }
  });
  return { open, isOpen: () => dialog.open };
}

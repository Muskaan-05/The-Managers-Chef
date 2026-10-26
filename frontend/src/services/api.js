/**
 * Centralized API service layer for The Manager's Chef Frontend
 * Connects directly to the FastAPI + SQLAlchemy + Supabase backend.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function getToken() {
  return localStorage.getItem('tmc_auth_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('tmc_auth_token', token);
  } else {
    localStorage.removeItem('tmc_auth_token');
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('tmc_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('tmc_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('tmc_user');
  }
}

export function clearAuth() {
  localStorage.removeItem('tmc_auth_token');
  localStorage.removeItem('tmc_user');
  localStorage.removeItem('tmc_default_context_id');
}

export function logout() {
  clearAuth();
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new Error('Network error: Unable to connect to the backend server.');
  }

  if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/signup')) {
    clearAuth();
    window.dispatchEvent(new CustomEvent('tmc-auth-expired'));
    throw new Error('Session expired. Please sign in again.');
  }

  if (response.status === 204) {
    return null;
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorDetail = (data && typeof data === 'object' && (data.detail || data.message))
      ? data.detail || data.message
      : (typeof data === 'string' && data ? data : `Request failed with status ${response.status}`);
    throw new Error(errorDetail);
  }

  return data;
}

// -------------------------------------------------------------
// Auth Services
// -------------------------------------------------------------

export async function login(email, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  const token = res?.session?.access_token || res?.access_token || res?.token;
  if (!token) {
    throw new Error('Invalid response from login: Missing access token.');
  }

  setToken(token);

  let user = res?.user || res?.session?.user;
  try {
    const me = await getMe();
    if (me) user = me;
  } catch {
    // fallback to user from auth response
  }

  setStoredUser(user);
  return { token, user };
}

export async function signup(name, email, password, timezone = 'UTC') {
  const res = await request('/api/auth/signup', {
    method: 'POST',
    body: { name, email, password, timezone },
  });

  const token = res?.session?.access_token || res?.access_token || res?.token;
  if (token) {
    setToken(token);
    let user = res?.user || res?.session?.user;
    try {
      const me = await getMe();
      if (me) user = me;
    } catch {
      // fallback
    }
    setStoredUser(user);
    return { token, user, requiresConfirmation: false };
  }

  return { token: null, user: res?.user, requiresConfirmation: true };
}

export async function getMe() {
  const user = await request('/api/auth/me', { method: 'GET' });
  if (user) {
    setStoredUser(user);
  }
  return user;
}

// -------------------------------------------------------------
// Context Services
// -------------------------------------------------------------

export async function getContexts() {
  const res = await request('/api/context', { method: 'GET' });
  return res?.contexts || [];
}

export async function createContext(payload) {
  return await request('/api/context', {
    method: 'POST',
    body: payload,
  });
}

export async function ensureDefaultContext() {
  try {
    const cachedId = localStorage.getItem('tmc_default_context_id');
    if (cachedId) return cachedId;

    const contexts = await getContexts();
    if (contexts && contexts.length > 0) {
      localStorage.setItem('tmc_default_context_id', contexts[0].id);
      return contexts[0].id;
    }

    const newContext = await createContext({
      name: 'General',
      description: 'Default manager context',
    });
    if (newContext?.id) {
      localStorage.setItem('tmc_default_context_id', newContext.id);
      return newContext.id;
    }
  } catch (err) {
    console.warn('Could not ensure default context:', err);
  }
  return null;
}

export async function searchContext(query = '', type = null, contextId = null) {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (type) params.append('type', type);
  if (contextId) params.append('context_id', contextId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/api/context/search${qs}`, { method: 'GET' });
  return res?.results || [];
}

export async function createContextItem(item) {
  return await request('/api/context/items', {
    method: 'POST',
    body: item,
  });
}

// -------------------------------------------------------------
// Dashboard Service
// -------------------------------------------------------------

export async function getDashboard() {
  return await request('/api/dashboard', { method: 'GET' });
}

// -------------------------------------------------------------
// Task Services
// -------------------------------------------------------------

export async function getTasks(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.context_id) query.append('context_id', params.context_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await request(`/api/tasks${qs}`, { method: 'GET' });
  return res?.tasks || [];
}

export async function createTask(payload) {
  return await request('/api/tasks', {
    method: 'POST',
    body: payload,
  });
}

export async function updateTask(taskId, updates) {
  return await request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteTask(taskId) {
  return await request(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Meeting Services
// -------------------------------------------------------------

export async function getMeetings(params = {}) {
  const query = new URLSearchParams();
  if (params.context_id) query.append('context_id', params.context_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await request(`/api/meetings${qs}`, { method: 'GET' });
  return res?.meetings || [];
}

export async function getMeeting(meetingId) {
  return await request(`/api/meetings/${meetingId}`, { method: 'GET' });
}

export async function createMeeting(payload) {
  return await request('/api/meetings', {
    method: 'POST',
    body: payload,
  });
}

export async function updateMeeting(meetingId, updates) {
  return await request(`/api/meetings/${meetingId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteMeeting(meetingId) {
  return await request(`/api/meetings/${meetingId}`, {
    method: 'DELETE',
  });
}

export async function joinMeeting(meetingId, meetLink) {
  return await request(`/api/meetings/${meetingId}/join`, {
    method: 'POST',
    body: { meet_link: meetLink },
  });
}

export async function endMeeting(meetingId) {
  return await request(`/api/meetings/${meetingId}/end`, {
    method: 'POST',
  });
}

export async function submitMeetingTranscript(meetingId, transcript) {
  return await request(`/api/meetings/${meetingId}/transcript`, {
    method: 'POST',
    body: { transcript },
  });
}

export async function summarizeMeeting(meetingId, transcript) {
  return await request(`/api/meetings/${meetingId}/summarize`, {
    method: 'POST',
    body: { transcript },
  });
}

// -------------------------------------------------------------
// Event Services (Calendar Events)
// -------------------------------------------------------------

export async function getEvents(params = {}) {
  const query = new URLSearchParams();
  if (params.start) query.append('start', params.start);
  if (params.end) query.append('end', params.end);
  if (params.context_id) query.append('context_id', params.context_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await request(`/api/events${qs}`, { method: 'GET' });
  return res?.events || [];
}

export async function createEvent(payload) {
  return await request('/api/events', {
    method: 'POST',
    body: payload,
  });
}

export async function updateEvent(eventId, updates) {
  return await request(`/api/events/${eventId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteEvent(eventId) {
  return await request(`/api/events/${eventId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Decision Services
// -------------------------------------------------------------

export async function getDecisions(params = {}) {
  const query = new URLSearchParams();
  if (params.context_id) query.append('context_id', params.context_id);
  if (params.meeting_id) query.append('meeting_id', params.meeting_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await request(`/api/decisions${qs}`, { method: 'GET' });
  return res?.decisions || [];
}

export async function createDecision(payload) {
  return await request('/api/decisions', {
    method: 'POST',
    body: payload,
  });
}

export async function deleteDecision(decisionId) {
  return await request(`/api/decisions/${decisionId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Google Calendar Integration Services
// -------------------------------------------------------------

export async function getGoogleStatus() {
  return await request('/api/integrations/google/status', { method: 'GET' });
}

export async function getGoogleConnectUrl() {
  return await request('/api/integrations/google/connect', { method: 'GET' });
}

export async function syncGoogleCalendar(contextId = null) {
  const body = contextId ? { context_id: contextId } : {};
  return await request('/api/integrations/google/sync', {
    method: 'POST',
    body,
  });
}

export async function disconnectGoogle() {
  return await request('/api/integrations/google', {
    method: 'DELETE',
  });
}


export async function getDecision(decisionId) {
  return await request(`/api/decisions/${decisionId}`, { method: 'GET' });
}

export async function updateDecision(decisionId, updates) {
  return await request(`/api/decisions/${decisionId}`, {
    method: 'PATCH',
    body: updates,
  });
}

// -------------------------------------------------------------
// Commitment Services
// -------------------------------------------------------------

export async function getCommitments(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.context_id) query.append('context_id', params.context_id);
  if (params.meeting_id) query.append('meeting_id', params.meeting_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await request(`/api/commitments${qs}`, { method: 'GET' });
  return res?.commitments || [];
}

export async function getCommitment(commitmentId) {
  return await request(`/api/commitments/${commitmentId}`, { method: 'GET' });
}

export async function updateCommitment(commitmentId, updates) {
  return await request(`/api/commitments/${commitmentId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteCommitment(commitmentId) {
  return await request(`/api/commitments/${commitmentId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Reminder Services
// -------------------------------------------------------------

export async function getReminders(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await request(`/api/reminders${qs}`, { method: 'GET' });
  return res?.reminders || [];
}

export async function createReminder(payload) {
  return await request('/api/reminders', {
    method: 'POST',
    body: payload,
  });
}

export async function updateReminder(reminderId, updates) {
  return await request(`/api/reminders/${reminderId}`, {
    method: 'PATCH',
    body: updates,
  });
}

export async function deleteReminder(reminderId) {
  return await request(`/api/reminders/${reminderId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// Meeting AI Pipeline Trigger
// -------------------------------------------------------------

export async function processMeetingAI(meetingId) {
  return await request(`/api/meetings/${meetingId}/process`, {
    method: 'POST',
  });
}

// -------------------------------------------------------------
// Event Bot Launch Service
// -------------------------------------------------------------

export async function launchBotForEvent(eventId) {
  return await request(`/api/events/${eventId}/join_bot`, {
    method: 'POST',
  });
}



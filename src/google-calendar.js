// Minimal Google Calendar API client for the Pet Clinic calendar sync.
// Credentials come from project app settings; the client secret and refresh token are
// secret settings, which YouTrack only lets us use inside HTTP request parameters.
const http = require('@jetbrains/youtrack-scripting-api/http');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_URL = 'https://www.googleapis.com/calendar/v3';

const isConfigured = (settings) => !!(settings && settings.googleClientId &&
  settings.googleClientSecret && settings.googleRefreshToken);

const calendarPath = (settings) =>
  '/calendars/' + encodeURIComponent(settings.googleCalendarId || 'primary') + '/events';

function failure(step, response) {
  const code = response ? response.code : 'no response';
  const body = response && response.response ? String(response.response).substring(0, 300) : '';
  return new Error(step + ' failed (' + code + ')' + (body ? ': ' + body : ''));
}

// Exchanges the stored refresh token for a short-lived access token.
function getAccessToken(settings) {
  const connection = new http.Connection(TOKEN_URL);
  // With no payload, the parameters are sent as a form body.
  const response = connection.postSync('', {
    grant_type: 'refresh_token',
    client_id: settings.googleClientId,
    client_secret: settings.googleClientSecret,
    refresh_token: settings.googleRefreshToken
  });
  if (!response || !response.isSuccess) {
    throw failure('Google token refresh', response);
  }
  return response.json().access_token;
}

function api(accessToken) {
  const connection = new http.Connection(API_URL);
  connection.bearerAuth(accessToken);
  connection.addHeader('Content-Type', 'application/json');
  return connection;
}

// Creates the event, or updates it when eventId is set. Returns the event ID.
// Attendees get invitations and updates by email (sendUpdates=all).
function upsertEvent(settings, accessToken, eventId, event) {
  const connection = api(accessToken);
  const params = {sendUpdates: 'all'};
  if (eventId) {
    const updated = connection.patchSync(calendarPath(settings) + '/' + encodeURIComponent(eventId),
      params, JSON.stringify(event));
    if (updated && updated.isSuccess) {
      return eventId;
    }
    // 404/410: the event was removed in Google Calendar, so create a new one.
    if (!updated || (updated.code !== 404 && updated.code !== 410)) {
      throw failure('Google Calendar update', updated);
    }
  }
  const created = connection.postSync(calendarPath(settings), params, JSON.stringify(event));
  if (!created || !created.isSuccess) {
    throw failure('Google Calendar create', created);
  }
  return created.json().id;
}

// Cancels the event and notifies attendees. A missing event counts as success.
function deleteEvent(settings, accessToken, eventId) {
  const response = api(accessToken).deleteSync(
    calendarPath(settings) + '/' + encodeURIComponent(eventId), {sendUpdates: 'all'});
  if (response && (response.isSuccess || response.code === 404 || response.code === 410)) {
    return;
  }
  throw failure('Google Calendar delete', response);
}

exports.isConfigured = isConfigured;
exports.getAccessToken = getAccessToken;
exports.upsertEvent = upsertEvent;
exports.deleteEvent = deleteEvent;

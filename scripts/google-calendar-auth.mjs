#!/usr/bin/env node
// One-time Google sign-in for the Pet Clinic calendar sync.
//
// Opens the Google consent page, receives the authorization code on localhost, exchanges it for a
// refresh token, and stores client ID, client secret and refresh token in the app's PET project
// settings through `youtrack-app app settings-set`. Secrets are never printed.
//
// Prerequisites:
//   - In Google Cloud Console, add this Authorized redirect URI to the OAuth web client:
//       http://localhost:8765/oauth2callback
//   - Enable the Google Calendar API for the Google Cloud project.
//   - If the consent screen is in Testing mode, add the clinic calendar account as a test user.
//   - YOUTRACK_HOST (or --host) and YOUTRACK_TOKEN (or YOUTRACK_API_TOKEN) are set. The script checks the
//     YouTrack connection before opening Google, so the sign-in is never wasted.
//
// Usage:
//   node scripts/google-calendar-auth.mjs <path-to-client_secret.json> [--account clinic@example.com]
//     [--host https://your.youtrack.cloud] [--project PET] [--calendar primary]
//
// Google always shows the account chooser, so you can pick the right account even if the browser
// is signed in with another one. --account pre-selects that account.

import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {randomBytes} from 'node:crypto';

const APP = 'pet-clinic-care-tags';
const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const secretPath = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const project = option('--project', 'PET');
const calendarId = option('--calendar', 'primary');
const account = option('--account', null);
const host = option('--host', process.env.YOUTRACK_HOST);
const hasToken = !!(process.env.YOUTRACK_TOKEN || process.env.YOUTRACK_API_TOKEN);

if (!secretPath) {
  console.error('Usage: node scripts/google-calendar-auth.mjs <client_secret.json> [--account email] [--project PET] [--calendar primary]');
  process.exit(1);
}

const file = JSON.parse(readFileSync(secretPath, 'utf8'));
const client = file.web || file.installed;
if (!client || !client.client_id || !client.client_secret) {
  console.error('The file does not look like a Google OAuth client secret file.');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl = new URL(client.auth_uri || 'https://accounts.google.com/o/oauth2/auth');
authUrl.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  // Always show the account chooser, then the consent screen (needed to get a refresh token).
  prompt: 'select_account consent',
  state,
  ...(account ? {login_hint: account} : {})
}).toString();

const youtrackApp = (cliArgs) => new Promise((resolve, reject) => {
  execFile('youtrack-app', [...cliArgs, '--host', host],
    (error, stdout, stderr) => (error ? reject(new Error((stderr || error.message).trim())) : resolve(stdout)));
});

const saveSettings = (refreshToken) => {
  const settings = JSON.stringify({
    googleClientId: client.client_id,
    googleClientSecret: client.client_secret,
    googleRefreshToken: refreshToken,
    googleCalendarId: calendarId
  });
  return youtrackApp(['app', 'settings-set', '--app', APP, '--project', project, '--settings', settings]);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404).end();
    return;
  }
  const finish = (code, message) => {
    res.writeHead(code, {'Content-Type': 'text/plain; charset=utf-8'}).end(message);
    server.close();
  };
  if (url.searchParams.get('state') !== state) {
    finish(400, 'State mismatch. Start the script again.');
    process.exitCode = 1;
    return;
  }
  if (url.searchParams.get('error')) {
    const error = url.searchParams.get('error');
    const hint = error === 'access_denied' ?
      ' Access was denied. If the OAuth consent screen is in Testing mode, the account you picked must be listed ' +
      'as a test user (Google Cloud Console > Google Auth Platform > Audience > Test users), or pick another account.' : '';
    finish(400, `Google returned: ${error}.${hint}`);
    console.error(`Sign-in failed: ${error}.${hint}`);
    process.exitCode = 1;
    return;
  }
  try {
    const tokenResponse = await fetch(client.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code: url.searchParams.get('code'),
        client_id: client.client_id,
        client_secret: client.client_secret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) {
      throw new Error(tokens.error_description || tokens.error || 'No refresh token returned');
    }
    await saveSettings(tokens.refresh_token);
    finish(200, 'Google Calendar is connected to YouTrack. You can close this tab.');
    console.log(`Done. Google Calendar settings saved for ${APP} in project ${project} (calendar: ${calendarId}).`);
  } catch (e) {
    finish(500, 'Could not finish the sign-in. See the terminal for details.');
    console.error(`Could not finish the sign-in: ${e.message}`);
    process.exitCode = 1;
  }
});

if (!host || !hasToken) {
  console.error('YouTrack is not configured in this terminal. Set it first, then run the script again:\n\n' +
    '  export YOUTRACK_HOST=https://your.youtrack.cloud\n' +
    '  export YOUTRACK_TOKEN=<permanent token with app admin rights>\n');
  process.exit(1);
}
try {
  await youtrackApp(['app', 'settings', '--app', APP, '--project', project]);
} catch (e) {
  console.error(`Cannot reach app ${APP} in project ${project} on ${host}: ${e.message}`);
  process.exit(1);
}
console.log(`YouTrack connection OK (${host}, project ${project}).`);

server.listen(PORT, () => {
  console.log('Opening the Google consent page. If it does not open, visit:\n');
  console.log(authUrl.toString() + '\n');
  execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [authUrl.toString()], () => {});
});

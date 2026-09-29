const entities = require('@jetbrains/youtrack-scripting-api/entities');
const dateTime = require('@jetbrains/youtrack-scripting-api/date-time');
const calendar = require('./google-calendar');

const SYNC_DELAY_MS = 2 * 60 * 1000; // wait 2 minutes so quick back-and-forth edits collapse into one update
const RETRY_DELAY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WATCHED = ['Next visit', 'Visit status', 'Responsible doctor', 'Owner email', 'Owner name'];

// Same key per pet: a newer change replaces the pending sync instead of adding another one.
// Retries use their own key, because re-using the key of the running job cancels that job.
const scheduleSync = (ctx, issue, attempt, delay) => {
  ctx.store('issue', issue);
  ctx.store('attempt', attempt);
  const key = (attempt > 1 ? 'calendar-retry-' : 'calendar-sync-') + issue.id;
  ctx.invokeAsync('syncCalendar', delay, key);
};

const validEmail = (value) => {
  const email = (value || '').trim();
  return EMAIL_PATTERN.test(email) ? email : null;
};

function buildEvent(issue) {
  const nextVisit = issue.fields['Next visit'];
  const doctor = issue.fields['Responsible doctor'];
  const ownerName = issue.fields['Owner name'];
  const ownerEmail = validEmail(issue.fields['Owner email']);
  const doctorEmail = doctor ? validEmail(doctor.email) : null;
  const status = issue.fields['Visit status'];

  const attendees = [];
  if (doctorEmail) {
    attendees.push({email: doctorEmail, displayName: doctor.fullName});
  }
  if (ownerEmail && ownerEmail !== doctorEmail) {
    attendees.push({email: ownerEmail, displayName: ownerName || undefined});
  }

  // "Next visit" is a date-only field, so the appointment is an all-day event on that day.
  const day = dateTime.format(nextVisit, 'yyyy-MM-dd', 'UTC');
  const nextDay = dateTime.format(nextVisit + DAY_MS, 'yyyy-MM-dd', 'UTC');

  return {
    event: {
      summary: issue.project.name + ' visit: ' + issue.summary,
      description: 'Pet record: ' + issue.url + '\n' +
        'Responsible doctor: ' + (doctor ? doctor.fullName : 'not assigned') + '\n' +
        'Owner: ' + (ownerName || 'unknown') + '\n' +
        'Visit status: ' + (status ? status.name : 'not set'),
      start: {date: day},
      end: {date: nextDay},
      attendees: attendees,
      extendedProperties: {private: {youtrackIssue: issue.id}}
    },
    missing: (doctorEmail ? [] : ['doctor email']).concat(ownerEmail ? [] : ['owner email'])
  };
}

exports.rule = entities.Issue.onChange({
  title: 'Sync appointments to Google Calendar (2-minute delay)',
  guard: (ctx) => {
    const issue = ctx.issue;
    if (!issue.isReported) {
      return false;
    }
    if (issue.becomesReported) {
      return !!issue.fields['Next visit'];
    }
    return WATCHED.some((name) => issue.fields.isChanged(name));
  },
  action: (ctx) => {
    scheduleSync(ctx, ctx.issue, 1, SYNC_DELAY_MS);
  },
  asyncFunctions: {
    syncCalendar: (ctx) => {
      // Use ctx.issue: an issue restored with ctx.load() cannot read custom fields in async functions.
      const issue = ctx.issue;
      const attempt = ctx.load('attempt') || 1;
      if (!issue) {
        return;
      }
      if (!calendar.isConfigured(ctx.settings)) {
        console.warn('Calendar sync skipped for ' + issue.id + ': Google Calendar settings are not configured');
        return;
      }

      // Read the record as it is now, after any quick follow-up edits.
      const eventId = issue.extensionProperties.calendarEventId || null;
      const status = issue.fields['Visit status'];
      const cancelled = !issue.fields['Next visit'] || (status && status.name === 'Cancelled');

      try {
        const token = calendar.getAccessToken(ctx.settings);
        if (cancelled) {
          if (eventId) {
            calendar.deleteEvent(ctx.settings, token, eventId);
            issue.extensionProperties.calendarEventId = null;
            console.log('Calendar event cancelled for ' + issue.id);
          }
          return;
        }
        const built = buildEvent(issue);
        const newId = calendar.upsertEvent(ctx.settings, token, eventId, built.event);
        if (newId !== eventId) {
          issue.extensionProperties.calendarEventId = newId;
        }
        console.log('Calendar event ' + (eventId ? 'updated' : 'created') + ' for ' + issue.id + ' on ' +
          built.event.start.date + ' with ' + built.event.attendees.length + ' attendee(s)' +
          (built.missing.length ? '; missing: ' + built.missing.join(', ') : ''));
      } catch (e) {
        console.error('Calendar sync failed for ' + issue.id + ' (attempt ' + attempt + '): ' + e.message);
        if (attempt < MAX_ATTEMPTS) {
          scheduleSync(ctx, issue, attempt + 1, RETRY_DELAY_MS);
        }
      }
    }
  },
  requirements: {
    NextVisit: {type: entities.Field.dateType, name: 'Next visit'},
    VisitStatus: {type: entities.EnumField.fieldType, name: 'Visit status', Cancelled: {}},
    ResponsibleDoctor: {type: entities.User.fieldType, name: 'Responsible doctor'},
    OwnerName: {type: entities.Field.stringType, name: 'Owner name'},
    OwnerEmail: {type: entities.Field.stringType, name: 'Owner email'}
  }
});

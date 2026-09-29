const entities = require('@jetbrains/youtrack-scripting-api/entities');
const notifications = require('@jetbrains/youtrack-scripting-api/notifications');
const dateTime = require('@jetbrains/youtrack-scripting-api/date-time');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Summaries look like "Max (Dog, Golden Retriever)"; the pet name is the part before the brackets.
const petName = (summary) => summary.split(' (')[0].trim() || summary;

const isCompleted = (ctx) => {
  const status = ctx.issue.fields[ctx.VisitStatus.name];
  return !!status && status.name === ctx.VisitStatus.Completed.name;
};

// Next visit is planned when it is set to today or a later day.
const isNextVisitPlanned = (ctx) => {
  const nextVisit = ctx.issue.fields[ctx.NextVisit.name];
  if (!nextVisit) {
    return false;
  }
  return dateTime.format(nextVisit, 'yyyy-MM-dd', 'UTC') >= dateTime.format(Date.now(), 'yyyy-MM-dd', 'UTC');
};

exports.rule = entities.Issue.onChange({
  title: 'Thank the owner when a visit is completed and the next visit is planned',
  guard: (ctx) => {
    const fields = ctx.issue.fields;
    return ctx.issue.isReported &&
      (fields.isChanged(ctx.VisitStatus.name) || fields.isChanged(ctx.NextVisit.name));
  },
  action: (ctx) => {
    const issue = ctx.issue;

    // A new visit cycle starts whenever the visit status moves away from Completed.
    if (!isCompleted(ctx)) {
      if (issue.extensionProperties.thankYouSent) {
        issue.extensionProperties.thankYouSent = false;
      }
      return;
    }
    // Send once per completed visit, as soon as the next visit is planned.
    if (issue.extensionProperties.thankYouSent || !isNextVisitPlanned(ctx)) {
      return;
    }

    const ownerEmail = (issue.fields[ctx.OwnerEmail.name] || '').trim();
    if (!EMAIL_PATTERN.test(ownerEmail)) {
      console.warn('Thank-you email skipped for ' + issue.id + ': owner email missing or invalid');
      return;
    }

    const name = petName(issue.summary);
    const owner = issue.fields[ctx.OwnerName.name];
    const doctor = issue.fields[ctx.ResponsibleDoctor.name];
    const doctorName = doctor ? doctor.fullName : 'our team';
    const nextVisit = dateTime.format(issue.fields[ctx.NextVisit.name], 'EEEE, d MMMM yyyy', 'UTC');
    const clinic = issue.project.name;

    const body =
      '<div style="font-family: sans-serif; font-size: 14px; line-height: 1.5">' +
      '<p>Dear ' + escapeHtml(owner || 'pet owner') + ',</p>' +
      '<p>Thank you for bringing <b>' + escapeHtml(name) + '</b> to ' + escapeHtml(clinic) + '. We hope to see you both again soon.</p>' +
      '<p><b>Responsible doctor:</b> ' + escapeHtml(doctorName) + '<br>' +
      '<b>Next visit:</b> ' + escapeHtml(nextVisit) + '</p>' +
      '<p>If you need to change the appointment, just reply to this email.</p>' +
      '<p>Kind regards,<br>' + escapeHtml(clinic) + '</p>' +
      '</div>';

    notifications.sendEmail({
      fromName: clinic,
      to: [ownerEmail],
      subject: 'Thank you for visiting ' + clinic + ' with ' + name,
      body: body
    }, issue);

    issue.extensionProperties.thankYouSent = true;
    console.log('Thank-you email sent for ' + issue.id + ' (next visit ' + nextVisit + ')');
  },
  requirements: {
    VisitStatus: {
      type: entities.EnumField.fieldType,
      name: 'Visit status',
      Completed: {}
    },
    NextVisit: {type: entities.Field.dateType, name: 'Next visit'},
    OwnerName: {type: entities.Field.stringType, name: 'Owner name'},
    OwnerEmail: {type: entities.Field.stringType, name: 'Owner email'},
    ResponsibleDoctor: {type: entities.User.fieldType, name: 'Responsible doctor'}
  }
});

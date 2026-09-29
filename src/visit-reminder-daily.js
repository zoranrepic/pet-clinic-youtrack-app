const entities = require('@jetbrains/youtrack-scripting-api/entities');
const dateTime = require('@jetbrains/youtrack-scripting-api/date-time');

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDay) => {
  const p = isoDay.split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY_MS;
};

// Every morning, remind the responsible doctor about each pet whose next visit is today or overdue.
exports.rule = entities.Issue.onSchedule({
  title: 'Morning reminder: visits due today or overdue',
  search: 'Next visit: * .. Today Visit status: -Completed, -Cancelled has: {Responsible doctor}',
  cron: '0 0/2 * * * ?', // TESTING: every 2 minutes; production: '0 0 8 ? * MON-FRI' (server time is UTC)
  muteUpdateNotifications: true,
  modifyUpdatedProperties: false,
  action: (ctx) => {
    const issue = ctx.issue;
    const doctor = issue.fields[ctx.ResponsibleDoctor.name];
    const nextVisit = issue.fields[ctx.NextVisit.name];
    if (!doctor || !nextVisit) {
      return;
    }

    const timeZone = (ctx.settings && ctx.settings.timeZone) || 'UTC';
    const visitDay = dateTime.format(nextVisit, 'yyyy-MM-dd', 'UTC');
    const today = dateTime.format(Date.now(), 'yyyy-MM-dd', timeZone);
    const daysOverdue = dayNumber(today) - dayNumber(visitDay);
    if (daysOverdue < 0) {
      return;
    }

    const visitStatus = issue.fields[ctx.VisitStatus.name];
    const owner = issue.fields[ctx.OwnerName.name];
    const ownerEmail = issue.fields[ctx.OwnerEmail.name];
    const when = daysOverdue === 0 ? 'is today' :
      'is overdue by ' + daysOverdue + (daysOverdue === 1 ? ' day' : ' days') + ' (was due ' + visitDay + ')';

    const subject = (daysOverdue === 0 ? 'Visit today: ' : 'Overdue visit: ') + issue.summary + ' (' + issue.id + ')';
    const body = 'Good morning,\n\n' +
      'The next visit for ' + issue.summary + ' ' + when + '.\n\n' +
      'Visit status: ' + (visitStatus ? visitStatus.name : 'not set') + '\n' +
      'Owner: ' + (owner || 'unknown') + (ownerEmail ? ' <' + ownerEmail + '>' : '') + '\n' +
      'Record: ' + issue.url + '\n';

    doctor.notify(subject, body, true, issue.project);
    console.log('Reminded ' + doctor.login + ' about ' + issue.id + ': next visit ' + when);
  },
  requirements: {
    NextVisit: {type: entities.Field.dateType, name: 'Next visit'},
    ResponsibleDoctor: {type: entities.User.fieldType, name: 'Responsible doctor'},
    VisitStatus: {
      type: entities.EnumField.fieldType,
      name: 'Visit status',
      Completed: {},
      Cancelled: {}
    },
    OwnerName: {type: entities.Field.stringType, name: 'Owner name'},
    OwnerEmail: {type: entities.Field.stringType, name: 'Owner email'}
  }
});

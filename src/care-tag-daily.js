const entities = require('@jetbrains/youtrack-scripting-api/entities');
const care = require('./care-status');

// Dates pass without anyone editing the record (a planned visit becomes overdue,
// a check-up falls due), so re-evaluate every pet record once a day.
exports.rule = entities.Issue.onSchedule({
  title: 'Daily care tag refresh',
  search: 'has: {Pet type}',
  cron: '0 0 6 * * ?', // every day at 06:00
  muteUpdateNotifications: true,
  modifyUpdatedProperties: false,
  action: (ctx) => {
    care.apply(ctx);
  },
  requirements: care.requirements
});

const entities = require('@jetbrains/youtrack-scripting-api/entities');
const care = require('./care-status');

exports.rule = entities.Issue.onChange({
  title: 'Update care tag when visit, vaccination or concern details change',
  guard: (ctx) => {
    const issue = ctx.issue;
    return issue.isReported && (issue.becomesReported || care.isWatchedFieldChanged(issue));
  },
  action: (ctx) => {
    care.apply(ctx);
  },
  requirements: care.requirements
});

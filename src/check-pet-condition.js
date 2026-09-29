const entities = require('@jetbrains/youtrack-scripting-api/entities');
const workflow = require('@jetbrains/youtrack-scripting-api/workflow');
const care = require('./care-status');

const isAdministrator = (user, project) =>
  user.hasRole('Project Admin', project) || user.hasRole('System Admin');

function describeChanges(issueId, change) {
  const lines = [];
  if (change.addedTags.length || change.removedTags.length) {
    const from = change.removedTags.length ? '"' + change.removedTags.join('", "') + '"' : 'no care tag';
    lines.push('Tag changed from ' + from + ' to "' + change.tag + '".');
  }
  if (change.explanationChanged) {
    lines.push('Explanation changed from "' + (change.previousExplanation || 'none') +
      '" to "' + change.explanation + '".');
  }
  if (!lines.length) {
    return issueId + ': no changes. Tag "' + change.tag + '" is still correct (' + change.reasons.join('; ') + ').';
  }
  return issueId + ': ' + lines.join(' ');
}

exports.rule = entities.Issue.action({
  title: 'Check pet condition',
  command: 'check-pet-condition',
  guard: (ctx) => ctx.issue.isReported && isAdministrator(ctx.currentUser, ctx.issue.project),
  action: (ctx) => {
    const change = care.apply(ctx);
    const summary = describeChanges(ctx.issue.id, change);
    workflow.message(summary);
    console.log(summary);
  },
  requirements: care.requirements
});

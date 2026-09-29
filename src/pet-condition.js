// Issue-scoped endpoint used by the "Overall condition" widget.
// GET /api/issues/<id>/extensionEndpoints/pet-clinic-care-tags/pet-condition/condition
const care = require('./care-status');

const LEVELS = {
  'good': 'good',
  'needs attention': 'attention',
  'doctor review needed': 'review'
};

exports.httpHandler = {
  endpoints: [
    {
      scope: 'ISSUE',
      method: 'GET',
      path: 'condition',
      handle: (ctx) => {
        const issue = ctx.issue;
        const live = care.evaluate(issue);

        // Prefer what the rules stored on the record; fall back to a live evaluation.
        const tagOnIssue = Object.keys(LEVELS).filter((name) => !!issue.tags.find((t) => t.name === name))[0];
        const tag = tagOnIssue || live.tag;
        const stored = issue.extensionProperties.careTagExplanation || '';
        const prefix = tag + ': ';
        const reasons = stored.indexOf(prefix) === 0 ?
          stored.substring(prefix.length).split('; ') :
          live.reasons;

        const petType = issue.fields['Pet type'];
        ctx.response.json({
          level: LEVELS[tag],
          tag: tag,
          reasons: reasons,
          species: petType ? petType.name : null
        });
      }
    }
  ]
};

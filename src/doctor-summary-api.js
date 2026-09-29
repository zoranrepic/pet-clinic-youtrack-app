// User-scoped endpoint for the "My pet summary" profile widget.
// GET /api/users/<userId>/extensionEndpoints/pet-clinic-care-tags/doctor-summary-api/summary
const summary = require('./doctor-summary');

exports.httpHandler = {
  endpoints: [
    {
      scope: 'USER',
      method: 'GET',
      path: 'summary',
      handle: (ctx) => {
        if (!summary.canSeeSummary(ctx.currentUser)) {
          ctx.response.code = 403;
          ctx.response.json({error: 'Only members of the ' + summary.DOCTORS_GROUP + ' group can see the pet summary.'});
          return;
        }
        const result = summary.buildSummary(ctx.user, ctx.currentUser);
        result.isOwnProfile = ctx.user.login === ctx.currentUser.login;
        ctx.response.json(result);
      }
    }
  ]
};

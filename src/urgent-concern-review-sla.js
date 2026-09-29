const entities = require('@jetbrains/youtrack-scripting-api/entities');
const workingHours = require('./working-hours');

const REVIEW_TIME_IN_MIN = 2 * 60; // two working hours

const concernIs = (ctx, value) => {
  const concern = ctx.issue.fields[ctx.CurrentConcern.name];
  return !!concern && concern.name === value.name;
};
const goalIs = (ctx, value) => {
  const goal = ctx.issue.fields[ctx.ReviewGoal.name];
  return !!goal && goal.name === value.name;
};

function startGoal(ctx) {
  const issue = ctx.issue;
  issue.fields[ctx.ReviewDue.name] = workingHours.addWorkingMinutes(Date.now(), REVIEW_TIME_IN_MIN, ctx.settings);
  issue.fields[ctx.ReviewGoal.name] = ctx.ReviewGoal.Pending;
}

function stopGoal(ctx, outcome) {
  const issue = ctx.issue;
  issue.fields[ctx.ReviewDue.name] = null;
  issue.fields[ctx.ReviewGoal.name] = outcome;
}

// Keeps the review goal in line with the current concern.
function syncGoal(ctx) {
  const pending = goalIs(ctx, ctx.ReviewGoal.Pending);
  const breached = goalIs(ctx, ctx.ReviewGoal.Breached);
  const concernChanged = ctx.issue.fields.isChanged(ctx.CurrentConcern.name);

  if (concernIs(ctx, ctx.CurrentConcern.Urgent)) {
    // A new urgent concern (or one that has no running goal yet) gets two working hours.
    const hasTimer = !!ctx.issue.fields[ctx.ReviewDue.name];
    if (concernChanged || (!pending && !breached) || (pending && !hasTimer)) {
      startGoal(ctx);
    }
    return;
  }

  if (concernIs(ctx, ctx.CurrentConcern.Reviewed)) {
    if (pending) {
      stopGoal(ctx, ctx.ReviewGoal.Met);
    } else if (breached) {
      stopGoal(ctx, ctx.ReviewGoal.Breached); // reviewed late: the goal stays breached
    }
    return;
  }

  // Concern downgraded to None/Routine before review: the goal no longer applies.
  if (pending && concernChanged) {
    stopGoal(ctx, null);
  }
}

exports.rule = entities.Issue.sla({
  title: 'Urgent concern review within two working hours',
  guard: (ctx) => ctx.issue.isReported || ctx.issue.becomesReported,
  onEnter: (ctx) => {
    syncGoal(ctx);
  },
  action: (ctx) => {
    syncGoal(ctx);
  },
  onBreach: (ctx) => {
    const issue = ctx.issue;
    if (!goalIs(ctx, ctx.ReviewGoal.Pending)) {
      return;
    }
    issue.fields[ctx.ReviewGoal.name] = ctx.ReviewGoal.Breached;
    const doctor = issue.fields[ctx.ResponsibleDoctor.name] || issue.project.leader;
    doctor.notify(
      'Urgent concern not reviewed in time: ' + issue.id,
      'The urgent concern for ' + issue.summary + ' (' + issue.id + ') was not reviewed within two working hours. ' +
        'Please review it and set Current concern to Reviewed.',
      true,
      issue.project
    );
  },
  requirements: {
    CurrentConcern: {
      type: entities.EnumField.fieldType,
      name: 'Current concern',
      Urgent: {},
      Reviewed: {}
    },
    ReviewGoal: {
      type: entities.EnumField.fieldType,
      name: 'Review goal',
      Pending: {},
      Met: {},
      Breached: {}
    },
    ReviewDue: {
      type: entities.Field.dateTimeType,
      name: 'Review due'
    },
    ResponsibleDoctor: {
      type: entities.User.fieldType,
      name: 'Responsible doctor'
    }
  }
});

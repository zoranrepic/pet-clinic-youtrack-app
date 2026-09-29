// Shared care-status logic for the Pet Clinic care-tag rules.
const entities = require('@jetbrains/youtrack-scripting-api/entities');
const dateTime = require('@jetbrains/youtrack-scripting-api/date-time');

const TAG_GOOD = 'good';
const TAG_ATTENTION = 'needs attention';
const TAG_REVIEW = 'doctor review needed';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKUP_OVERDUE_DAYS = 365; // annual check-up
const CHECKUP_DUE_SOON_DAYS = 335; // due within the next 30 days
const WATCHED_FIELDS = ['Visit status', 'Next visit', 'Last check-up', 'Vaccination status', 'Current concern'];

// Date fields hold a UTC timestamp; compare them as calendar days.
const day = (timestamp) => dateTime.format(timestamp, 'yyyy-MM-dd', 'UTC');
const enumName = (value) => (value ? value.name : null);

// Returns { tag, reasons, flags: { overdueVisit, overdueVaccination } } for the pet record.
function evaluate(issue) {
  const visitStatus = enumName(issue.fields['Visit status']);
  const vaccination = enumName(issue.fields['Vaccination status']);
  const concern = enumName(issue.fields['Current concern']);
  const nextVisit = issue.fields['Next visit'];
  const lastCheckup = issue.fields['Last check-up'];

  const now = Date.now();
  const today = day(now);
  const review = [];
  const attention = [];

  // Visits
  const visitClosed = visitStatus === 'Completed' || visitStatus === 'Cancelled';
  if (visitStatus === 'No-show') {
    review.push('missed visit' + (nextVisit ? ' on ' + day(nextVisit) : ''));
  } else if (nextVisit && day(nextVisit) < today && !visitClosed) {
    review.push('visit overdue since ' + day(nextVisit));
  } else if (!nextVisit || day(nextVisit) < today || visitStatus === 'Not scheduled' || visitStatus === 'Cancelled') {
    attention.push('next visit not planned');
  }

  // Check-up
  if (!lastCheckup) {
    attention.push('no check-up on record');
  } else if (lastCheckup < now - CHECKUP_OVERDUE_DAYS * DAY_MS) {
    review.push('check-up overdue (last on ' + day(lastCheckup) + ')');
  } else if (lastCheckup < now - CHECKUP_DUE_SOON_DAYS * DAY_MS) {
    attention.push('check-up due soon (last on ' + day(lastCheckup) + ')');
  }

  // Vaccination
  if (vaccination === 'Overdue') {
    review.push('vaccination overdue');
  } else if (vaccination === 'Due soon') {
    attention.push('vaccination due soon');
  } else if (vaccination !== 'Up to date') {
    attention.push('vaccination status: ' + (vaccination || 'not set'));
  }

  // Concern ("Reviewed" means the doctor already handled it)
  if (concern === 'Routine' || concern === 'Urgent') {
    review.push(concern.toLowerCase() + ' concern');
  }

  const flags = {
    overdueVisit: visitStatus === 'No-show' || (!!nextVisit && day(nextVisit) < today && !visitClosed),
    overdueVaccination: vaccination === 'Overdue'
  };
  if (review.length) {
    return {tag: TAG_REVIEW, reasons: review, flags: flags};
  }
  if (attention.length) {
    return {tag: TAG_ATTENTION, reasons: attention, flags: flags};
  }
  return {tag: TAG_GOOD, reasons: ['care up to date', 'next visit planned for ' + day(nextVisit)], flags: flags};
}

// Applies the care tag and stores the explanation. Tags come from rule requirements.
// Returns what was evaluated and what was changed.
function apply(ctx) {
  const issue = ctx.issue;
  const result = evaluate(issue);
  const tagsByName = {};
  tagsByName[TAG_GOOD] = ctx.TagGood;
  tagsByName[TAG_ATTENTION] = ctx.TagNeedsAttention;
  tagsByName[TAG_REVIEW] = ctx.TagDoctorReview;

  const addedTags = [];
  const removedTags = [];
  Object.keys(tagsByName).forEach((name) => {
    const hasIt = !!issue.tags.find((t) => t.name === name);
    if (name === result.tag && !hasIt) {
      issue.tags.add(tagsByName[name]);
      addedTags.push(name);
    } else if (name !== result.tag && hasIt) {
      issue.tags.delete(tagsByName[name]);
      removedTags.push(name);
    }
  });

  const previousExplanation = issue.extensionProperties.careTagExplanation || null;
  const explanation = result.tag + ': ' + result.reasons.join('; ');
  const explanationChanged = previousExplanation !== explanation;
  if (explanationChanged) {
    issue.extensionProperties.careTagExplanation = explanation;
  }

  return {
    tag: result.tag,
    reasons: result.reasons,
    addedTags: addedTags,
    removedTags: removedTags,
    explanation: explanation,
    previousExplanation: previousExplanation,
    explanationChanged: explanationChanged
  };
}

// Current status of a pet: the care tag on the record is the source of truth,
// with a live evaluation as fallback; flags always come from the live evaluation.
function currentStatus(issue) {
  const result = evaluate(issue);
  const names = [TAG_GOOD, TAG_ATTENTION, TAG_REVIEW];
  const tag = names.filter((name) => !!issue.tags.find((t) => t.name === name))[0] || result.tag;
  return {tag: tag, reasons: result.reasons, flags: result.flags};
}

const isWatchedFieldChanged = (issue) => WATCHED_FIELDS.some((name) => issue.fields.isChanged(name));

const requirements = {
  VisitStatus: {
    type: entities.EnumField.fieldType,
    name: 'Visit status',
    NoShow: {name: 'No-show'},
    Completed: {},
    Cancelled: {},
    NotScheduled: {name: 'Not scheduled'}
  },
  VaccinationStatus: {
    type: entities.EnumField.fieldType,
    name: 'Vaccination status',
    UpToDate: {name: 'Up to date'},
    DueSoon: {name: 'Due soon'},
    Overdue: {}
  },
  CurrentConcern: {
    type: entities.EnumField.fieldType,
    name: 'Current concern',
    Routine: {},
    Urgent: {},
    Reviewed: {}
  },
  NextVisit: {type: entities.Field.dateType, name: 'Next visit'},
  LastCheckup: {type: entities.Field.dateType, name: 'Last check-up'},
  TagGood: {type: entities.Tag, name: TAG_GOOD},
  TagNeedsAttention: {type: entities.Tag, name: TAG_ATTENTION},
  TagDoctorReview: {type: entities.Tag, name: TAG_REVIEW}
};

exports.evaluate = evaluate;
exports.currentStatus = currentStatus;
exports.TAGS = [TAG_GOOD, TAG_ATTENTION, TAG_REVIEW];
exports.apply = apply;
exports.isWatchedFieldChanged = isWatchedFieldChanged;
exports.requirements = requirements;

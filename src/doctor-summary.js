// Shared "My pet summary" logic used by the profile HTTP handler and the MCP tool.
const search = require('@jetbrains/youtrack-scripting-api/search');
const care = require('./care-status');

const DOCTORS_GROUP = 'Doctors';

const canSeeSummary = (user) => !!user && user.isInGroup(DOCTORS_GROUP);

const petName = (summary) => summary.split(' (')[0].trim() || summary;

// Counts the pets where `doctor` is the responsible doctor. The search runs as `viewer`,
// so only records the viewer may see are counted.
function buildSummary(doctor, viewer) {
  const query = 'has: {Pet type} Responsible doctor: {' + doctor.login + '} sort by: {issue id} asc';
  const pets = search.search(null, query, viewer);

  const lists = {healthy: [], needsAttention: [], doctorReview: [], overdueVisits: [], overdueVaccinations: []};
  pets.forEach((issue) => {
    const result = care.currentStatus(issue);
    const tag = result.tag;
    const pet = {id: issue.id, name: petName(issue.summary), url: issue.url};

    if (tag === care.TAGS[0]) {
      lists.healthy.push(pet);
    } else if (tag === care.TAGS[1]) {
      lists.needsAttention.push(pet);
    } else {
      lists.doctorReview.push(pet);
    }
    if (result.flags.overdueVisit) {
      lists.overdueVisits.push(pet);
    }
    if (result.flags.overdueVaccination) {
      lists.overdueVaccinations.push(pet);
    }
  });

  return {
    doctor: {login: doctor.login, name: doctor.fullName},
    total: pets.size,
    counts: {
      healthy: lists.healthy.length,
      needsAttention: lists.needsAttention.length,
      doctorReview: lists.doctorReview.length,
      overdueVisits: lists.overdueVisits.length,
      overdueVaccinations: lists.overdueVaccinations.length
    },
    pets: lists
  };
}

exports.DOCTORS_GROUP = DOCTORS_GROUP;
exports.canSeeSummary = canSeeSummary;
exports.buildSummary = buildSummary;

// Global endpoint for the "Clinic health overview" dashboard widget.
// GET /api/extensionEndpoints/pet-clinic-care-tags/clinic-dashboard-api/overview?petType=Dog&doctor=login
// Dashboard widgets have no project context, so this handler is global. Every search runs as the
// current user, so people only see counts for pet records they can open.
const search = require('@jetbrains/youtrack-scripting-api/search');
const care = require('./care-status');

const METRICS = ['good', 'needsAttention', 'doctorReview', 'overdueVisits', 'overdueVaccinations'];
const NO_DOCTOR = '(no doctor)';

// Search values must be wrapped in braces; strip characters that would break the query.
const braced = (value) => '{' + String(value).replace(/[{}]/g, '') + '}';

// Administrators: system admins or project admins of a project that holds pet records.
function isAdministrator(user, projects) {
  if (user.hasRole('System Admin')) {
    return true;
  }
  return projects.some((project) => user.hasRole('Project Admin', project));
}

function emptyCounts() {
  const counts = {};
  METRICS.forEach((m) => {
    counts[m] = 0;
  });
  return counts;
}

exports.httpHandler = {
  endpoints: [
    {
      scope: 'GLOBAL',
      method: 'GET',
      path: 'overview',
      handle: (ctx) => {
        const viewer = ctx.currentUser;
        const allPets = search.search(null, 'has: {Pet type}', viewer);

        // Filter options and admin check are based on everything the viewer can see.
        const petTypes = {};
        const doctors = {};
        const projects = [];
        allPets.forEach((issue) => {
          const type = issue.fields['Pet type'];
          if (type) {
            petTypes[type.name] = true;
          }
          const doctor = issue.fields['Responsible doctor'];
          if (doctor) {
            doctors[doctor.login] = doctor.fullName;
          }
          if (!projects.some((p) => p.key === issue.project.key)) {
            projects.push(issue.project);
          }
        });
        const canFilter = isAdministrator(viewer, projects);

        // Only administrators may filter; other users always get the full overview.
        const petType = canFilter ? ctx.request.getParameter('petType') : null;
        const doctorLogin = canFilter ? ctx.request.getParameter('doctor') : null;
        // Two conditions on the same field are OR-ed in YouTrack search, so a pet type
        // filter replaces "has: {Pet type}" instead of being appended to it.
        let query = petType ? 'Pet type: ' + braced(petType) : 'has: {Pet type}';
        if (doctorLogin) {
          query += ' Responsible doctor: ' + braced(doctorLogin);
        }
        const pets = petType || doctorLogin ? search.search(null, query, viewer) : allPets;

        // Break the charts down by pet type, or by doctor once a single pet type is selected.
        const groupBy = petType ? 'doctor' : 'petType';
        const totals = emptyCounts();
        const groups = {};
        pets.forEach((issue) => {
          const status = care.currentStatus(issue);
          const doctor = issue.fields['Responsible doctor'];
          const type = issue.fields['Pet type'];
          const key = groupBy === 'doctor' ? (doctor ? doctor.fullName : NO_DOCTOR) : type.name;
          if (!groups[key]) {
            groups[key] = emptyCounts();
          }
          const hits = {
            good: status.tag === care.TAGS[0],
            needsAttention: status.tag === care.TAGS[1],
            doctorReview: status.tag === care.TAGS[2],
            overdueVisits: status.flags.overdueVisit,
            overdueVaccinations: status.flags.overdueVaccination
          };
          METRICS.forEach((m) => {
            if (hits[m]) {
              totals[m] += 1;
              groups[key][m] += 1;
            }
          });
        });

        ctx.response.json({
          total: pets.size,
          totals: totals,
          groupBy: groupBy,
          groups: Object.keys(groups).sort().map((name) => ({name: name, counts: groups[name]})),
          filters: {
            canFilter: canFilter,
            petType: petType || null,
            doctor: doctorLogin || null,
            petTypes: Object.keys(petTypes).sort(),
            doctors: Object.keys(doctors).sort().map((login) => ({login: login, name: doctors[login]}))
          }
        });
      }
    }
  ]
};

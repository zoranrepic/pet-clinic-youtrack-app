// Read-only MCP tool that returns the "My pet summary" for the current doctor.
const entities = require('@jetbrains/youtrack-scripting-api/entities');
const summary = require('./doctor-summary');

const petList = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: {type: 'string', description: 'Readable pet record ID, e.g. PET-4'},
      name: {type: 'string', description: 'Pet name'},
      url: {type: 'string', description: 'Link to the pet record'}
    },
    required: ['id', 'name']
  }
};

exports.aiTool = {
  name: 'get_my_pet_summary',
  description: 'Reads the Pet Clinic "My pet summary" for a doctor: how many of the pets they are responsible for ' +
    'are healthy, need attention, need a doctor review, have an overdue visit, or have an overdue vaccination, ' +
    'with the matching pet record IDs. Defaults to the current user. Only members of the Doctors group can use it.',
  inputSchema: {
    type: 'object',
    properties: {
      doctorLogin: {
        type: 'string',
        description: 'Optional login of the responsible doctor. Leave empty to get the summary for the current user.'
      }
    }
  },
  annotations: {
    title: 'Get my pet summary',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    returnDirect: false
  },
  execute: (ctx) => {
    if (!summary.canSeeSummary(ctx.currentUser)) {
      throw new Error('Only members of the ' + summary.DOCTORS_GROUP + ' group can read the pet summary.');
    }
    const login = ctx.arguments && ctx.arguments.doctorLogin;
    const doctor = login ? entities.User.findByLogin(login) : ctx.currentUser;
    if (!doctor) {
      throw new Error('No user with login "' + login + '".');
    }
    return summary.buildSummary(doctor, ctx.currentUser);
  },
  outputSchema: {
    type: 'object',
    properties: {
      doctor: {
        type: 'object',
        properties: {
          login: {type: 'string', description: 'Doctor login'},
          name: {type: 'string', description: 'Doctor full name'}
        },
        required: ['login']
      },
      total: {type: 'integer', description: 'Number of pets the doctor is responsible for'},
      counts: {
        type: 'object',
        properties: {
          healthy: {type: 'integer', description: 'Pets tagged "good"'},
          needsAttention: {type: 'integer', description: 'Pets tagged "needs attention"'},
          doctorReview: {type: 'integer', description: 'Pets tagged "doctor review needed"'},
          overdueVisits: {type: 'integer', description: 'Pets with a missed or overdue visit'},
          overdueVaccinations: {type: 'integer', description: 'Pets with an overdue vaccination'}
        },
        required: ['healthy', 'needsAttention', 'doctorReview', 'overdueVisits', 'overdueVaccinations']
      },
      pets: {
        type: 'object',
        properties: {
          healthy: petList,
          needsAttention: petList,
          doctorReview: petList,
          overdueVisits: petList,
          overdueVaccinations: petList
        }
      }
    },
    required: ['doctor', 'total', 'counts']
  }
};

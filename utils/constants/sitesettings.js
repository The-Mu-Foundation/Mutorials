// Admin accounts are identified by email address. Configure them with the
// `adminemails` (or ADMIN_EMAILS) environment variable, separated by semicolons.
const configured = process.env.ADMIN_EMAILS || process.env.adminemails;
const adminList = configured
  ? configured
      .split(';')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  : [
      'mutorialsproject@gmail.com',
      'patrickfengsr@gmail.com',
      'heatherlam268@gmail.com',
      'womogenes2@gmail.com',
      'devesh@aggarwal.com',
    ];
const contributorList = [];

// An admin must have an admin email AND not be an unverified newcomer: accounts
// registered with this version start with emailVerified=false until they prove
// ownership of the address (completing a password reset). Without this, anyone
// could register an admin address that has no account yet and become an admin.
function isAdmin(user) {
  return Boolean(
    user &&
    typeof user.username === 'string' &&
    adminList.includes(user.username.toLowerCase()) &&
    user.emailVerified !== false,
  );
}

module.exports = { adminList, contributorList, isAdmin };

const adminList = process.env.adminemails?.split(';') || [
  'mutorialsproject@gmail.com',
  'patrickfengsr@gmail.com',
  'heatherlam268@gmail.com',
  'womogenes2@gmail.com',
  'justanotherinternetguysocial@gmail.com',
];
const contributorList = [];

module.exports = { adminList: adminList, contributorList: contributorList };

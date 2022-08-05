const adminList = process.env.adminemails?.split(';') || [ 'mutorialsproject@gmail.com', 'aryagummadi@gmail.com' ];
const contributorList = [];

module.exports = { adminList : adminList, contributorList: contributorList };

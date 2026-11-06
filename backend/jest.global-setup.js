// Run every test with the server clock in UTC, as production does. Set here
// rather than inside a test: Jest gives each test file its own copy of
// process.env, so changing TZ there never reaches Date. Pinning it keeps
// timezone bugs from hiding on machines set to the team's own timezone
// (e.g. a week start read in the server's zone instead of the
// organisation's, which is right in Madagascar and wrong on a UTC server).
module.exports = () => {
  process.env.TZ = 'UTC';
};

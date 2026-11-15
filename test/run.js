const { server } = require('../server');
const runTests = require('./api.test');

// Allow server a moment to connect to DB and start listening
setTimeout(async () => {
  try {
    const success = await runTests();
    server.close(() => {
      process.exit(success ? 0 : 1);
    });
  } catch (error) {
    console.error('Fatal test error:', error);
    server.close(() => {
      process.exit(1);
    });
  }
}, 1500);

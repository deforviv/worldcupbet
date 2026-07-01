// api/index.js — Vercel Serverless Function entry point
// Wraps the Express app with error catching to expose crash details in the response.

let app;
try {
  app = require('../server/src/app');
} catch (err) {
  // If the Express app crashes at startup, return the error as JSON so we can debug it
  app = (req, res) => {
    res.status(500).json({
      error: 'Server startup failed',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  };
}

module.exports = app;

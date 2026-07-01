// api/index.js — Vercel Serverless Function entry point
// This file bridges Vercel's serverless runtime with our Express app.
const app = require('../server/src/app');

module.exports = app;

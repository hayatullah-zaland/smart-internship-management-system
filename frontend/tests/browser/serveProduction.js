import { createApp } from '../../../backend/app.js'

// Serve the real build for isolated browser tests; never connect to MongoDB.
createApp({ production: true }).listen(5180, '127.0.0.1', () => {
  console.log('SIMS production browser test server: http://127.0.0.1:5180')
})

const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { team } = req.query;

  if (!team) {
    res.status(400).json({
      error: 'Team parameter is required',
      usage: 'GET /api/skills?team=1234A'
    });
    return;
  }

  try {
    const snapshot = await admin.firestore().collection('leaderboard').doc(team).get();
    if (snapshot.exists) {
      const data = snapshot.data();
      res.json({
        teamNumber: team,
        skillScore: data.skillScore || 0,
        skillsRank: data.skillsRank || null,
        driverScore: data.driverScore || 0,
        progScore: data.progScore || 0
      });
    } else {
      res.status(404).json({ error: 'Team not found' });
    }
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

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
      usage: 'GET /api/trueskill?team=1234A'
    });
    return;
  }

  try {
    const snapshot = await admin.firestore().collection('leaderboard').doc(team).get();
    if (snapshot.exists) {
      const data = snapshot.data();
      res.json({
        trueSkill: parseFloat(data.conservativeScore),
        trueSkillRanking: parseInt(data.rank),
        opr: parseFloat(data.opr),
        dpr: parseFloat(data.dpr),
        ccvm: parseFloat(data.ccvm),
        winPercentage: parseFloat(data.winPercentage),
        ts2026: data.ts2026 || 0.0
      });
    } else {
      res.status(404).json({ error: 'Team not found' });
    }
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

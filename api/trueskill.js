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
      usage: 'GET /api/trueskill?team=1523W'
    });
    return;
  }

  try {
    const snapshot = await admin.firestore().collection('leaderboard').doc(team).get();
    if (snapshot.exists) {
      const data = snapshot.data();
      res.json({
        // TrueSkill data
        trueSkill: parseFloat(data.conservativeScore) || 0,
        trueSkillRanking: parseInt(data.rank) || null,
        opr: parseFloat(data.opr) || 0,
        dpr: parseFloat(data.dpr) || 0,
        ccvm: parseFloat(data.ccvm) || 0,
        winPercentage: parseFloat(data.winPercentage) || 0,
        ts2026: data.ts2026 || 0.0,
        // World skills data
        worldSkillsRank: data.worldSkillsRank || null,
        worldSkillScore: data.worldSkillScore || 0,
        worldDriverScore: data.worldDriverScore || 0,
        worldProgScore: data.worldProgScore || 0,
        // Team info
        gradeLevel: data.gradeLevel || null,
        organization: data.organization || null,
        region: data.region || null,
        country: data.country || null
      });
    } else {
      res.status(404).json({ error: 'Team not found' });
    }
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

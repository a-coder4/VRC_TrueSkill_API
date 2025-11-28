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

  try {
    const limit = parseInt(req.query.limit) || 50;
    const snapshot = await admin.firestore()
      .collection('leaderboard')
      .orderBy('skillsRank', 'asc')
      .limit(limit)
      .get();

    const teams = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.skillScore && data.skillScore > 0) {
        teams.push({
          teamNumber: doc.id,
          skillScore: data.skillScore,
          skillsRank: data.skillsRank,
          driverScore: data.driverScore || 0,
          progScore: data.progScore || 0
        });
      }
    });

    res.json(teams);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

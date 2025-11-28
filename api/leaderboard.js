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
    const gradeLevel = req.query.grade; // 'High School' or 'Middle School' or 'hs' or 'ms'
    
    let query = admin.firestore().collection('leaderboard');
    
    // Order by world skills rank
    query = query.orderBy('worldSkillsRank', 'asc');
    
    // Apply grade level filter if specified
    if (gradeLevel) {
      const grade = gradeLevel === 'hs' ? 'High School' : 
                    gradeLevel === 'ms' ? 'Middle School' : gradeLevel;
      query = query.where('gradeLevel', '==', grade);
    }
    
    const snapshot = await query.limit(limit).get();

    const teams = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.worldSkillScore && data.worldSkillScore > 0) {
        teams.push({
          teamNumber: doc.id,
          worldSkillsRank: data.worldSkillsRank || null,
          worldSkillScore: data.worldSkillScore || 0,
          worldDriverScore: data.worldDriverScore || 0,
          worldProgScore: data.worldProgScore || 0,
          gradeLevel: data.gradeLevel || null,
          organization: data.organization || null,
          city: data.city || null,
          region: data.region || null,
          country: data.country || null
        });
      }
    });

    res.json({
      count: teams.length,
      gradeLevel: gradeLevel || 'all',
      teams: teams
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

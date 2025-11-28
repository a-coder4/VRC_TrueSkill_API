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

  const { team, grade, limit: queryLimit, region, country } = req.query;

  // If team is specified, return single team data
  if (team) {
    try {
      const snapshot = await admin.firestore().collection('leaderboard').doc(team).get();
      if (snapshot.exists) {
        const data = snapshot.data();
        if (!data.worldSkillScore || data.worldSkillScore === 0) {
          res.status(404).json({ error: 'Team has no world skills data' });
          return;
        }
        res.json({
          teamNumber: team,
          worldSkillsRank: data.worldSkillsRank || null,
          worldSkillScore: data.worldSkillScore || 0,
          worldDriverScore: data.worldDriverScore || 0,
          worldProgScore: data.worldProgScore || 0,
          gradeLevel: data.gradeLevel || null,
          organization: data.organization || null,
          city: data.city || null,
          region: data.region || null,
          country: data.country || null,
          lastUpdated: data.lastUpdated || null
        });
      } else {
        res.status(404).json({ error: 'Team not found' });
      }
    } catch (err) {
      console.error('API Error:', err);
      res.status(500).json({ error: 'Firebase error: ' + err.message });
    }
    return;
  }

  // Return leaderboard
  try {
    const limit = parseInt(queryLimit) || 100;
    
    let query = admin.firestore()
      .collection('leaderboard')
      .orderBy('worldSkillsRank', 'asc');
    
    // Filter by grade level if specified
    if (grade) {
      const gradeLevel = grade === 'hs' ? 'High School' : 
                        grade === 'ms' ? 'Middle School' : grade;
      query = query.where('gradeLevel', '==', gradeLevel);
    }
    
    const snapshot = await query.limit(limit * 2).get(); // Fetch extra for filtering

    const teams = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.worldSkillScore && data.worldSkillScore > 0) {
        // Apply additional filters
        if (region && data.region !== region) return;
        if (country && data.country !== country) return;
        
        if (teams.length < limit) {
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
      }
    });

    res.json({
      count: teams.length,
      filters: {
        grade: grade || 'all',
        region: region || 'all',
        country: country || 'all'
      },
      teams: teams
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

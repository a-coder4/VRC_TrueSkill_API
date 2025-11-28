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
    const type = req.query.type || 'local'; // 'local', 'world', or 'all'
    const gradeLevel = req.query.grade; // 'High School' or 'Middle School'
    
    let query = admin.firestore().collection('leaderboard');
    
    // Choose ordering based on type
    if (type === 'world') {
      query = query.orderBy('worldSkillsRank', 'asc');
    } else {
      query = query.orderBy('skillsRank', 'asc');
    }
    
    // Apply grade level filter if specified
    if (gradeLevel) {
      query = query.where('gradeLevel', '==', gradeLevel);
    }
    
    const snapshot = await query.limit(limit).get();

    const teams = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const hasLocalSkills = data.skillScore && data.skillScore > 0;
      const hasWorldSkills = data.worldSkillScore && data.worldSkillScore > 0;
      
      if ((type === 'local' && hasLocalSkills) || 
          (type === 'world' && hasWorldSkills) || 
          (type === 'all' && (hasLocalSkills || hasWorldSkills))) {
        teams.push({
          teamNumber: doc.id,
          // Local skills
          skillScore: data.skillScore || 0,
          skillsRank: data.skillsRank || null,
          driverScore: data.driverScore || 0,
          progScore: data.progScore || 0,
          // World skills
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
      }
    });

    res.json({
      count: teams.length,
      type: type,
      gradeLevel: gradeLevel || 'all',
      teams: teams
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
}

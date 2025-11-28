import express from 'express';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { runCsvSkillsImport } from '../../skills_csv_importer.js';

// Load environment variables
dotenv.config();

const app = express();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

app.use(express.json());

app.get('/trueskill/:team', async (req, res) => {
  const teamName = req.params.team;
  try {
    const snapshot = await admin.firestore().collection('leaderboard').doc(teamName).get();
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
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
});

app.get('/skills/:team', async (req, res) => {
  const teamName = req.params.team;
  try {
    const snapshot = await admin.firestore().collection('leaderboard').doc(teamName).get();
    if (snapshot.exists) {
      const data = snapshot.data();
      res.json({
        teamNumber: teamName,
        skillScore: data.skillScore || 0,
        skillsRank: data.skillsRank || null,
        driverScore: data.driverScore || 0,
        progScore: data.progScore || 0
      });
    } else {
      res.status(404).json({ error: 'Team not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
});

app.get('/leaderboard/skills', async (req, res) => {
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
    res.status(500).json({ error: 'Firebase error: ' + err.message });
  }
});

app.post('/import/skills-csv', async (_req, res) => {
  try {
    const result = await runCsvSkillsImport();
    res.json({
      message: 'Skills CSV import complete',
      teamsProcessed: result.teamsProcessed,
      updatedTeams: result.updatedTeams,
      downloads: result.downloaded
    });
  } catch (err) {
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

// Start server for local testing
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`  GET /trueskill/:team - TrueSkill data for a team`);
    console.log(`  GET /skills/:team - Skills data for a team`);
    console.log(`  GET /leaderboard/skills?limit=50 - Top skills teams`);
  });
}

export default app;

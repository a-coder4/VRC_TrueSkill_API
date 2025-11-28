import 'dotenv/config';
import fs from 'node:fs/promises';
import firebase_admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const SEASON_ID = 197;
const HIGH_SCHOOL_URL = `https://www.robotevents.com/api/seasons/${SEASON_ID}/skills?post_season=1&grade_level=High%20School`;
const MIDDLE_SCHOOL_URL = `https://www.robotevents.com/api/seasons/${SEASON_ID}/skills?post_season=1&grade_level=Middle%20School`;

function initializeFirebase() {
  if (firebase_admin.apps.length > 0) {
    return getFirestore();
  }

  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const cred = firebase_admin.credential.cert({
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
      firebase_admin.initializeApp({ credential: cred });
      return getFirestore();
    }
  } catch (error) {
    console.log('Firebase initialization with env vars failed, trying key file...');
  }

  try {
    const keyPaths = ['./serviceAccountKey.json', '../Keys/serviceAccountKey.json'];
    for (const keyPath of keyPaths) {
      try {
        const cred = firebase_admin.credential.cert(keyPath);
        firebase_admin.initializeApp({ credential: cred });
        return getFirestore();
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    console.log('Firebase initialization with key file failed');
  }

  return null;
}

async function fetchSkillsData(url, gradeLevel) {
  console.log(`🌐 Fetching ${gradeLevel} skills data...`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.length} ${gradeLevel} teams`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching ${gradeLevel} data:`, error.message);
    return [];
  }
}

function processSkillsData(rawData, gradeLevel) {
  return rawData.map(entry => ({
    rank: entry.rank,
    teamNumber: entry.team?.team || 'Unknown',
    teamName: entry.team?.teamName || '',
    organization: entry.team?.organization || '',
    city: entry.team?.city || '',
    region: entry.team?.region || '',
    country: entry.team?.country || '',
    gradeLevel: gradeLevel,
    eventSku: entry.event?.sku || '',
    eventDate: entry.event?.startDate || '',
    combinedScore: entry.scores?.score || 0,
    programmingScore: entry.scores?.programming || 0,
    driverScore: entry.scores?.driver || 0,
    maxProgramming: entry.scores?.maxProgramming || 0,
    maxDriver: entry.scores?.maxDriver || 0,
    eligible: entry.eligible || false
  }));
}

async function main() {
  const startTime = Date.now();
  console.log('🏆 Fetching VRC World Skills Data\n');

  // Fetch both High School and Middle School data
  const [hsRawData, msRawData] = await Promise.all([
    fetchSkillsData(HIGH_SCHOOL_URL, 'High School'),
    fetchSkillsData(MIDDLE_SCHOOL_URL, 'Middle School')
  ]);

  // Process the data
  const hsData = processSkillsData(hsRawData, 'High School');
  const msData = processSkillsData(msRawData, 'Middle School');

  // Combine all data
  const allSkillsData = [...hsData, ...msData];

  console.log(`\n📊 Total teams: ${allSkillsData.length}`);
  console.log(`   High School: ${hsData.length}`);
  console.log(`   Middle School: ${msData.length}`);

  // Write to CSV file
  console.log('\n📄 Writing skills data to CSV...');
  const csvHeader = 'rank,team,teamName,organization,city,region,country,gradeLevel,eventSku,eventDate,combined,programming,driver,maxProgramming,maxDriver,eligible';
  const csvLines = [csvHeader];

  for (const team of allSkillsData) {
    // Escape commas and quotes in text fields
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    csvLines.push([
      team.rank,
      escapeCsv(team.teamNumber),
      escapeCsv(team.teamName),
      escapeCsv(team.organization),
      escapeCsv(team.city),
      escapeCsv(team.region),
      escapeCsv(team.country),
      escapeCsv(team.gradeLevel),
      escapeCsv(team.eventSku),
      escapeCsv(team.eventDate),
      team.combinedScore,
      team.programmingScore,
      team.driverScore,
      team.maxProgramming,
      team.maxDriver,
      team.eligible
    ].join(','));
  }

  try {
    await fs.writeFile('world_skills.csv', csvLines.join('\n'));
    console.log(`✅ World skills data written to world_skills.csv (${allSkillsData.length} teams)`);
  } catch (error) {
    console.error('❌ Error writing world_skills.csv:', error.message);
  }

  // Also write separate files for each grade level
  try {
    const hsCsvLines = [csvHeader];
    for (const team of hsData) {
      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      hsCsvLines.push([
        team.rank,
        escapeCsv(team.teamNumber),
        escapeCsv(team.teamName),
        escapeCsv(team.organization),
        escapeCsv(team.city),
        escapeCsv(team.region),
        escapeCsv(team.country),
        escapeCsv(team.gradeLevel),
        escapeCsv(team.eventSku),
        escapeCsv(team.eventDate),
        team.combinedScore,
        team.programmingScore,
        team.driverScore,
        team.maxProgramming,
        team.maxDriver,
        team.eligible
      ].join(','));
    }
    await fs.writeFile('world_skills_hs.csv', hsCsvLines.join('\n'));
    console.log(`✅ High School skills data written to world_skills_hs.csv (${hsData.length} teams)`);
  } catch (error) {
    console.error('❌ Error writing world_skills_hs.csv:', error.message);
  }

  try {
    const msCsvLines = [csvHeader];
    for (const team of msData) {
      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      msCsvLines.push([
        team.rank,
        escapeCsv(team.teamNumber),
        escapeCsv(team.teamName),
        escapeCsv(team.organization),
        escapeCsv(team.city),
        escapeCsv(team.region),
        escapeCsv(team.country),
        escapeCsv(team.gradeLevel),
        escapeCsv(team.eventSku),
        escapeCsv(team.eventDate),
        team.combinedScore,
        team.programmingScore,
        team.driverScore,
        team.maxProgramming,
        team.maxDriver,
        team.eligible
      ].join(','));
    }
    await fs.writeFile('world_skills_ms.csv', msCsvLines.join('\n'));
    console.log(`✅ Middle School skills data written to world_skills_ms.csv (${msData.length} teams)`);
  } catch (error) {
    console.error('❌ Error writing world_skills_ms.csv:', error.message);
  }

  // Write JSON file for easy access
  try {
    await fs.writeFile('world_skills.json', JSON.stringify({
      fetchedAt: new Date().toISOString(),
      season: SEASON_ID,
      totalTeams: allSkillsData.length,
      highSchoolTeams: hsData.length,
      middleSchoolTeams: msData.length,
      highSchool: hsData,
      middleSchool: msData
    }, null, 2));
    console.log(`✅ JSON data written to world_skills.json`);
  } catch (error) {
    console.error('❌ Error writing world_skills.json:', error.message);
  }

  // Update Firebase if configured
  console.log('\n🔥 Updating Firebase with world skills data...');
  const db = initializeFirebase();

  if (!db) {
    console.log('⚠️ Firebase not configured. Skipping database update.');
  } else {
    let batch = db.batch();
    let batchCount = 0;
    let updatedTeams = 0;

    for (const team of allSkillsData) {
      const docRef = db.collection('leaderboard').doc(team.teamNumber);

      batch.set(docRef, {
        worldSkillsRank: team.rank,
        worldSkillScore: team.combinedScore,
        worldDriverScore: team.driverScore,
        worldProgScore: team.programmingScore,
        gradeLevel: team.gradeLevel,
        organization: team.organization,
        city: team.city,
        region: team.region,
        country: team.country,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      batchCount++;

      if (batchCount === 500) {
        try {
          await batch.commit();
          updatedTeams += batchCount;
          batchCount = 0;
          batch = db.batch();
        } catch (error) {
          console.error(`Error committing batch: ${error}`);
        }
      }
    }

    if (batchCount > 0) {
      try {
        await batch.commit();
        updatedTeams += batchCount;
      } catch (error) {
        console.error(`Error committing final batch: ${error}`);
      }
    }

    console.log(`✅ Updated ${updatedTeams} teams in Firestore with world skills data`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️ Elapsed time: ${elapsed} seconds`);

  // Print top 10 for each division
  console.log('\n🏆 Top 10 High School Teams:');
  hsData.slice(0, 10).forEach((team, index) => {
    console.log(`${(index + 1).toString().padStart(2, ' ')}. ${team.teamNumber}: ${team.combinedScore} (Driver: ${team.driverScore}, Programming: ${team.programmingScore})`);
  });

  console.log('\n🏆 Top 10 Middle School Teams:');
  msData.slice(0, 10).forEach((team, index) => {
    console.log(`${(index + 1).toString().padStart(2, ' ')}. ${team.teamNumber}: ${team.combinedScore} (Driver: ${team.driverScore}, Programming: ${team.programmingScore})`);
  });
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
});

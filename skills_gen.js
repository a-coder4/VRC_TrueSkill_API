import 'dotenv/config';
import fs from 'node:fs/promises';
import firebase_admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const TOKEN = process.env.ROBOT_EVENTS_TOKEN;
if (!TOKEN) {
  console.error('❌ Missing ROBOT_EVENTS_TOKEN in .env');
  process.exit(1);
}

const BASE_URL = 'https://www.robotevents.com/api/v2';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json'
};
const PROGRAM_ID = 1;

const BAR_WIDTH = 30;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiFetch(endpoint, params = {}, retries = 3) {
  const url = new URL(BASE_URL + endpoint);
  for (const [key, val] of Object.entries(params)) {
    if (Array.isArray(val)) {
      val.forEach(v => url.searchParams.append(`${key}[]`, v));
    } else {
      url.searchParams.append(key, val);
    }
  }

  console.log(`🌐 Fetching: ${url.toString()}`);
  await sleep(500); // rate limiting
  const res = await fetch(url, { headers: HEADERS });

  if (res.status === 429 && retries > 0) {
    console.warn(`⚠️ Rate limit hit. Retrying in 10s... (${retries} left)`);
    await sleep(10000);
    return apiFetch(endpoint, params, retries - 1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ API ${res.status}: ${text}`);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

async function fetchAll(endpoint, params = {}) {
  let page = 1;
  let out = [];

  while (true) {
    const result = await apiFetch(endpoint, { ...params, page, per_page: 100 });
    out = out.concat(result.data);

    if (endpoint === '/teams') {
      console.log(`🔍 Fetched ${out.length} teams so far...`);
    }

    if (!result.meta || result.meta.current_page >= result.meta.last_page) break;

    page++;
  }

  return out;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

function drawProgressBar(done, total, startTime) {
  const pct = done / total;
  const full = Math.round(pct * BAR_WIDTH);
  const now = Date.now();
  const elapsed = (now - startTime) / 1000;
  const estimatedTotalTime = elapsed / pct;
  const eta = estimatedTotalTime - elapsed;

  process.stdout.write(
    `\r[${'█'.repeat(full)}${' '.repeat(BAR_WIDTH - full)}] ${(pct * 100).toFixed(1)}%  ETA: ${formatTime(eta)} (${done}/${total})`
  );
}

async function main() {
  const startTime = Date.now();

  console.log('🔍 Fetching current season...');
  const seasons = await fetchAll('/seasons', { program: [PROGRAM_ID] });
  let currentSeason = seasons.find(s => s.current === true);

  if (!currentSeason) {
    console.warn('⚠️ No season marked as "current" found. Falling back to the latest season by ID.');
    // Sort by ID descending
    seasons.sort((a, b) => b.id - a.id);
    if (seasons.length > 0) {
      currentSeason = seasons[0];
    }
  }

  if (!currentSeason) {
    console.error('❌ No seasons found at all');
    return;
  }

  console.log(`🎯 Current season: ${currentSeason.name} (ID: ${currentSeason.id})`);

  console.log('👥 Fetching teams...');
  const teams = await fetchAll('/teams', {
    program: [PROGRAM_ID],
    grade: ['High School', 'Middle School'],
    country: ['US'],
    registered: true,
    myTeams: false
  });

  console.log(`📊 Found ${teams.length} teams`);

  const teamSkillsData = [];

  console.log('\n🎮 Fetching skills for each team...');
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    drawProgressBar(i, teams.length, startTime);

    try {
      const skills = await apiFetch('/teams/' + team.id + '/skills', {
        season: [currentSeason.id]
      });

      if (skills.data && skills.data.length > 0) {
        const skill = skills.data[0];
        const combined = (skill.driver || 0) + (skill.programming || 0);

        teamSkillsData.push({
          teamNumber: team.number,
          season: currentSeason.id,
          driverScore: skill.driver || 0,
          progScore: skill.programming || 0,
          skillScore: combined
        });
      }
    } catch (error) {
      console.error(`\n❌ Error fetching skills for team ${team.number}: ${error.message}`);
    }
  }

  process.stdout.write('\n');
  console.log(`📈 Found skills data for ${teamSkillsData.length} teams`);

  // Sort by skill score and assign ranks
  teamSkillsData.sort((a, b) => b.skillScore - a.skillScore);
  teamSkillsData.forEach((team, index) => {
    team.skillsRank = index + 1;
  });

  // Write to CSV file
  console.log('\n📄 Writing skills data to CSV...');
  const csvHeader = 'team,season,driver,programming,combined';
  const csvLines = [csvHeader];

  for (const team of teamSkillsData) {
    csvLines.push(`${team.teamNumber},${team.season},${team.driverScore},${team.progScore},${team.skillScore}`);
  }

  try {
    await fs.writeFile('skills.csv', csvLines.join('\n'));
    console.log(`✅ Skills data written to skills.csv (${teamSkillsData.length} teams)`);
  } catch (error) {
    console.error('❌ Error writing skills.csv:', error.message);
  }

  console.log('\n🔥 Updating Firebase with skills data...');
  const db = initializeFirebase();

  if (!db) {
    console.log('❌ Firebase not configured. Cannot update database.');
  } else {
    let batch = db.batch();
    let batchCount = 0;
    let updatedTeams = 0;

    for (const team of teamSkillsData) {
      const docRef = db.collection('leaderboard').doc(team.teamNumber);

      batch.set(docRef, {
        skillScore: team.skillScore,
        skillsRank: team.skillsRank,
        driverScore: team.driverScore,
        progScore: team.progScore
      }, { merge: true });

      batchCount++;

      if (batchCount === 500) {
        try {
          await batch.commit();
          updatedTeams += batchCount;
          batchCount = 0;
          batch = db.batch(); // Create a new batch after committing
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

    console.log(`✅ Updated ${updatedTeams} teams in Firestore with skills data`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Done: ${teamSkillsData.length} teams processed`);
  console.log(`⏱️ Elapsed time: ${elapsed} seconds`);

  console.log('\n🏆 Top 10 teams by combined skills:');
  teamSkillsData.slice(0, 10).forEach((team, index) => {
    console.log(`${(index + 1).toString().padStart(2, ' ')}. ${team.teamNumber}: ${team.skillScore} (Driver: ${team.driverScore}, Programming: ${team.progScore})`);
  });
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
});

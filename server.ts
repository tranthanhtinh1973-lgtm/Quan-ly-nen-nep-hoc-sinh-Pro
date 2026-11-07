import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS headers middleware to eliminate 403 / CORS errors on API endpoints
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Directory for central JSON persistence
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');

function loadJson<T>(filePath: string, fallback: T): T {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content && content.trim()) {
        return JSON.parse(content) as T;
      }
    } catch (e) {
      console.error('Failed to parse JSON at:', filePath, e);
    }
  }
  return fallback;
}

function saveJson(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save JSON at:', filePath, e);
  }
}

// REST API endpoints for multi-device cross-user data synchronization
app.get('/api/schools', (req, res) => {
  const schools = loadJson(SCHOOLS_FILE, []);
  res.json({ schools });
});

app.post('/api/schools', (req, res) => {
  const { schools } = req.body || {};
  if (Array.isArray(schools)) {
    saveJson(SCHOOLS_FILE, schools);
    return res.json({ success: true, count: schools.length });
  }
  res.status(400).json({ error: 'Invalid payload: schools array required' });
});

app.get('/api/school-data/:schoolId', (req, res) => {
  const schoolId = String(req.params.schoolId || '').trim();
  if (!schoolId) {
    return res.json({ schoolId: '', schoolData: null });
  }
  const file = path.join(DATA_DIR, `school_data_${schoolId.toUpperCase()}.json`);
  const schoolData = loadJson(file, null);
  // Always return 200 OK even if schoolData is null to avoid client 404 network errors
  res.json({ schoolId, schoolData });
});

app.post('/api/school-data', (req, res) => {
  const { schoolId, schoolData } = req.body || {};
  if (!schoolId || !schoolData) {
    return res.status(400).json({ error: 'Missing schoolId or schoolData payload' });
  }
  const cleanId = String(schoolId).trim().toUpperCase();
  const file = path.join(DATA_DIR, `school_data_${cleanId}.json`);
  const existingData = loadJson(file, null) as any;

  // Filter out any non-admin synthetic accounts from USERS
  if (schoolData.USERS && Array.isArray(schoolData.USERS)) {
    schoolData.USERS = schoolData.USERS.filter((u: any) => !u.id || !String(u.id).startsWith('GV-'));
  }

  if (existingData && typeof existingData === 'object') {
    // Preserve existing USERS if incoming has fewer or missing teachers
    if (existingData.USERS && Array.isArray(existingData.USERS) && existingData.USERS.length > 0) {
      const cleanExistingUsers = existingData.USERS.filter((u: any) => !u.id || !String(u.id).startsWith('GV-'));
      if (!schoolData.USERS || !Array.isArray(schoolData.USERS) || schoolData.USERS.length === 0) {
        schoolData.USERS = cleanExistingUsers;
      } else {
        cleanExistingUsers.forEach((u: any) => {
          if (u && u.username && !schoolData.USERS.some((existing: any) => existing.username.toLowerCase() === u.username.toLowerCase())) {
            schoolData.USERS.push(u);
          }
        });
      }
    }

    // Preserve existing SCORE_RULES if incoming has fewer or missing rules
    if (existingData.SCORE_RULES && Array.isArray(existingData.SCORE_RULES) && existingData.SCORE_RULES.length > 0) {
      if (!schoolData.SCORE_RULES || !Array.isArray(schoolData.SCORE_RULES) || schoolData.SCORE_RULES.length === 0) {
        schoolData.SCORE_RULES = existingData.SCORE_RULES;
      } else {
        existingData.SCORE_RULES.forEach((r: any) => {
          if (r && r.code && !schoolData.SCORE_RULES.some((existing: any) => existing.code === r.code)) {
            schoolData.SCORE_RULES.push(r);
          }
        });
      }
    }

    // Preserve existing STUDENTS if incoming has fewer or missing students
    if (existingData.STUDENTS && Array.isArray(existingData.STUDENTS) && existingData.STUDENTS.length > 0) {
      if (!schoolData.STUDENTS || !Array.isArray(schoolData.STUDENTS) || schoolData.STUDENTS.length === 0) {
        schoolData.STUDENTS = existingData.STUDENTS;
      } else {
        existingData.STUDENTS.forEach((s: any) => {
          if (!s) return;
          const sId = String(s.id || '').trim();
          const sVnedu = String(s.vneduId || s.vnedu_code || '').trim();
          const sNameClass = `${String(s.name || '').trim().toLowerCase()}_${String(s.class || '').trim().toLowerCase()}`;

          const existsInIncoming = schoolData.STUDENTS.some((inc: any) => {
            if (!inc) return false;
            const incId = String(inc.id || '').trim();
            const incVnedu = String(inc.vneduId || inc.vnedu_code || '').trim();
            const incNameClass = `${String(inc.name || '').trim().toLowerCase()}_${String(inc.class || '').trim().toLowerCase()}`;

            if (sId && incId && sId === incId) return true;
            if (sVnedu && incVnedu && sVnedu === incVnedu) return true;
            if (sNameClass !== '_' && sNameClass === incNameClass) return true;
            return false;
          });

          if (!existsInIncoming) {
            schoolData.STUDENTS.push(s);
          }
        });
      }
    }

    // Preserve existing LOGS_DISCIPLINE
    if (existingData.LOGS_DISCIPLINE && Array.isArray(existingData.LOGS_DISCIPLINE) && existingData.LOGS_DISCIPLINE.length > 0) {
      if (!schoolData.LOGS_DISCIPLINE || !Array.isArray(schoolData.LOGS_DISCIPLINE) || schoolData.LOGS_DISCIPLINE.length === 0) {
        schoolData.LOGS_DISCIPLINE = existingData.LOGS_DISCIPLINE;
      } else {
        existingData.LOGS_DISCIPLINE.forEach((l: any) => {
          if (l && l.id && !schoolData.LOGS_DISCIPLINE.some((inc: any) => inc.id === l.id)) {
            schoolData.LOGS_DISCIPLINE.push(l);
          }
        });
      }
    }

    // Preserve existing ATTENDANCE
    if (existingData.ATTENDANCE && Array.isArray(existingData.ATTENDANCE) && existingData.ATTENDANCE.length > 0) {
      if (!schoolData.ATTENDANCE || !Array.isArray(schoolData.ATTENDANCE) || schoolData.ATTENDANCE.length === 0) {
        schoolData.ATTENDANCE = existingData.ATTENDANCE;
      } else {
        existingData.ATTENDANCE.forEach((a: any) => {
          if (a && a.student_id && a.date && !schoolData.ATTENDANCE.some((inc: any) => inc.student_id === a.student_id && inc.date === a.date)) {
            schoolData.ATTENDANCE.push(a);
          }
        });
      }
    }

    // Preserve existing COMPLAINTS
    if (existingData.COMPLAINTS && Array.isArray(existingData.COMPLAINTS) && existingData.COMPLAINTS.length > 0) {
      if (!schoolData.COMPLAINTS || !Array.isArray(schoolData.COMPLAINTS) || schoolData.COMPLAINTS.length === 0) {
        schoolData.COMPLAINTS = existingData.COMPLAINTS;
      } else {
        existingData.COMPLAINTS.forEach((c: any) => {
          if (c && c.id && !schoolData.COMPLAINTS.some((inc: any) => inc.id === c.id)) {
            schoolData.COMPLAINTS.push(c);
          }
        });
      }
    }
  }

  saveJson(file, schoolData);
  res.json({ success: true });
});

async function startServer() {
  const PORT = 3000;
  
  if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))) {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      const indexPath = path.join(process.cwd(), 'dist', 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.sendFile(path.join(process.cwd(), 'index.html'));
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Wildcard fallback for Vite dev mode to prevent 404 on custom SPA routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Central Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

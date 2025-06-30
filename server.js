import BlockedWebsite from './models/BlockedWebsite.js';

// Central log server for system-monitor agents
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Debug from 'debug';
import cron from 'node-cron';

import AppActivity from './models/AppActivity.js';
import WebActivity from './models/WebActivity.js';
import AlertLog from './models/AlertLog.js';
import Device from './models/Device.js';
import FsActivity from './models/FsActivity.js';
import cors from 'cors';

dotenv.config();
const debug = Debug('monitor:api');
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type']
}));


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🌐 Connected to MongoDB'))
  .catch(err => console.error('DB error', err));

app.post('/api/app', async (req, res) => {
  const payload = req.body;
  debug('⇨ App POST', payload);
  console.log('[ACTIVE_WINDOW][APP]', payload); // Log active window for app
  try {
    if (!payload.title) return res.status(400).json({ error: 'Missing title' });
    const doc = await AppActivity.create(payload);
    console.log('[ACTIVE_WINDOW][APP][SAVED]', doc); // Log after saving
    res.status(201).json({ success: true, id: doc._id });
  } catch (e) {
    console.error('App POST error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/web', async (req, res) => {
  const payload = req.body;
  debug('⇨ Web POST', payload);
  console.log('[ACTIVE_WINDOW][WEB]', payload); // Log active window for web
  try {
    // Save web activity as usual
    const doc = await WebActivity.create(payload);
    console.log('[ACTIVE_WINDOW][WEB][SAVED]', doc); // Log after saving

    // --- Improved Blocked Website Check ---
    // Fetch all blocked websites and check if any is present in title or url (case-insensitive, substring)
    const blockedSites = await BlockedWebsite.find();
    const titleLower = (payload.title || '').toLowerCase();
    const urlLower = (payload.url || '').toLowerCase();
    let matchedBlocked = null;
    // console.log('[BLOCKED_WEBSITES][CHECK]', { title: titleLower, url: urlLower });
    // console.log('[BLOCKED_WEBSITES][TOTAL]', blockedSites);
    for (const site of blockedSites) {
      const blockStr = (site.url || '').toLowerCase();
      if (blockStr && (titleLower.includes(blockStr) || urlLower.includes(blockStr))) {
        matchedBlocked = site;
        break;
      }
    }
    if (matchedBlocked) {
      // Save to AlertLog
      await AlertLog.create({
        blockedUrl: matchedBlocked.url,
        attemptedAt: new Date(),
        deviceName: payload.hostname || '',
        userName: payload.user || '',
        device: payload.device || '',
        duration: payload.duration || '',
        title: payload.title,
        url: payload.url,
        hostname: payload.hostname,
        severity: matchedBlocked.severity,
        reason: matchedBlocked.reason
      });
    }
    res.status(201).json({ success: true, id: doc._id });
  } catch (e) {
    console.error('Web POST error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/device', async (req, res) => {
  const { user, hostname, platform, freemem, totalmem, cpus, location, city, ...meta } = req.body;
  if (!user) return res.status(400).json({ error: 'Missing user' });
  try {
    const device = await Device.findOneAndUpdate(
      { user },
      {
        user,
        hostname,
        platform,
        freemem,
        totalmem,
        cpus,
        lastSeen: new Date(),
        online: true, 
        location, // Store location object (lat, lng, city)
        city,     // Store city separately
        meta
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, device });
  } catch (e) {
    console.error('Device upsert error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/device/status', async (req, res) => {
  const { user, status } = req.body;
  if (!user || !status) return res.status(400).json({ error: 'Missing user or status' });
  try {
    const online = status === 'online';
    const device = await Device.findOneAndUpdate(
      { user },
      { online, lastSeen: new Date() },
      { new: true }
    );
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.status(200).json({ success: true, device });
  } catch (e) {
    console.error('Device status update error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fs', async (req, res) => {
  const payload = req.body;
  debug('⇨ FS POST', payload);
  try {
    const doc = await FsActivity.create(payload);
    res.status(201).json({ success: true, id: doc._id });
  } catch (e) {
    console.error('FS POST error', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Device Offline Detection (Backend Heartbeat Timeout) ---
// Run every minute: mark devices offline if lastSeen > 2 minutes ago
cron.schedule('* * * * *', async () => {
  const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
  try {
    const result = await Device.updateMany(
      { online: true, lastSeen: { $lt: threshold } },
      { online: false }
    );
    if (result.modifiedCount > 0) {
      console.log(`[HEARTBEAT TIMEOUT] Marked ${result.modifiedCount} device(s) offline due to missed heartbeat.`);
    }
  } catch (e) {
    console.error('[HEARTBEAT TIMEOUT ERROR]', e.message);
  }
});

// Get all devices (with optional city filter)
app.get('/api/devices', async (req, res) => {
  try {
    const { city } = req.query;
    const query = {};
    if (city) query.city = city;
    const devices = await Device.find(query);
    res.json({ success: true, devices });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get recent web activity (last 20)
app.get('/api/web-activity', async (req, res) => {
  try {
    const logs = await WebActivity.find({}).sort({ ts: -1 }).limit(20);
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all web activity with filters
app.get('/api/web-activity/all', async (req, res) => {
  try {
    const { user, hostname, search, from, to } = req.query;
    const query = {};

    if (user) query.user = user;
    if (hostname) query.hostname = hostname;
    if (from || to) {
      query.ts = {};
      if (from) query.ts.$gte = new Date(from);
      if (to) query.ts.$lte = new Date(to);
    }
    
    // Full-text search (if applicable)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await WebActivity.find(query).sort({ ts: -1 });
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all fs activity logs with filters
app.get('/api/fs-activity/all', async (req, res) => {
  try {
    const { user, hostname, search, from, to } = req.query;
    const query = {};
    if (user) query.user = user;
    if (hostname) query.hostname = hostname;
    if (from || to) {
      query.ts = {};
      if (from) query.ts.$gte = new Date(from);
      if (to) query.ts.$lte = new Date(to);
    }
    if (search) {
      query.$or = [
        { user: { $regex: search, $options: 'i' } },
        { hostname: { $regex: search, $options: 'i' } },
        { event: { $regex: search, $options: 'i' } },
        { path: { $regex: search, $options: 'i' } }
      ];
    }
    const logs = await FsActivity.find(query).sort({ ts: -1 });
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all app activity logs with filters
app.get('/api/app-activity', async (req, res) => {
  try {
    const { user, hostname, app, title, from, to, search } = req.query;
    const query = {};
    if (user) query.user = user;
    if (hostname) query.hostname = hostname;
    if (app) query.app = app;
    if (title) query.title = { $regex: title, $options: 'i' };
    if (from || to) {
      query.ts = {};
      if (from) query.ts.$gte = new Date(from);
      if (to) query.ts.$lte = new Date(to);
    }
    if (search) {
      query.$or = [
        { user: { $regex: search, $options: 'i' } },
        { hostname: { $regex: search, $options: 'i' } },
        { app: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }
    const logs = await AppActivity.find(query).sort({ ts: -1 });
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// --- Blocked Websites APIs ---
// Get all blocked websites
app.get('/api/blocked-websites', async (req, res) => {
  try {
    const sites = await BlockedWebsite.find().sort({ createdAt: -1 });
    res.json(sites);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add a blocked website
app.post('/api/blocked-websites', async (req, res) => {
  try {
    const { url, severity, reason } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    const site = await BlockedWebsite.create({ url, severity, reason });
    res.status(201).json(site);
  } catch (e) {
    if (e.code === 11000) {
      res.status(409).json({ error: 'Site already blocked' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// Remove a blocked website
app.delete('/api/blocked-websites/:url', async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    const result = await BlockedWebsite.findOneAndDelete({ url });
    if (!result) return res.status(404).json({ error: 'Site not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update severity or reason for a blocked website
app.patch('/api/blocked-websites/:url', async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    const update = {};
    if (req.body.severity) update.severity = req.body.severity;
    if (typeof req.body.reason === 'string') update.reason = req.body.reason;
    const site = await BlockedWebsite.findOneAndUpdate({ url }, update, { new: true });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(site);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Alert Logs API for frontend table ---
app.get('/api/alert-logs/all', async (req, res) => {
  try {
    const alerts = await AlertLog.find().sort({ attemptedAt: -1 });
    res.json({ success: true, alerts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 API server listening on http://localhost:${port}`));

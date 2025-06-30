import mongoose from 'mongoose';

const BlockedWebsiteSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  reason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('BlockedWebsite', BlockedWebsiteSchema);

import mongoose from 'mongoose';

const AlertLogSchema = new mongoose.Schema({
  blockedUrl: { type: String, required: true },
  attemptedAt: { type: Date, default: Date.now },
  deviceName: String,
  userName: String,
  device: String,
  duration: String,
  title: String,
  url: String,
  hostname: String,
  severity: { type: String },
  reason: { type: String },
  // Add any other relevant fields as needed
});

export default mongoose.model('AlertLog', AlertLogSchema);

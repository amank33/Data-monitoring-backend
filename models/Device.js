import mongoose from 'mongoose';

const DeviceSchema = new mongoose.Schema({
  user: { type: String, required: true, unique: true },
  hostname: String,
  platform: String,
  freemem: Number,
  totalmem: Number,
  cpus: Number,
  online: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now },
  location: {
    lat: Number,
    lng: Number,
    city: String
  },
  city: String, // Store city separately for easy querying
  meta: mongoose.Schema.Types.Mixed
});

export default mongoose.model('Device', DeviceSchema);

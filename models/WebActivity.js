import mongoose from 'mongoose';

const WebActivitySchema = new mongoose.Schema({
  ts: Date,
  user: String,
  hostname: String,
  url: String,
  title: String,
  duration: String, // Duration in seconds
  category: { type: String, default: 'Other' },
  type: { type: String, default: 'website' }
});

export default mongoose.model('WebActivity', WebActivitySchema);

import mongoose from 'mongoose';

const AppActivitySchema = new mongoose.Schema({
  ts: Date,
  user: String,
  hostname: String,
  app: String,
  pid: Number,
  title: String,
  url: String,
  duration: String, // Duration in seconds
  type: { type: String, default: 'application' }
});

export default mongoose.model('AppActivity', AppActivitySchema);

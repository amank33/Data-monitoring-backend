import mongoose from 'mongoose';

const FsActivitySchema = new mongoose.Schema({
  ts: Date,
  user: String,
  hostname: String,
  event: String, // e.g. add, change, unlink
  path: String,
  type: { type: String, default: 'fs' }
});

export default mongoose.model('FsActivity', FsActivitySchema);

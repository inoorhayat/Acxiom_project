import mongoose from 'mongoose';
import { FOLLOWUP_STATUSES, FOLLOWUP_TYPES, RELATED_TYPES } from '../config/constants.js';

// Also used for Activity Management (Call, Meeting, Email, Task) via followUpType
const followUpSchema = new mongoose.Schema(
  {
    relatedType: { type: String, enum: RELATED_TYPES, required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    followUpType: { type: String, enum: FOLLOWUP_TYPES, default: 'Call' },
    followUpDate: { type: Date, required: true, index: true },
    status: { type: String, enum: FOLLOWUP_STATUSES, default: 'Planned', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    notes: { type: String, maxlength: 2000, default: '' },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('FollowUp', followUpSchema);

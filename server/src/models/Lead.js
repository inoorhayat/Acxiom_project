import mongoose from 'mongoose';
import { LEAD_STATUSES, LEAD_SOURCES, PRIORITIES } from '../config/constants.js';

const leadSchema = new mongoose.Schema(
  {
    leadName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 150, default: '' },
    phone: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true, maxlength: 150, default: '' },
    source: { type: String, enum: LEAD_SOURCES, default: 'Website' },
    status: { type: String, enum: LEAD_STATUSES, default: 'New', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    expectedValue: { type: Number, min: 0, max: 1e12, default: 0 },
    notes: { type: String, maxlength: 2000, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    convertedCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    convertedOpportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);

import mongoose from 'mongoose';
import { OPP_STAGES, LEAD_SOURCES } from '../config/constants.js';

const opportunitySchema = new mongoose.Schema(
  {
    opportunityName: { type: String, required: true, trim: true, maxlength: 150 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    stage: { type: String, enum: OPP_STAGES, default: 'Qualification', index: true },
    amount: { type: Number, min: 0, default: 0 },
    probability: { type: Number, min: 0, max: 100, default: 10 },
    expectedCloseDate: { type: Date, required: true },
    source: { type: String, enum: LEAD_SOURCES, default: 'Other' },
    notes: { type: String, maxlength: 2000, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    closedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Opportunity', opportunitySchema);

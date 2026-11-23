import mongoose from 'mongoose';
import { CUSTOMER_STATUSES } from '../config/constants.js';

const customerSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 150 },
    phone: { type: String, required: true, unique: true, trim: true },
    companyName: { type: String, trim: true, maxlength: 150, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    status: { type: String, enum: CUSTOMER_STATUSES, default: 'Active' },
    notes: { type: String, maxlength: 2000, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Customer', customerSchema);

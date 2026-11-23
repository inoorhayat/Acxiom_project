import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 150 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'SalesExecutive' },
    isActive: { type: Boolean, default: true },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockoutEnd: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Never expose password hashes or internal security fields in API responses
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.isLocked = !!(ret.lockoutEnd && ret.lockoutEnd > new Date());
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.failedLoginCount;
    delete ret.lockoutEnd;
    return ret;
  },
});

export default mongoose.model('User', userSchema);

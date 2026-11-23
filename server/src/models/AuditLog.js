import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    userName: { type: String, default: 'Anonymous' },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    entityName: { type: String, default: '' },
    recordId: { type: String, default: '' },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    result: { type: String, enum: ['Success', 'Failure'], default: 'Success' },
    details: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });

// Audit records are append-only: block any update or delete operation
[
  'updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteOne', 'deleteMany', 'findOneAndDelete',
].forEach((op) => {
  auditSchema.pre(op, function blockChange() {
    throw new Error('Audit records are append-only and cannot be modified.');
  });
});

export default mongoose.model('AuditLog', auditSchema);

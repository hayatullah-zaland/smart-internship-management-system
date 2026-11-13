import mongoose from 'mongoose';

const evaluationSchema = new mongoose.Schema({
  internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['academic', 'company'], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  comments: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

// One final assessment per evaluator type, even if a supervisor is replaced.
evaluationSchema.index({ internship: 1, type: 1 }, { unique: true });
export const Evaluation = mongoose.model('Evaluation', evaluationSchema);

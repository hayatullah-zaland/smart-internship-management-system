import { Evaluation } from '../model/evaluation.model.js';
import { Internship } from '../model/internship.model.js';
import { Company } from '../model/company.model.js';

export async function createEvaluation(req, res) {
  if (req.user.role !== 'academic_supervisor' && req.user.role !== 'company_representative') {
    return res.status(403).json({ success: false, message: 'Only assigned academic supervisors and company representatives can evaluate students.' });
  }
  const { internshipId, score, comments } = req.body || {};
  if (typeof internshipId !== 'string' || !/^[a-f0-9]{24}$/i.test(internshipId) ||
      typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100 ||
      typeof comments !== 'string' || !comments.trim() || comments.trim().length > 2000) {
    return res.status(400).json({ success: false, message: 'Provide an internship ID, score from 0 to 100, and comments (1-2000 characters).' });
  }
  const internship = await Internship.findById(internshipId);
  if (!internship) return res.status(404).json({ success: false, message: 'Internship not found.' });
  let type;
  if (req.user.role === 'academic_supervisor') {
    if (String(internship.supervisor) !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Internship not found.' });
    }
    type = 'academic';
  } else {
    const company = await Company.exists({ _id: internship.company, representative: req.user.id });
    if (!company) return res.status(404).json({ success: false, message: 'Internship not found.' });
    type = 'company';
  }
  if (internship.status !== 'completed') {
    return res.status(409).json({ success: false, message: 'Final evaluation requires a completed internship.' });
  }
  try {
    const evaluation = await Evaluation.create({
      internship: internship._id, student: internship.student, evaluator: req.user.id,
      type, score, comments: comments.trim(),
    });
    return res.status(201).json({ success: true, message: 'Final evaluation recorded.', data: { evaluation } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This final evaluation has already been recorded.' });
    throw error;
  }
}

export async function getEvaluations(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use valid page and limit values (limit: 1-100).' });
  }
  let filter;
  if (req.user.role === 'admin') filter = {};
  else if (req.user.role === 'student') filter = { student: req.user.id };
  else if (req.user.role === 'academic_supervisor' || req.user.role === 'company_representative') {
    // Evaluators see only assessments they wrote, not another evaluator's grades.
    filter = { evaluator: req.user.id };
  } else return res.status(403).json({ success: false, message: 'Evaluation access denied.' });
  const evaluations = await Evaluation.find(filter).populate('student', 'name email')
    .populate('evaluator', 'name').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data: { evaluations, page, limit } });
}

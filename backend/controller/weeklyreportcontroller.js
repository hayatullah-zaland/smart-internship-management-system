import { WeeklyReport } from '../model/weekly-report.model.js';
import { Internship } from '../model/internship.model.js';

export async function createWeeklyReport(req, res) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Only students can create weekly reports.' });
  }
  let { internshipId, weekNumber, summary, learning, challenges = '' } = req.body || {};
  if (typeof internshipId !== 'string' || !/^[a-f0-9]{24}$/i.test(internshipId)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid internship ID.' });
  }
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 10000) {
    return res.status(400).json({ success: false, message: 'Week number must be a whole number between 1 and 10000.' });
  }
  if (typeof summary !== 'string' || !summary.trim() || summary.trim().length > 5000 ||
      typeof learning !== 'string' || !learning.trim() || learning.trim().length > 3000 ||
      typeof challenges !== 'string' || challenges.trim().length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Summary (1-5000 characters) and learning (1-3000) are required. Challenges are optional, up to 2000 characters.',
    });
  }
  summary = summary.trim();
  learning = learning.trim();
  challenges = challenges.trim();

  const internship = await Internship.findOne({ _id: internshipId, student: req.user.id });
  if (!internship) return res.status(404).json({ success: false, message: 'Your internship was not found.' });
  if (internship.status !== 'active') {
    return res.status(409).json({ success: false, message: 'Weekly reports require an active internship.' });
  }

  // Week 1 is the first seven days from the internship start, not a calendar week.
  const dayInMilliseconds = 24 * 60 * 60 * 1000;
  const weekStart = new Date(internship.startDate.getTime() + (weekNumber - 1) * 7 * dayInMilliseconds);
  const weekEnd = new Date(Math.min(weekStart.getTime() + 6 * dayInMilliseconds, internship.endDate.getTime()));
  const today = new Date().toISOString().slice(0, 10);
  if (weekStart > internship.endDate || weekStart.toISOString().slice(0, 10) > today) {
    return res.status(400).json({ success: false, message: 'Choose a week within your internship that has already started (UTC).' });
  }

  try {
    const report = await WeeklyReport.create({
      internship: internship._id, student: req.user.id, weekNumber, weekStart, weekEnd,
      summary, learning, challenges,
    });
    return res.status(201).json({ success: true, message: 'Weekly report draft created.', data: { report } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A report already exists for this internship and week.' });
    }
    throw error;
  }
}

export async function updateWeeklyReport(req, res) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Only students can edit weekly reports.' });
  }
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid report ID.' });
  }

  const report = await WeeklyReport.findOne({ _id: id, student: req.user.id });
  if (!report) return res.status(404).json({ success: false, message: 'Your weekly report was not found.' });
  if (report.status !== 'draft') {
    return res.status(409).json({ success: false, message: 'Only draft reports can be edited.' });
  }

  // Keep old values when the student updates only one field.
  const body = req.body || {};
  if (body.summary === undefined && body.learning === undefined && body.challenges === undefined) {
    return res.status(400).json({ success: false, message: 'Provide summary, learning, or challenges to update.' });
  }
  const summary = body.summary === undefined ? report.summary : body.summary;
  const learning = body.learning === undefined ? report.learning : body.learning;
  const challenges = body.challenges === undefined ? report.challenges : body.challenges;
  if (typeof summary !== 'string' || !summary.trim() || summary.trim().length > 5000 ||
      typeof learning !== 'string' || !learning.trim() || learning.trim().length > 3000 ||
      typeof challenges !== 'string' || challenges.trim().length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Summary (1-5000 characters) and learning (1-3000) are required. Challenges are optional, up to 2000 characters.',
    });
  }
  const active = await Internship.exists({ _id: report.internship, student: req.user.id, status: 'active' });
  if (!active) return res.status(409).json({ success: false, message: 'Weekly reports require an active internship.' });

  // Matching the draft and version prevents overwriting a submitted or newer report.
  const updated = await WeeklyReport.findOneAndUpdate(
    { _id: id, student: req.user.id, status: 'draft', __v: report.__v },
    { $set: { summary: summary.trim(), learning: learning.trim(), challenges: challenges.trim() }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Report changed during your request. Refresh and try again.' });
  res.json({ success: true, message: 'Weekly report draft updated.', data: { report: updated } });
}

export async function submitWeeklyReport(req, res) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Only students can submit weekly reports.' });
  }
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid report ID.' });
  }
  const report = await WeeklyReport.findOne({ _id: id, student: req.user.id });
  if (!report) return res.status(404).json({ success: false, message: 'Your weekly report was not found.' });
  if (report.status !== 'draft') {
    return res.status(409).json({ success: false, message: 'Only draft reports can be submitted.' });
  }
  const active = await Internship.exists({ _id: report.internship, student: req.user.id, status: 'active' });
  if (!active) return res.status(409).json({ success: false, message: 'Weekly reports require an active internship.' });

  const updated = await WeeklyReport.findOneAndUpdate(
    { _id: id, student: req.user.id, status: 'draft' },
    { $set: { status: 'submitted', submittedAt: new Date() }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Report is no longer a draft. Refresh and try again.' });
  res.json({ success: true, message: 'Weekly report submitted successfully.', data: { report: updated } });
}

export async function getWeeklyReports(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use a page between 1 and 1000000 and a limit between 1 and 100, both whole numbers.' });
  }
  let filter;
  if (req.user.role === 'student') filter = { student: req.user.id };
  else if (req.user.role === 'admin') filter = {};
  else return res.status(403).json({ success: false, message: 'Only students and admins can access weekly reports here.' });

  const reports = await WeeklyReport.find(filter)
    .populate('student', 'name email')
    .populate('internship', 'company supervisor startDate endDate status')
    .sort({ weekStart: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ success: true, data: { reports, page, limit } });
}

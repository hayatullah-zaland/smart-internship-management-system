import validator from 'validator';
import { DailyReport } from '../model/daily-report.model.js';
import { Internship } from '../model/internship.model.js';

function validateContent({ hours, tasks, learning, challenges = '' }) {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0.25 || hours > 24) {
    return { error: 'Hours must be a number between 0.25 and 24.' };
  }
  if (typeof tasks !== 'string' || !tasks.trim() || tasks.trim().length > 5000 ||
      typeof learning !== 'string' || !learning.trim() || learning.trim().length > 3000 ||
      typeof challenges !== 'string' || challenges.trim().length > 2000) {
    return { error: 'Tasks (1-5000 characters) and learning (1-3000) are required. Challenges are optional, up to 2000 characters.' };
  }
  return { data: { hours, tasks: tasks.trim(), learning: learning.trim(), challenges: challenges.trim() } };
}

export async function createDailyReport(req, res) {
  const { internshipId, date } = req.body || {};
  if (typeof internshipId !== 'string' || !/^[a-f0-9]{24}$/i.test(internshipId)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid internship ID.' });
  }
  // Calendar dates use UTC, matching the placement date convention.
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !validator.isISO8601(date, { strict: true }) || date > new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ success: false, message: 'Use a valid YYYY-MM-DD report date, not in the future (UTC).' });
  }
  const content = validateContent(req.body);
  if (content.error) return res.status(400).json({ success: false, message: content.error });

  const internship = await Internship.findOne({ _id: internshipId, student: req.user.id });
  if (!internship) {
    return res.status(404).json({ success: false, message: 'Your internship was not found.' });
  }
  if (internship.status !== 'active') {
    return res.status(409).json({ success: false, message: 'Daily reports require an active internship.' });
  }
  if (date < internship.startDate.toISOString().slice(0, 10) || date > internship.endDate.toISOString().slice(0, 10)) {
    return res.status(400).json({ success: false, message: 'Report date must fall within the internship dates.' });
  }
  try {
    const report = await DailyReport.create({
      internship: internship._id, student: req.user.id, date: new Date(date), ...content.data,
    });
    return res.status(201).json({ success: true, message: 'Daily report draft created.', data: { report } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A report already exists for this internship and date.' });
    }
    throw error;
  }
}

export async function updateDailyReport(req, res) {
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid report ID.' });
  }
  const report = await DailyReport.findOne({ _id: id, student: req.user.id });
  if (!report) return res.status(404).json({ success: false, message: 'Your daily report was not found.' });
  if (report.status !== 'draft' && report.status !== 'changes_requested') {
    return res.status(409).json({ success: false, message: 'Only drafts or reports needing changes can be edited.' });
  }
  const body = req.body || {};
  const fields = ['hours', 'tasks', 'learning', 'challenges'];
  if (!fields.some((field) => body[field] !== undefined)) {
    return res.status(400).json({ success: false, message: 'Provide hours, tasks, learning, or challenges to update.' });
  }
  const content = validateContent({
    hours: body.hours === undefined ? report.hours : body.hours,
    tasks: body.tasks === undefined ? report.tasks : body.tasks,
    learning: body.learning === undefined ? report.learning : body.learning,
    challenges: body.challenges === undefined ? report.challenges : body.challenges,
  });
  if (content.error) return res.status(400).json({ success: false, message: content.error });
  const active = await Internship.exists({ _id: report.internship, student: req.user.id, status: 'active' });
  if (!active) return res.status(409).json({ success: false, message: 'Daily reports require an active internship.' });

  const updated = await DailyReport.findOneAndUpdate(
    { _id: id, student: req.user.id, status: report.status, __v: report.__v },
    { $set: content.data, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Report changed during your request. Refresh and try again.' });
  res.json({ success: true, message: 'Daily report updated.', data: { report: updated } });
}

export async function submitDailyReport(req, res) {
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid report ID.' });
  }
  const report = await DailyReport.findOne({ _id: id, student: req.user.id });
  if (!report) return res.status(404).json({ success: false, message: 'Your daily report was not found.' });
  if (report.status !== 'draft' && report.status !== 'changes_requested') {
    return res.status(409).json({ success: false, message: 'Only drafts or reports needing changes can be submitted.' });
  }
  const active = await Internship.exists({ _id: report.internship, student: req.user.id, status: 'active' });
  if (!active) return res.status(409).json({ success: false, message: 'Daily reports require an active internship.' });

  const updated = await DailyReport.findOneAndUpdate(
    { _id: id, student: req.user.id, status: report.status },
    { $set: { status: 'submitted', submittedAt: new Date() }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Report status changed. Refresh and try again.' });
  res.json({ success: true, message: 'Daily report submitted successfully.', data: { report: updated } });
}

export async function approveDailyReport(req, res) {
  // 1. Only an academic supervisor can approve a report.
  if (req.user.role !== 'academic_supervisor') {
    return res.status(403).json({ success: false, message: 'Only the assigned academic supervisor can approve daily reports.' });
  }
  const { id } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid report ID.' });
  }

  // 2. Check that this report belongs to the supervisor's assigned internship.
  const report = await DailyReport.findById(id);
  if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
  const assigned = await Internship.exists({ _id: report.internship, supervisor: req.user.id });
  if (!assigned) return res.status(404).json({ success: false, message: 'Report not found.' });
  if (report.status !== 'submitted') {
    return res.status(409).json({ success: false, message: 'Only submitted reports can be approved.' });
  }

  // 3. Record approval once, together with the reviewer and time.
  const updated = await DailyReport.findOneAndUpdate(
    { _id: id, status: 'submitted' },
    { $set: { status: 'approved', reviewedBy: req.user.id, reviewedAt: new Date() }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Report has already been reviewed. Refresh and try again.' });
  res.json({ success: true, message: 'Daily report approved.', data: { report: updated } });
}

export async function requestDailyReportChanges(req, res) {
  // 1. Only the assigned academic supervisor may request changes.
  if (req.user.role !== 'academic_supervisor') {
    return res.status(403).json({ success: false, message: 'Only the assigned academic supervisor can request changes.' });
  }
  const { id } = req.params;
  const { feedback } = req.body || {};
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid report ID.' });
  }
  if (typeof feedback !== 'string' || !feedback.trim() || feedback.trim().length > 1000) {
    return res.status(400).json({ success: false, message: 'Feedback must be between 1 and 1000 characters.' });
  }

  // 2. Find the report and check the supervisor's assignment.
  const report = await DailyReport.findById(id);
  if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
  const assigned = await Internship.exists({ _id: report.internship, supervisor: req.user.id });
  if (!assigned) return res.status(404).json({ success: false, message: 'Report not found.' });
  if (report.status !== 'submitted') {
    return res.status(409).json({ success: false, message: 'Only submitted reports can be returned for changes.' });
  }

  // 3. Save the feedback and allow the student to edit again.
  const updated = await DailyReport.findOneAndUpdate(
    { _id: id, status: 'submitted' },
    { $set: {
      status: 'changes_requested', feedback: feedback.trim(),
      reviewedBy: req.user.id, reviewedAt: new Date(),
    }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) return res.status(409).json({ success: false, message: 'Report has already been reviewed. Refresh and try again.' });
  res.json({ success: true, message: 'Report returned for changes.', data: { report: updated } });
}

export async function getDailyReports(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use a page between 1 and 1000000 and a limit between 1 and 100, both whole numbers.' });
  }
  let filter;
  if (req.user.role === 'admin') filter = {};
  else if (req.user.role === 'student') filter = { student: req.user.id };
  else if (req.user.role === 'academic_supervisor') {
    const internshipIds = await Internship.find({ supervisor: req.user.id }).distinct('_id');
    filter = { internship: { $in: internshipIds }, status: { $in: ['submitted', 'approved', 'changes_requested'] } };
  } else return res.status(403).json({ success: false, message: 'You cannot access daily reports here.' });

  const reports = await DailyReport.find(filter)
    .populate('student', 'name email')
    .populate('internship', 'company supervisor startDate endDate status')
    .sort({ date: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ success: true, data: { reports, page, limit } });
}

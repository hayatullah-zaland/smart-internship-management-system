import { User } from '../model/user.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Application } from '../model/application.model.js';
import { Internship } from '../model/internship.model.js';
import { Evaluation } from '../model/evaluation.model.js';
import { Company } from '../model/company.model.js';

const LIMIT = 30;
const roles = ['student', 'admin', 'academic_supervisor', 'company_representative'];
const readFields = { messages: 'messagesReadAt', notifications: 'notificationsReadAt' };

function item(kind, record, occurredAt, title, body, href) {
  const date = new Date(occurredAt);
  if (!occurredAt || !Number.isFinite(date.getTime())) return null;
  return { id: `${kind}:${record._id}:${date.getTime()}`, title, body, href, occurredAt: date.toISOString() };
}

async function recent(Model, filter, timeField, fields, through, populate) {
  let query = Model.find({ ...filter, [timeField]: { $ne: null, $lte: through } })
    .select(fields).sort({ [timeField]: -1, _id: -1 }).limit(LIMIT);
  if (populate) query = query.populate(populate, 'name');
  return query.lean();
}

export async function getInbox(req, res) {
  const { id, role } = req.user;
  if (!roles.includes(role)) return res.status(403).json({ success: false, message: 'Inbox access denied.' });
  const through = new Date();
  const state = await User.findById(id).select('messagesReadAt notificationsReadAt').lean();
  if (!state) return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  const messages = [];
  const notifications = [];
  if (role === 'student') {
    const feedback = await recent(DailyReport, { student: id, status: 'changes_requested', feedback: { $ne: '' } },
      'reviewedAt', 'date feedback reviewedAt reviewedBy', through, 'reviewedBy');
    for (const report of feedback) messages.push(item('daily-feedback', report, report.reviewedAt,
      `Daily report feedback - ${report.date.toISOString().slice(0, 10)}`,
      `${report.reviewedBy?.name || 'Academic supervisor'}: ${report.feedback}`, '/daily-reports'));
    const approvals = await recent(DailyReport, { student: id, status: 'approved' }, 'reviewedAt', 'date reviewedAt', through);
    for (const report of approvals) notifications.push(item('daily-approved', report, report.reviewedAt,
      'Daily report approved', `Your report for ${report.date.toISOString().slice(0, 10)} was approved by your teacher.`, '/daily-reports'));
    const decisions = await recent(Application, { student: id, status: { $in: ['approved', 'rejected'] } },
      'reviewedAt', 'status reviewedAt rejectionReason', through);
    for (const application of decisions) notifications.push(item('application-decision', application, application.reviewedAt,
      `Application ${application.status}`, application.rejectionReason || `Your internship application was ${application.status}.`, '/applications'));
    const evaluations = await recent(Evaluation, { student: id }, 'createdAt', 'type score createdAt', through);
    for (const evaluation of evaluations) notifications.push(item('evaluation-recorded', evaluation, evaluation.createdAt,
      `${evaluation.type === 'academic' ? 'Academic' : 'Company'} evaluation recorded`, `Your final score is ${evaluation.score}/100.`, '/evaluations'));
  }

  if (['student', 'admin', 'academic_supervisor'].includes(role)) {
    let scope = {};
    if (role === 'student') scope = { student: id };
    if (role === 'academic_supervisor') {
      const internshipIds = await Internship.find({ supervisor: id }).distinct('_id');
      scope = { internship: { $in: internshipIds }, status: 'submitted' };
    }
    const daily = await recent(DailyReport, scope, 'submittedAt', 'date submittedAt student', through,
      role === 'student' ? undefined : 'student');
    for (const report of daily) notifications.push(item('daily-submitted', report, report.submittedAt,
      'Daily report submitted', `${role === 'student' ? 'Your' : `${report.student?.name || 'A student'}\'s`} report for ${report.date.toISOString().slice(0, 10)} was submitted.`, '/daily-reports'));
    // Weekly reports currently have submission only, not a teacher approval workflow.
    if (role !== 'academic_supervisor') {
      const weekly = await recent(WeeklyReport, role === 'student' ? { student: id } : {},
        'submittedAt', 'weekNumber submittedAt student', through, role === 'student' ? undefined : 'student');
      for (const report of weekly) notifications.push(item('weekly-submitted', report, report.submittedAt,
        'Weekly report submitted', `${role === 'student' ? 'Your' : `${report.student?.name || 'A student'}\'s`} week ${report.weekNumber} report was submitted.`, '/weekly-reports'));
    }
  }

  if (role === 'admin') {
    const applications = await recent(Application, { status: { $in: ['pending', 'under_review'] } },
      'createdAt', 'student createdAt', through, 'student');
    for (const application of applications) notifications.push(item('application-received', application, application.createdAt,
      'New internship application', `${application.student?.name || 'A student'} submitted an application.`, '/admin/applications'));
  } else {
    let scope = role === 'student' ? { student: id } : { supervisor: id };
    if (role === 'company_representative') {
      const companyIds = await Company.find({ representative: id }).distinct('_id');
      scope = { company: { $in: companyIds }, status: 'completed' };
    }
    const internships = await Internship.find(scope).select('status statusHistory createdAt updatedAt')
      .sort({ updatedAt: -1, _id: -1 }).limit(LIMIT).lean();
    for (const internship of internships) {
      const transition = internship.statusHistory?.findLast((entry) => entry.to === internship.status);
      const occurredAt = transition?.changedAt || (internship.status === 'assigned' ? internship.createdAt : null);
      notifications.push(item('internship-status', internship, occurredAt,
        `Internship ${internship.status}`, role === 'company_representative'
          ? 'A company internship is completed. View its final assessment in Evaluations.'
          : `An internship ${role === 'student' ? 'for you' : 'assigned to you'} is ${internship.status}.`,
        role === 'company_representative' ? '/evaluations' : '/internships'));
    }
  }

  function channelItems(items, field) {
    const readAt = state[field] ? new Date(state[field]).getTime() : 0;
    return items.filter((entry) => entry && Date.parse(entry.occurredAt) <= through.getTime())
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))
      .slice(0, LIMIT).map((entry) => ({ ...entry, read: Date.parse(entry.occurredAt) <= readAt }));
  }
  const data = {
    userId: id, role, through: through.toISOString(),
    messages: channelItems(messages, readFields.messages),
    notifications: channelItems(notifications, readFields.notifications),
  };
  data.unread = { messages: data.messages.filter((entry) => !entry.read).length, notifications: data.notifications.filter((entry) => !entry.read).length };
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data });
}

export async function markInboxRead(req, res) {
  const { channel, through } = req.body || {};
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Inbox access denied.' });
  if (!Object.hasOwn(readFields, channel) || typeof through !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(through)
    || !Number.isFinite(Date.parse(through)) || new Date(through).toISOString() !== through || Date.parse(through) > Date.now()
    || Object.keys(req.body).some((key) => !['channel', 'through'].includes(key))) {
    return res.status(400).json({ success: false, message: 'Choose a valid inbox channel and a past snapshot time.' });
  }
  const field = readFields[channel];
  // Never move the cursor backward, or clear activity newer than the displayed snapshot.
  const saved = await User.findOneAndUpdate({ _id: req.user.id, isActive: true },
    { $max: { [field]: new Date(through) } }, { returnDocument: 'after' }).select(field).lean();
  if (!saved) return res.status(401).json({ success: false, message: 'Your account is unavailable.' });
  res.json({ success: true, data: { channel, readAt: saved[field].toISOString() } });
}

import validator from 'validator';
import { Internship } from '../model/internship.model.js';
import { Application } from '../model/application.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { Company } from '../model/company.model.js';
import { User } from '../model/user.model.js';

export async function updateInternshipStatus(req, res) {
  const { id } = req.params;
  const { status, reason } = req.body || {};
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid internship ID.' });
  }
  if (!['active', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Choose active, completed, or cancelled.' });
  }
  if ((reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 1000)) ||
      (status === 'cancelled' && (typeof reason !== 'string' || !reason.trim()))) {
    return res.status(400).json({ success: false, message: 'Cancellation requires a reason. Reasons must be text with at most 1000 characters.' });
  }

  const internship = await Internship.findById(id);
  if (!internship) {
    return res.status(404).json({ success: false, message: 'Internship not found.' });
  }
  const allowed = {
    assigned: ['active', 'cancelled'],
    active: ['completed', 'cancelled'],
  };
  if (!allowed[internship.status]?.includes(status)) {
    return res.status(409).json({ success: false, message: 'This internship cannot move from its current status to the requested status.' });
  }

  // Save the transition and its history together; reject concurrent stale changes.
  const updated = await Internship.findOneAndUpdate(
    { _id: id, status: internship.status },
    {
      $set: { status },
      $push: { statusHistory: {
        from: internship.status, to: status, changedBy: req.user.id,
        changedAt: new Date(), reason: reason?.trim() || '',
      } },
    },
    { new: true, runValidators: true },
  );
  if (!updated) {
    return res.status(409).json({ success: false, message: 'The internship changed during your request. Refresh and try again.' });
  }
  res.status(200).json({ success: true, message: 'Internship status updated successfully.', data: { internship: updated } });
}

export async function createInternship(req, res) {
  const { applicationId, supervisorId, startDate, endDate } = req.body || {};
  if (typeof applicationId !== 'string' || !/^[a-f0-9]{24}$/i.test(applicationId) ||
      typeof supervisorId !== 'string' || !/^[a-f0-9]{24}$/i.test(supervisorId)) {
    return res.status(400).json({ success: false, message: 'Please provide valid application and supervisor IDs.' });
  }
  // Date-only values are interpreted as UTC calendar dates.
  if (![startDate, endDate].every((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      validator.isISO8601(date, { strict: true })) || Date.parse(endDate) <= Date.parse(startDate)) {
    return res.status(400).json({ success: false, message: 'Use valid YYYY-MM-DD dates; end date must be after start date.' });
  }

  const application = await Application.findById(applicationId);
  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found.' });
  }
  if (application.status !== 'approved') {
    return res.status(409).json({ success: false, message: 'Only approved applications can become internships.' });
  }
  const student = await User.findById(application.student);
  const supervisor = await User.findById(supervisorId);
  if (!student || !student.isActive || student.role !== 'student') {
    return res.status(400).json({ success: false, message: 'The application must belong to an active student.' });
  }
  if (!supervisor || !supervisor.isActive || supervisor.role !== 'academic_supervisor') {
    return res.status(400).json({ success: false, message: 'Please choose an active academic supervisor.' });
  }
  const opportunity = await Opportunity.findById(application.opportunity);
  if (!opportunity || !await Company.exists({ _id: opportunity.company })) {
    return res.status(404).json({ success: false, message: 'The opportunity or its company is unavailable.' });
  }
  if (await Internship.exists({ $or: [
    { application: application._id },
    { student: student._id, status: { $in: ['assigned', 'active'] } },
  ] })) {
    return res.status(409).json({ success: false, message: 'This application is already placed or the student already has an ongoing internship.' });
  }

  // Unique indexes reserve each seat atomically, even if two admins assign at once.
  for (let attempt = 0; attempt < 3; attempt++) {
    const occupied = await Internship.find({ opportunity: opportunity._id }).select('slot').lean();
    const slots = new Set(occupied.map((internship) => internship.slot));
    let slot = 1;
    while (slots.has(slot)) slot++;
    if (slot > opportunity.capacity) {
      return res.status(409).json({ success: false, message: 'This opportunity has no available placement capacity.' });
    }
    try {
      const internship = await Internship.create({
        application: application._id, student: student._id, opportunity: opportunity._id,
        company: opportunity.company, supervisor: supervisor._id, createdBy: req.user.id,
        startDate: new Date(startDate), endDate: new Date(endDate), slot,
      });
      const data = internship.toObject();
      delete data.slot;
      return res.status(201).json({ success: true, message: 'Internship assigned successfully.', data: { internship: data } });
    } catch (error) {
      if (error.code !== 11000) throw error;
      if (error.keyPattern?.opportunity && error.keyPattern?.slot) continue;
      return res.status(409).json({ success: false, message: 'This application is already placed or the student already has an ongoing internship.' });
    }
  }
  return res.status(409).json({ success: false, message: 'Another assignment reserved this seat. Please retry.' });
}

export async function getInternships(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use a page between 1 and 1000000 and a limit between 1 and 100, both whole numbers.' });
  }
  let filter;
  if (req.user.role === 'admin') filter = {};
  else if (req.user.role === 'student') filter = { student: req.user.id };
  else if (req.user.role === 'academic_supervisor') filter = { supervisor: req.user.id };
  else return res.status(403).json({ success: false, message: 'Internship access is limited to admins, students and assigned academic supervisors here.' });

  const internships = await Internship.find(filter)
    .populate('student', 'name email')
    .populate('supervisor', 'name email')
    .populate('company', 'name address')
    .populate('opportunity', 'title')
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.status(200).json({ success: true, data: { internships, page, limit } });
}

import { Application } from '../model/application.model.js';
import { Opportunity } from '../model/opportunity.model.js';

export async function createApplication(req, res) {
  const { opportunityId } = req.body || {};
  if (typeof opportunityId !== 'string' || !/^[a-f0-9]{24}$/i.test(opportunityId)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid opportunity ID.' });
  }

  const opportunity = await Opportunity.findById(opportunityId);
  if (!opportunity) {
    return res.status(404).json({ success: false, message: 'Opportunity not found.' });
  }
  if (opportunity.status !== 'open' || opportunity.deadline.getTime() <= Date.now()) {
    return res.status(400).json({ success: false, message: 'This opportunity is closed or its deadline has passed.' });
  }

  // Accept only the opportunity ID; identity and status are server-controlled.
  try {
    const application = await Application.create({ student: req.user.id, opportunity: opportunity._id });
    return res.status(201).json({ success: true, message: 'Application submitted successfully.', data: { application } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already applied for this opportunity.' });
    }
    throw error;
  }
}

export async function getMyApplications(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use a page between 1 and 1000000 and a limit between 1 and 100, both whole numbers.' });
  }

  const applications = await Application.find({ student: req.user.id })
    .populate({ path: 'opportunity', select: 'title company deadline status', populate: { path: 'company', select: 'name' } })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.status(200).json({ success: true, data: { applications, page, limit } });
}

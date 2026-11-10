import validator from 'validator';
import { Company } from '../model/company.model.js';
import { Opportunity } from '../model/opportunity.model.js';

export async function createOpportunity(req, res) {
  if (req.user.role !== 'company_representative') {
    return res.status(403).json({ success: false, message: 'Only company representatives can publish opportunities.' });
  }

  let { title, description, companyId, deadline, capacity } = req.body || {};
  if (typeof title !== 'string' || typeof description !== 'string' ||
      typeof companyId !== 'string' || !/^[a-f0-9]{24}$/i.test(companyId)) {
    return res.status(400).json({ success: false, message: 'Please provide a title, description, and valid company ID.' });
  }
  title = title.trim();
  description = description.trim();
  if (title.length < 2 || title.length > 150 || !description || description.length > 5000) {
    return res.status(400).json({ success: false, message: 'Title must be 2-150 characters and description 1-5000 characters.' });
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
    return res.status(400).json({ success: false, message: 'Capacity must be a whole number between 1 and 1000.' });
  }
  if (typeof deadline !== 'string' || !validator.isISO8601(deadline, { strict: true, strictSeparator: true }) ||
      !/T.*(Z|[+-]\d{2}:\d{2})$/i.test(deadline) || !Number.isFinite(Date.parse(deadline)) ||
      Date.parse(deadline) <= Date.now()) {
    return res.status(400).json({ success: false, message: 'Deadline must be a future ISO date and time with a timezone, such as 2027-01-31T23:59:00Z.' });
  }

  // Check the current company assignment, not just the account's role.
  const company = await Company.findOne({ _id: companyId, representative: req.user.id });
  if (!company) {
    return res.status(403).json({ success: false, message: 'You can publish opportunities only for your assigned company.' });
  }
  const opportunity = await Opportunity.create({
    title, description, company: company._id, createdBy: req.user.id,
    deadline: new Date(deadline), capacity,
  });
  res.status(201).json({ success: true, message: 'Opportunity created successfully.', data: { opportunity } });
}

export async function getOpportunities(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use a page between 1 and 1000000 and a limit between 1 and 100, both whole numbers.' });
  }

  // Expired, closed, and archived opportunities are not in this browsing list.
  const opportunities = await Opportunity.find({ status: 'open', deadline: { $gt: new Date() } })
    .select('title description company deadline capacity status createdAt')
    .populate('company', 'name address')
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.status(200).json({ success: true, data: { opportunities, page, limit } });
}

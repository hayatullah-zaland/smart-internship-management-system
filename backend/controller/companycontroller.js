import validator from 'validator';
import { Company } from '../model/company.model.js';
import { User } from '../model/user.model.js';

export async function assignRepresentative(req, res) {
  const { id } = req.params;
  const { representativeId } = req.body || {};
  if (!/^[a-f0-9]{24}$/i.test(id) || typeof representativeId !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(representativeId)) {
    return res.status(400).json({ success: false, message: 'Please provide valid company and representative IDs.' });
  }

  const company = await Company.findById(id);
  if (!company) {
    return res.status(404).json({ success: false, message: 'Company not found.' });
  }
  const representative = await User.findById(representativeId);
  if (!representative) {
    return res.status(404).json({ success: false, message: 'Representative account not found.' });
  }
  if (!representative.isActive || representative.role !== 'company_representative') {
    return res.status(400).json({ success: false, message: 'Please choose an active company representative account.' });
  }

  // Each company has one representative; assigning again replaces that link.
  company.representative = representative._id;
  await company.save();
  res.status(200).json({
    success: true,
    message: 'Company representative assigned successfully.',
    data: { company },
  });
}

export async function createCompany(req, res) {
  let { name, address, contactEmail } = req.body || {};
  if (typeof name !== 'string' || typeof address !== 'string' || typeof contactEmail !== 'string') {
    return res.status(400).json({ success: false, message: 'Company name, address, and contact email are required and must be text.' });
  }

  name = name.trim();
  address = address.trim();
  contactEmail = contactEmail.trim().toLowerCase();
  if (name.length < 2 || name.length > 150) {
    return res.status(400).json({ success: false, message: 'Company name must be between 2 and 150 characters.' });
  }
  if (!address || address.length > 300) {
    return res.status(400).json({ success: false, message: 'Address is required and must not exceed 300 characters.' });
  }
  if (contactEmail.length > 254 || !validator.isEmail(contactEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid company contact email.' });
  }

  // Save only approved fields; the administrator ID comes from the token.
  const company = await Company.create({ name, address, contactEmail, createdBy: req.user.id });
  res.status(201).json({ success: true, message: 'Company created successfully.', data: { company } });
}

export async function getCompanies(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Page must be between 1 and 1000000, and limit between 1 and 100. Use whole numbers.',
    });
  }

  const companies = await Company.find()
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.status(200).json({ success: true, data: { companies, page, limit } });
}

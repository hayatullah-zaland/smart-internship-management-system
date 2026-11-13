import { Department } from '../model/department.model.js';

export async function createDepartment(req, res) {
  const { name, code } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 ||
      typeof code !== 'string' || !/^[a-z0-9-]{1,20}$/i.test(code.trim())) {
    return res.status(400).json({ success: false, message: 'Provide a name (2-100 characters) and a code (1-20 letters, numbers or hyphens).' });
  }
  try {
    const department = await Department.create({ name: name.trim(), code: code.trim().toUpperCase() });
    return res.status(201).json({ success: true, message: 'Department created.', data: { department } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This department code already exists.' });
    throw error;
  }
}

export async function getDepartments(req, res) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Use valid page and limit values (limit: 1-100).' });
  }
  const departments = await Department.find().sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data: { departments, page, limit } });
}

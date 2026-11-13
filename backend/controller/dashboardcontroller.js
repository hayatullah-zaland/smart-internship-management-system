import { User } from '../model/user.model.js';
import { Company } from '../model/company.model.js';
import { Department } from '../model/department.model.js';
import { Opportunity } from '../model/opportunity.model.js';
import { Application } from '../model/application.model.js';
import { Internship } from '../model/internship.model.js';
import { DailyReport } from '../model/daily-report.model.js';
import { WeeklyReport } from '../model/weekly-report.model.js';
import { Evaluation } from '../model/evaluation.model.js';

export async function getDashboard(req, res) {
  const role = req.user.role;
  let stats;
  if (role === 'admin') {
    stats = {
      students: await User.countDocuments({ role: 'student' }),
      companies: await Company.countDocuments({}),
      departments: await Department.countDocuments({}),
      pendingApplications: await Application.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      activeInternships: await Internship.countDocuments({ status: 'active' }),
      completedInternships: await Internship.countDocuments({ status: 'completed' }),
    };
  } else if (role === 'student') {
    stats = {
      applications: await Application.countDocuments({ student: req.user.id }),
      activeInternships: await Internship.countDocuments({ student: req.user.id, status: 'active' }),
      dailyReports: await DailyReport.countDocuments({ student: req.user.id }),
      weeklyReports: await WeeklyReport.countDocuments({ student: req.user.id }),
      evaluations: await Evaluation.countDocuments({ student: req.user.id }),
    };
  } else if (role === 'academic_supervisor') {
    const internshipIds = await Internship.find({ supervisor: req.user.id }).distinct('_id');
    stats = {
      assignedInternships: internshipIds.length,
      activeInternships: await Internship.countDocuments({ supervisor: req.user.id, status: 'active' }),
      submittedDailyReports: await DailyReport.countDocuments({ internship: { $in: internshipIds }, status: 'submitted' }),
      submittedWeeklyReports: await WeeklyReport.countDocuments({ internship: { $in: internshipIds }, status: 'submitted' }),
      evaluations: await Evaluation.countDocuments({ evaluator: req.user.id }),
    };
  } else if (role === 'company_representative') {
    const companyIds = await Company.find({ representative: req.user.id }).distinct('_id');
    stats = {
      companies: companyIds.length,
      openOpportunities: await Opportunity.countDocuments({ company: { $in: companyIds }, status: 'open', deadline: { $gt: new Date() } }),
      activeInternships: await Internship.countDocuments({ company: { $in: companyIds }, status: 'active' }),
      completedInternships: await Internship.countDocuments({ company: { $in: companyIds }, status: 'completed' }),
      evaluations: await Evaluation.countDocuments({ evaluator: req.user.id }),
    };
  } else return res.status(403).json({ success: false, message: 'Dashboard access denied.' });
  res.json({ success: true, data: { role, stats } });
}

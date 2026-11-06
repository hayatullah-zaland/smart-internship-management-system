export function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  req.log?.error({ err: error }, 'Request failed');
  res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
}

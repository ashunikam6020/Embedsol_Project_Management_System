const jwt = require('jsonwebtoken');
const { HttpError, forbidden } = require('../utils/http');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return next(forbidden('Administrator access required'));
  next();
}

module.exports = { authenticate, requireAdmin };

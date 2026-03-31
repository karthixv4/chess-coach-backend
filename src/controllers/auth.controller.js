const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

const prisma = require('../prisma/prismaConnection');

const formatUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role.toLowerCase(),
  avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
});

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'BadRequest', message: 'name, email, password, and role are required.' });
    }

    const normalizedRole = role.toUpperCase();
    if (!['TRAINER', 'STUDENT'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'BadRequest', message: 'role must be "trainer" or "student".' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: normalizedRole },
    });

    const token = generateToken({ id: user.id, role: user.role });
    return res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'BadRequest', message: 'email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
    }

    const token = generateToken({ id: user.id, role: user.role });
    return res.status(200).json({ token, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'NotFound', message: 'User not found.' });
    }
    return res.status(200).json(formatUser(user));
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };

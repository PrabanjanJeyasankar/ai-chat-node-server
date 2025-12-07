const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { AppError } = require('../middleware/errorHandler')
const config = require('../config')

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, config.auth.jwtSecret, {
    expiresIn: config.auth.accessTokenExpiry,
  })
}

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.auth.jwtRefreshSecret, {
    expiresIn: config.auth.refreshTokenExpiry,
  })
}

const createUser = async (email, password, name) => {
  const existingUser = await User.findOne({ email })

  if (existingUser) {
    const isMatch = await existingUser.comparePassword(password)
    if (!isMatch) {
      throw new AppError('Email already registered. Please login.', 401)
    }
    return { existing: true, user: existingUser }
  }

  const newUser = await User.create({
    email,
    password,
    name,
  })

  return { existing: false, user: newUser }
}

const validateUserCredentials = async (email, password) => {
  const user = await User.findOne({ email })
  if (!user) {
    throw new AppError('Invalid email or password', 401)
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401)
  }

  return user
}

const getUserById = (id) => {
  return User.findById(id).select('-password')
}

const storeRefreshToken = async (userId, refreshToken) => {
  await User.findByIdAndUpdate(userId, { refreshToken })
}

const verifyRefreshToken = async (token) => {
  const decoded = jwt.verify(token, config.auth.jwtRefreshSecret)
  const user = await User.findById(decoded.id)

  if (!user || user.refreshToken !== token) {
    throw new AppError('Invalid refresh token', 401)
  }

  return user
}

const clearRefreshToken = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null })
}

module.exports = {
  createUser,
  validateUserCredentials,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  clearRefreshToken,
  getUserById,
}

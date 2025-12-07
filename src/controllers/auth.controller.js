const { asyncHandler } = require('../middleware/asyncHandler')
const authService = require('../services/auth.service')
const logger = require('../utils/logger')
const { success } = require('../utils/response')
const { AppError } = require('../middleware/errorHandler')

const signup = asyncHandler(async (request, response) => {
  const { email, password, name } = request.body

  const result = await authService.createUser(email, password, name)

  const accessToken = authService.generateAccessToken(result.user._id)
  const refreshToken = authService.generateRefreshToken(result.user._id)

  await authService.storeRefreshToken(result.user._id, refreshToken)

  response.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  if (result.existing) {
    return success(
      response,
      200,
      'User already exists. Logged in successfully',
      {
        user: {
          id: result.user._id,
          email: result.user.email,
        },
        accessToken,
      }
    )
  }

  return success(response, 201, 'User registered successfully', {
    user: {
      id: result.user._id,
      email: result.user.email,
    },
    accessToken,
  })
})

const login = asyncHandler(async (request, response) => {
  const { email, password } = request.body

  const user = await authService.validateUserCredentials(email, password)
  const accessToken = authService.generateAccessToken(user._id)
  const refreshToken = authService.generateRefreshToken(user._id)

  await authService.storeRefreshToken(user._id, refreshToken)

  response.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  success(response, 200, 'Login successful', {
    user: {
      id: user._id,
      email: user.email,
    },
    accessToken,
  })
})

const me = asyncHandler(async (request, response) => {
  const user = await authService.getUserById(request.user.id)

  success(response, 200, 'User profile fetched', {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
    },
  })
})

const refresh = asyncHandler(async (request, response) => {
  const refreshToken = request.cookies.refreshToken

  if (!refreshToken) {
    throw new AppError('Refresh token not found', 401)
  }

  const user = await authService.verifyRefreshToken(refreshToken)
  const accessToken = authService.generateAccessToken(user._id)

  success(response, 200, 'Token refreshed successfully', {
    accessToken,
  })
})

const logout = asyncHandler(async (request, response) => {
  await authService.clearRefreshToken(request.user.id)

  response.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })

  success(response, 200, 'Logged out successfully', {})
})

module.exports = {
  signup,
  login,
  me,
  refresh,
  logout,
}

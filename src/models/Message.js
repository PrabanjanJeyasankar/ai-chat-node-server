const mongoose = require('mongoose')

const sourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    source: { type: String, required: true },
    lines: { type: String, required: true },
    publishedAt: { type: String, required: true },
    similarity: { type: Number, required: true },
    finalScore: { type: Number, required: true },
  },
  { _id: false }
)

const messageVersionSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true },
    model: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const thoughtSchema = new mongoose.Schema(
  {
    phase: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
)

const chainOfThoughtsSchema = new mongoose.Schema(
  {
    success: { type: Boolean, default: true },
    thoughts: {
      type: [thoughtSchema],
      default: [],
    },
    totalPhases: { type: Number, default: 0 },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },

    mode: {
      type: String,
      enum: ['default', 'news'],
      default: 'default',
    },

    versions: {
      type: [messageVersionSchema],
      default: [],
    },

    currentVersionIndex: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

messageSchema.add({
  sources: {
    type: [sourceSchema],
    default: function () {
      return this.role === 'assistant' ? [] : undefined
    },
  },
  chainOfThoughts: {
    type: chainOfThoughtsSchema,
    default: null,
  },
})

messageSchema.index({ 'versions.content': 'text' })

module.exports = mongoose.model('Message', messageSchema)

import mongoose from 'mongoose'

const ExecutionSchema = new mongoose.Schema(
  {
    execId: { type: String, required: true, unique: true },
    workflowId: String,
    workflowName: String,
    trigger: String,
    status: { type: String, enum: ['success', 'warning', 'failed'], default: 'success' },
    mode: { type: String, enum: ['production', 'simulation'], default: 'production' },
    startedAt: Date,
    durationMs: Number,
    input: Object,
    logs: { type: Array, default: [] },
    actions: { type: Array, default: [] },
    contractWarnings: { type: Array, default: [] },
    failure: Object,
  },
  { timestamps: true },
)

ExecutionSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret.execId || ret._id.toString()
    delete ret._id
    return ret
  },
})

export default mongoose.models.Execution || mongoose.model('Execution', ExecutionSchema)

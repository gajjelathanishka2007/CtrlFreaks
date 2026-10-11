import mongoose from 'mongoose'

const GraphSchema = new mongoose.Schema(
  {
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
  },
  { _id: false },
)

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Untitled Workflow' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'active', 'paused'], default: 'draft' },
    projectId: { type: String, default: null },
    nodes: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    graph: { type: GraphSchema, default: () => ({ nodes: [], edges: [] }) },
  },
  { timestamps: true },
)

WorkflowSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    return ret
  },
})

export default mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema)

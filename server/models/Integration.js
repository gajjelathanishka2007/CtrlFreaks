import mongoose from 'mongoose'

const IntegrationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: String,
    requiresCredentials: { type: String, default: null },
    connected: { type: Boolean, default: false },
    // Secrets/refresh tokens are stored securely on the server and must never
    // be returned to the client. This field is illustrative only.
    credentialsRef: { type: String, default: null },
  },
  { timestamps: true },
)

IntegrationSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.credentialsRef
    return ret
  },
})

export default mongoose.models.Integration || mongoose.model('Integration', IntegrationSchema)

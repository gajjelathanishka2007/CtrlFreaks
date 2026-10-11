/** Wrap an async route handler so rejections become 500s instead of crashes. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

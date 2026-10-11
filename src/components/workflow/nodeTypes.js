import { memo } from 'react'
import SynqNode from './SynqNode.jsx'
import { NODE_CATALOG } from '../../data/nodeCatalog.js'

/** Stable nodeTypes map for React Flow (all nodes share one visual component). */
const map = {}
for (const n of NODE_CATALOG) map[n.type] = SynqNode

export const nodeTypes = map
export default map

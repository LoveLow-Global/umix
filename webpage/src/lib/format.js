// Small text helpers.

/** the page of one item */
export const itemPath = it => `/item/${it.layer}/${encodeURIComponent(it.id)}${it.src === 'search' ? '?rare=1' : ''}`

/** "1,234" */
export const fmt = n => (n ?? 0).toLocaleString('en-US')

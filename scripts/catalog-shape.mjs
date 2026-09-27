const hostStringArrays = [
  'contributions',
  'httpOrigins',
  'externalNavigationOrigins',
  'credentialLabels',
  'providers',
  'categories',
  'tags',
]

export const invalidHostStringArray = entry =>
  hostStringArrays.find(field =>
    !Array.isArray(entry[field]) || entry[field].some(value => typeof value !== 'string')
  )

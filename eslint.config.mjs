import next from 'eslint-config-next'

// eslint-config-next v16 ships a flat-config array directly.
const eslintConfig = [
  ...next,
  {
    ignores: ['node_modules/**', '.next/**', 'src/generated/**', 'prisma/dev.db'],
  },
]

export default eslintConfig

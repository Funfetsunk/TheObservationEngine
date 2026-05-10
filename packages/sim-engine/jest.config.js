module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@wixbury/shared$': '<rootDir>/../shared/src',
    '^@wixbury/db$': '<rootDir>/../db/src',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};

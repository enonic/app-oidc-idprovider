//-------------------------
// Test.mock only works the first time, the following workaround allows mutability:

const test = require('/lib/xp/testing');

const mocks = {};

const updateMocks = (libPath, newMocks) => {
  const targetMocks = mocks[libPath];
  Object.keys(newMocks).forEach( key => {
    targetMocks[key] = newMocks[key];
  })
}


// This replaces the test.mock function, and returns a function that updates the relevant mocks, hence allowing mutation/replacment mocking:
exports.mockAndGetUpdaterFunc = (libPath, mockObj) => {
    mocks[libPath] = {};

    Object.keys(mockObj).forEach( key => {
        mocks[libPath][key] = mockObj[key]
    });

    test.mock(libPath, mocks[libPath]);

    return (newMocks => updateMocks(libPath, newMocks));
  // TODO: Add support for restoring actual lib functions when running the replacer func with fewer keys than before
};

// ----------------------------------------------

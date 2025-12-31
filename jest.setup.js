require('@testing-library/jest-dom');

// Add TextEncoder/TextDecoder for viem
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock window.matchMedia for MUI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
});

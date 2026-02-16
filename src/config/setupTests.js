// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom does not implement matchMedia; mock it for theme/dark-mode logic.
/** @type {(query: string) => MediaQueryList} */
const matchMediaMock = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
});

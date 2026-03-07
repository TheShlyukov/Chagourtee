import { NavigateFunction } from 'react-router-dom';

let navigateRef: NavigateFunction | null = null;

/**
 * Initialize the navigation utility with the navigate function from react-router-dom
 */
export const initErrorNavigation = (navigate: NavigateFunction) => {
  navigateRef = navigate;
};

/**
 * Navigate to an error page using React Router
 * This should be called from within a component that has access to the navigate function
 */
export const navigateToErrorPage = (statusCode: number) => {
  if (navigateRef) {
    navigateRef(`/${statusCode}`);
  } else {
    // Fallback to direct URL change if navigateRef is not initialized
    window.location.href = `/${statusCode}`;
  }
};
/**
 * App Component
 * Pure orchestration container - combines functionality and renders UI
 * Contains no business logic or implementation details
 */

import React from 'react';
import './styles/globals.css';

import { useAppController } from './hooks';
import { AppContainer } from './components';

const App: React.FC = () => {
  // Get all functionality from the controller hook
  const controller = useAppController();

  // Pure composition - just pass props to the container
  return <AppContainer {...controller} />;
};

export default App;

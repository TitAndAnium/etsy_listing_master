import React from 'react';
import ListingGenerator from './components/ListingGenerator';
import { AuthProvider } from './components/auth/AuthProvider';
import { ApiModeProvider } from './components/dev/ApiModeContext';

export default function App() {
  return (
    <AuthProvider>
      <ApiModeProvider>
        <ListingGenerator />
      </ApiModeProvider>
    </AuthProvider>
  );
}

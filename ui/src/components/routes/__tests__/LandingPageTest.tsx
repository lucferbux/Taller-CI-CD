import React from 'react';

import { render, screen } from '@testing-library/react';
import LandingPage from '../LandingPage';

test('Landing Title', () => {
  const { getByText } = render(<LandingPage />);
  expect(getByText('landing.title')).toBeInTheDocument();
});

test('Landing Animation', () => {
  render(<LandingPage />);
  expect(screen.getByTestId('lottieImg')).toBeInTheDocument();
});

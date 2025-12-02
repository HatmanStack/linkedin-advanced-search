import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

interface TestProvidersProps {
  children: ReactNode;
  routerProps?: MemoryRouterProps;
  queryClient?: QueryClient;
}

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const TestProviders: React.FC<TestProvidersProps> = ({
  children,
  routerProps = { initialEntries: ['/'] },
  queryClient = createTestQueryClient(),
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter {...routerProps}>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
  queryClient?: QueryClient;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult => {
  const { routerProps, queryClient, ...renderOptions } = options;

  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <TestProviders routerProps={routerProps} queryClient={queryClient}>
      {children}
    </TestProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export const renderWithRouter = (
  ui: ReactElement,
  routerProps: MemoryRouterProps = { initialEntries: ['/'] }
): RenderResult => {
  return render(<MemoryRouter {...routerProps}>{ui}</MemoryRouter>);
};

export { createTestQueryClient, TestProviders };

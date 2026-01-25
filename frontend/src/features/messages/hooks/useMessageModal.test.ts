import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageModal } from './useMessageModal';
import type { Connection } from '@/types';

const mockConnection: Connection = {
  id: 'conn-1',
  first_name: 'John',
  last_name: 'Doe',
  position: 'Engineer',
  company: 'Test Corp',
  status: 'ally',
};

describe('useMessageModal', () => {
  it('starts with modal closed', () => {
    const { result } = renderHook(() => useMessageModal());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedConnection).toBeNull();
  });

  it('opens modal with connection on openModal', () => {
    const { result } = renderHook(() => useMessageModal());

    act(() => {
      result.current.openModal(mockConnection);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedConnection).toEqual(mockConnection);
  });

  it('closes modal and clears connection on closeModal', () => {
    const { result } = renderHook(() => useMessageModal());

    act(() => {
      result.current.openModal(mockConnection);
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedConnection).toBeNull();
  });

  it('can reopen with different connection', () => {
    const { result } = renderHook(() => useMessageModal());

    const anotherConnection: Connection = {
      ...mockConnection,
      id: 'conn-2',
      first_name: 'Jane',
    };

    act(() => {
      result.current.openModal(mockConnection);
    });

    expect(result.current.selectedConnection?.id).toBe('conn-1');

    act(() => {
      result.current.closeModal();
    });
    act(() => {
      result.current.openModal(anotherConnection);
    });

    expect(result.current.selectedConnection?.id).toBe('conn-2');
    expect(result.current.selectedConnection?.first_name).toBe('Jane');
  });
});

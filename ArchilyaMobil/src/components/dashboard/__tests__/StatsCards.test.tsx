import React from 'react';
import { render } from '@testing-library/react-native';
import StatsCards from '../StatsCards';

describe('StatsCards', () => {
  it('renders all four labels', () => {
    const { getByText } = render(
      <StatsCards activeCount={3} totalFiles={12} unreadCount={5} pendingInviteCount={2} />
    );

    expect(getByText('activeProject')).toBeTruthy();
    expect(getByText('totalFiles')).toBeTruthy();
    expect(getByText('notification')).toBeTruthy();
    expect(getByText('pendingInvite')).toBeTruthy();
  });

  it('renders correct prop values', () => {
    const { getByText } = render(
      <StatsCards activeCount={7} totalFiles={42} unreadCount={0} pendingInviteCount={1} />
    );

    expect(getByText('7')).toBeTruthy();
    expect(getByText('42')).toBeTruthy();
    expect(getByText('0')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
  });

  it('renders zero values', () => {
    const { getAllByText } = render(
      <StatsCards activeCount={0} totalFiles={0} unreadCount={0} pendingInviteCount={0} />
    );

    expect(getAllByText('0')).toHaveLength(4);
  });
});

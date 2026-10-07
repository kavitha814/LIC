import React from 'react';
import { PoliciesView } from './PoliciesView';
import type { Policy, AppSettings } from '../types';

interface YearlyRegisterViewProps {
  policies: Policy[];
  settings: AppSettings;
  maskSensitive: boolean;
  onSelectPolicy: (policy: Policy) => void;
}

/**
 * YearlyRegisterView is now unified into PoliciesView.
 * This wrapper forwards props to PoliciesView to maintain backwards compatibility.
 */
export const YearlyRegisterView: React.FC<YearlyRegisterViewProps> = ({
  policies,
  settings,
  maskSensitive,
  onSelectPolicy: _onSelectPolicy
}) => {
  return (
    <PoliciesView
      policies={policies}
      customers={[]}
      settings={settings}
      maskSensitive={maskSensitive}
      onSavePolicy={async () => {}}
      onDeletePolicy={async () => {}}
      onSelectCustomer={() => {}}
      initialSelectedPolicy={null}
    />
  );
};

export default YearlyRegisterView;

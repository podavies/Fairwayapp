import { requireNativeView } from 'expo';
import * as React from 'react';

import { ScorecardOcrViewProps } from './ScorecardOcr.types';

const NativeView: React.ComponentType<ScorecardOcrViewProps> =
  requireNativeView('ScorecardOcr');

export default function ScorecardOcrView(props: ScorecardOcrViewProps) {
  return <NativeView {...props} />;
}

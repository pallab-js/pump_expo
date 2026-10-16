import { View } from 'react-native';
import { spacing } from '@/theme/tokens';

type SpaceSize = keyof typeof spacing;

/** Vertical (default) or horizontal spacer using theme spacing tokens. */
export function Spacer({ size = 'md', horizontal = false }: { size?: SpaceSize; horizontal?: boolean }) {
  const value = spacing[size];
  return <View style={horizontal ? { width: value } : { height: value }} />;
}

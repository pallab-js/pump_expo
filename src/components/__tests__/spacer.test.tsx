import { render } from '@testing-library/react-native';
import { Spacer } from '@/components';
import { spacing } from '@/theme/tokens';

type Node = { props: { style: { height?: number; width?: number } } };

describe('Spacer', () => {
  it('renders a vertical gap using the token size', () => {
    const { toJSON } = render(<Spacer size="lg" />);
    const node = toJSON() as unknown as Node;
    expect(node.props.style.height).toBe(spacing.lg);
  });

  it('renders a horizontal gap when horizontal', () => {
    const { toJSON } = render(<Spacer size="sm" horizontal />);
    const node = toJSON() as unknown as Node;
    expect(node.props.style.width).toBe(spacing.sm);
  });

  it('defaults to md', () => {
    const { toJSON } = render(<Spacer />);
    const node = toJSON() as unknown as Node;
    expect(node.props.style.height).toBe(spacing.md);
  });
});
